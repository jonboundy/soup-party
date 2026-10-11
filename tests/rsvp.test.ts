import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { submitRsvp } from "@/app/actions";
import { db } from "@/lib/db";
import { hashEditToken } from "@/lib/edit-token";
import { createRsvp } from "@/lib/rsvp";

import { clearRsvps } from "./database";

function submit(fields: Record<string, string>) {
  const formData = new FormData();
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

beforeEach(clearRsvps);

afterEach(() => {
  vi.unstubAllEnvs();
});

afterAll(async () => {
  await db.$disconnect();
});

describe("submitRsvp", () => {
  it("stores an attending guest and their party size", async () => {
    const result = await submit({ name: " Ada Lovelace ", attendance: "attending", partySize: "3" });

    expect(result).toEqual({ status: "attending", name: "Ada Lovelace", partySize: 3 });
    expect(await db.rsvp.findMany()).toMatchObject([
      { attendeeName: "Ada Lovelace", status: "ATTENDING", partySize: 3 },
    ]);
  });

  it("stores a declining guest without a party size", async () => {
    const result = await submit({ name: "Grace Hopper", attendance: "declined", partySize: "4" });

    expect(result).toEqual({ status: "declined", name: "Grace Hopper" });
    expect(await db.rsvp.findMany()).toMatchObject([
      { attendeeName: "Grace Hopper", status: "DECLINED", partySize: null },
    ]);
  });

  it("keeps the headcount equal to the parties that are attending", async () => {
    await submit({ name: "Ada Lovelace", attendance: "attending", partySize: "3" });
    await submit({ name: "Grace Hopper", attendance: "declined", partySize: "4" });
    await submit({ name: "Alan Turing", attendance: "attending", partySize: "1" });
    await submit({ name: "Nobody", attendance: "attending", partySize: "0" });
    await submit({ name: "", attendance: "attending", partySize: "5" });

    expect(await headcount()).toBe(4);
    expect(await db.rsvp.count()).toBe(3);
  });

  it("stores nothing when the response is invalid, and says why", async () => {
    const result = await submit({ name: "  ", attendance: "attending", partySize: "11" });

    expect(result).toEqual({
      status: "invalid",
      errors: { name: "Enter your name.", partySize: "A party is at most 10 people." },
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

    const [rsvp] = await db.rsvp.findMany();
    expect(rsvp).toMatchObject({ status: "DECLINED", partySize: null });
    expect(rsvp.id).not.toBe(id);
    expect(rsvp.editTokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(rsvp.createdAt.getFullYear()).toBeGreaterThan(2020);
  });

  it("returns nothing private", async () => {
    const result = await submit({ name: "Ada Lovelace", attendance: "attending", partySize: "2" });
    const [rsvp] = await db.rsvp.findMany();

    expect(JSON.stringify(result)).not.toContain(rsvp.id);
    expect(JSON.stringify(result)).not.toContain(rsvp.editTokenHash);
    expect(Object.keys(result).sort()).toEqual(["name", "partySize", "status"]);
  });

  it("reports a failure when there is no database", async () => {
    vi.stubEnv("DATABASE_URL", "");

    const result = await submit({ name: "Ada Lovelace", attendance: "attending", partySize: "2" });

    expect(result).toEqual({ status: "failed" });
  });

  it("rejects a request that is not a form submission", async () => {
    const result = await submitRsvp({ status: "idle" }, { name: "Ada" } as unknown as FormData);

    expect(result).toEqual({ status: "failed" });
    expect(await db.rsvp.count()).toBe(0);
  });
});

describe("createRsvp", () => {
  const ada = { attendeeName: "Ada Lovelace", status: "ATTENDING" as const, partySize: 2 };

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
});
