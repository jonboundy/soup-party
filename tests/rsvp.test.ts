import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { refresh, updateTag } from "next/cache";

import { submitRsvp } from "@/app/actions";
import { db } from "@/lib/db";
import { createEditToken, hashEditToken } from "@/lib/edit-token";
import { createRsvp } from "@/lib/rsvp";

import { clearRsvps } from "./database";

vi.mock("next/cache", () => ({ refresh: vi.fn(), updateTag: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

const ada = { name: "Ada Lovelace", attendance: "attending" };

const minestrone = { soupName: " Minestrone  Soup " };

function submit(fields: Record<string, string>) {
  const formData = new FormData();
  formData.set("submissionToken", createEditToken().token);
  for (const [name, value] of Object.entries(fields)) {
    formData.set(name, value);
  }
  return submitRsvp({ status: "idle" }, formData);
}

async function headcount() {
  const { _sum } = await db.rsvp.aggregate({
    where: { status: "ATTENDING" },
    _sum: { partySize: true },
  });
  return _sum.partySize ?? 0;
}

beforeEach(async () => {
  vi.clearAllMocks();
  await clearRsvps();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

afterAll(async () => {
  await db.$disconnect();
});

describe("submitRsvp", () => {
  it("stores an attending guest as a party of one", async () => {
    const result = await submit({ name: " Ada Lovelace ", attendance: "attending" });

    expect(result).toEqual({ status: "attending", name: "Ada Lovelace", secondName: null, soup: null, editPath: expect.any(String) });
    expect(updateTag).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    expect(await db.rsvp.findMany()).toMatchObject([
      { attendeeName: "Ada Lovelace", secondName: null, status: "ATTENDING", partySize: 1 },
    ]);
  });

  it("stores two guests responding together as a party of two", async () => {
    const result = await submit({ ...ada, secondName: " Charles Babbage ", partySize: "9" });

    expect(result).toEqual({
      status: "attending", name: "Ada Lovelace", secondName: "Charles Babbage", soup: null, editPath: expect.any(String),
    });
    expect(await db.rsvp.findMany()).toMatchObject([
      { attendeeName: "Ada Lovelace", secondName: "Charles Babbage", status: "ATTENDING", partySize: 2 },
    ]);
  });

  it("stores an attending guest's soup, linked to their RSVP", async () => {
    const result = await submit({ ...ada, ...minestrone });

    expect(result).toEqual({
      status: "attending",
      name: "Ada Lovelace",
      secondName: null,
      soup: { name: "Minestrone Soup" },
      editPath: expect.any(String),
    });
    const [rsvp] = await db.rsvp.findMany({ include: { soup: true } });
    expect(updateTag).toHaveBeenCalledExactlyOnceWith("soups");
    expect(refresh).toHaveBeenCalledOnce();
    expect(rsvp).toMatchObject({ attendeeName: "Ada Lovelace", status: "ATTENDING" });
    expect(rsvp.soup).toMatchObject({
      rsvpId: rsvp.id,
      name: "Minestrone Soup",
      normalizedName: "minestrone",
    });
  });

  it("stores an attending guest who will decide on the soup later", async () => {
    const result = await submit({ ...ada, soupName: "" });

    expect(result).toMatchObject({ status: "attending", soup: null });
    expect(await db.rsvp.count({ where: { status: "ATTENDING" } })).toBe(1);
    expect(await db.soup.count()).toBe(0);
  });

  it("stores no soup for a declining guest, even if one was sent", async () => {
    const result = await submit({ ...ada, ...minestrone, attendance: "declined" });

    expect(result).toEqual({
      status: "declined", name: "Ada Lovelace", secondName: null, unlistedSoup: null, editPath: expect.any(String),
    });
    expect(await db.rsvp.count({ where: { status: "DECLINED" } })).toBe(1);
    expect(await db.soup.count()).toBe(0);
  });

  it("stores neither the RSVP nor the soup when the soup is invalid", async () => {
    const result = await submit({ ...ada, soupName: "a".repeat(81) });

    expect(result).toEqual({ status: "invalid", errors: { soupName: "Use 80 characters or fewer." } });
    expect(await db.rsvp.count()).toBe(0);
    expect(await db.soup.count()).toBe(0);
    expect(updateTag).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("warns before writing a duplicate, then permits a deliberate override", async () => {
    await submit({ ...ada, ...minestrone });
    vi.clearAllMocks();
    const grace = { ...ada, ...minestrone, name: "Grace Hopper", soupName: "minestrone!" };
    const warning = await submit(grace);

    expect(warning).toEqual({
      status: "duplicate",
      soupName: "minestrone!",
      matches: [{ name: "Minestrone Soup", contributorName: "Ada", kind: "exact" }],
    });
    expect(await db.rsvp.count()).toBe(1);
    expect(await db.soup.count()).toBe(1);
    expect(updateTag).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();

    const result = await submit({ ...grace, acknowledgedSoupName: "minestrone!" });

    expect(result).toMatchObject({ status: "attending", name: "Grace Hopper", soup: { name: "minestrone!" } });
    expect(await db.soup.count({ where: { normalizedName: "minestrone" } })).toBe(2);
    expect(updateTag).toHaveBeenCalledExactlyOnceWith("soups");
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("shows similar soups with first names only", async () => {
    const { id, editToken } = await createRsvp({
      attendeeName: "Ada Lovelace",
      secondName: "Charles Babbage",
      status: "ATTENDING",
      soup: { name: "Broccoli cheddar" },
    });
    const rsvp = await db.rsvp.findUniqueOrThrow({ where: { id }, include: { soup: true } });
    const warning = await submit({ ...ada, soupName: "Creamy broccoli and cheddar soup" });

    expect(warning).toEqual({
      status: "duplicate",
      soupName: "Creamy broccoli and cheddar soup",
      matches: [{ name: "Broccoli cheddar", contributorName: "Ada and Charles", kind: "similar" }],
    });
    for (const privateValue of [id, editToken, rsvp.editTokenHash, rsvp.soup!.id, "Lovelace", "Babbage"]) {
      expect(JSON.stringify(warning)).not.toContain(privateValue);
    }
  });

  it("checks a changed name again, ignoring the previous acknowledgment", async () => {
    await submit({ ...ada, ...minestrone });
    await submit({ ...ada, soupName: "Tomato basil" });
    const warning = await submit({
      ...ada, ...minestrone, soupName: "Tomato basil", acknowledgedSoupName: "Minestrone Soup",
    });

    expect(warning).toMatchObject({ status: "duplicate", soupName: "Tomato basil" });
    expect(await db.rsvp.count()).toBe(2);

    expect(await submit({ ...ada, ...minestrone, soupName: "Potato leek" }))
      .toMatchObject({ status: "attending", soup: { name: "Potato leek" } });
  });

  it("ignores declined and removed soups during matching", async () => {
    await submit({ ...ada, ...minestrone });
    await db.rsvp.updateMany({ data: { status: "DECLINED", partySize: null } });
    expect(await submit({ ...ada, ...minestrone })).toMatchObject({ status: "attending" });
    await clearRsvps();
    expect(await submit({ ...ada, ...minestrone })).toMatchObject({ status: "attending" });
  });

  it("allows a decline or undecided soup after a duplicate warning", async () => {
    await submit({ ...ada, ...minestrone });
    expect(await submit({ ...ada, ...minestrone })).toMatchObject({ status: "duplicate" });
    expect(await submit({ ...ada, ...minestrone, attendance: "declined" }))
      .toMatchObject({ status: "declined" });
    expect(await submit({ ...ada, ...minestrone, soupName: "" }))
      .toMatchObject({ status: "attending", soup: null });
    expect(await db.soup.count()).toBe(1);
  });

  it("still validates all fields when a duplicate is acknowledged", async () => {
    await submit({ ...ada, ...minestrone });
    expect(await submit({
      ...ada, ...minestrone, acknowledgedSoupName: "Minestrone Soup", name: "", secondName: "a".repeat(81),
    })).toEqual({
      status: "invalid",
      errors: { name: "Enter your name.", secondName: "Use 80 characters or fewer." },
    });
    expect(await db.rsvp.count()).toBe(1);
  });

  it("stores declining guests by name, without a party size", async () => {
    const result = await submit({ name: "Grace Hopper", secondName: "Vincent Hopper", attendance: "declined" });

    expect(result).toEqual({
      status: "declined", name: "Grace Hopper", secondName: "Vincent Hopper", unlistedSoup: null,
      editPath: expect.any(String),
    });
    expect(await db.rsvp.findMany()).toMatchObject([
      { attendeeName: "Grace Hopper", secondName: "Vincent Hopper", status: "DECLINED", partySize: null },
    ]);
  });

  it("keeps the headcount equal to the guests named as attending", async () => {
    await submit({ ...ada, secondName: "Charles Babbage" });
    await submit({ name: "Grace Hopper", secondName: "Vincent Hopper", attendance: "declined" });
    await submit({ name: "Alan Turing", attendance: "attending" });
    await submit({ name: "", secondName: "Nobody", attendance: "attending" });

    expect(await headcount()).toBe(3);
    expect(await db.rsvp.count()).toBe(3);
  });

  it("stores nothing when the response is invalid, and says why", async () => {
    const result = await submit({ name: "  ", attendance: "perhaps" });

    expect(result).toEqual({
      status: "invalid",
      errors: { name: "Enter your name.", attendance: "Say whether you will be there." },
    });
    expect(await db.rsvp.count()).toBe(0);
  });

  it("reads only the fields it expects", async () => {
    const id = "00000000-0000-4000-8000-000000000000";
    await submit({
      name: "Ada Lovelace",
      attendance: "declined",
      partySize: "2",
      id,
      status: "ATTENDING",
      editTokenHash: "chosen-by-the-guest",
      createdAt: "2020-01-01T00:00:00Z",
    });
    await submit({
      ...ada,
      ...minestrone,
      normalizedName: "chosen-by-the-guest",
      rsvpId: id,
      "soup.id": id,
    });

    const [rsvp] = await db.rsvp.findMany({ where: { status: "DECLINED" } });
    expect(rsvp).toMatchObject({ status: "DECLINED", partySize: null });
    expect(rsvp.id).not.toBe(id);
    expect(rsvp.editTokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(rsvp.createdAt.getFullYear()).toBeGreaterThan(2020);

    const [soup] = await db.soup.findMany();
    expect(soup.normalizedName).toBe("minestrone");
    expect(soup.id).not.toBe(id);
    expect(soup.rsvpId).not.toBe(id);
  });

  it("returns only the submitting guest’s edit link, without storage identifiers", async () => {
    const result = await submit({ ...ada, ...minestrone });
    const [rsvp] = await db.rsvp.findMany({ include: { soup: true } });

    expect(JSON.stringify(result)).not.toContain(rsvp.id);
    expect(JSON.stringify(result)).not.toContain(rsvp.soup?.id);
    expect(JSON.stringify(result)).not.toContain(rsvp.editTokenHash);
    if (result.status !== "attending") throw new Error("Expected success");
    const token = new URL(result.editPath, "https://soup.example").searchParams.get("token")!;
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hashEditToken(token)).toBe(rsvp.editTokenHash);
    expect(Object.keys(result).sort()).toEqual(["editPath", "name", "secondName", "soup", "status"]);
    expect(Object.keys(result.soup!)).toEqual(["name"]);
  });

  it("reports a failure when there is no database", async () => {
    vi.stubEnv("DATABASE_URL", "");

    const result = await submit(ada);

    expect(result).toEqual({ status: "failed" });
  });

  it("rejects a request that is not a form submission", async () => {
    const result = await submitRsvp({ status: "idle" }, { name: "Ada" } as unknown as FormData);

    expect(result).toEqual({ status: "failed" });
    expect(await db.rsvp.count()).toBe(0);
  });
});

describe("createRsvp", () => {
  const ada = {
    attendeeName: "Ada Lovelace",
    secondName: null,
    status: "ATTENDING" as const,
    soup: null,
  };

  it("stores the hash of the edit token, never the token", async () => {
    const { id, editToken } = await createRsvp(ada);
    const rsvp = await db.rsvp.findUniqueOrThrow({ where: { id } });

    // 32 random bytes, base64url encoded.
    expect(editToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(rsvp.editTokenHash).toBe(hashEditToken(editToken));
    expect(JSON.stringify(rsvp)).not.toContain(editToken);
  });

  it("gives every response its own token", async () => {
    const tokens = await Promise.all([createRsvp(ada), createRsvp(ada), createRsvp(ada)]);

    expect(new Set(tokens.map(({ editToken }) => editToken)).size).toBe(3);
    expect(await db.rsvp.count()).toBe(3);
  });

  it("stores the soup under its normalized name", async () => {
    const { id } = await createRsvp({
      ...ada,
      soup: { name: "Mom’s Chicken-Noodle Soup" },
    });

    expect(await db.soup.findUniqueOrThrow({ where: { rsvpId: id } })).toMatchObject({
      name: "Mom’s Chicken-Noodle Soup",
      normalizedName: "moms chicken noodle",
    });
  });

  it("stores no RSVP when its soup cannot be stored", async () => {
    await expect(
      createRsvp({ ...ada, soup: { name: " " } }),
    ).rejects.toThrow("soups_name_check");

    expect(await db.rsvp.count()).toBe(0);
  });
});
