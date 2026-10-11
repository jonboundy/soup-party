import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { updateTag } from "next/cache";

import { removeHostRsvp, saveHostRsvp } from "@/app/host/actions";
import { db } from "@/lib/db";
import { getHostOverview, getHostRsvp } from "@/lib/host-rsvps";
import { readPublicSoups } from "@/lib/public-soups";
import { cancelRsvp, createRsvp, getEditableRsvp } from "@/lib/rsvp";

import { clearRsvps } from "./database";

const host = vi.hoisted(() => ({ signedIn: true }));
vi.mock("@/lib/host-session", () => ({
  requireHost: async () => {
    if (!host.signedIn) throw new Error("redirect:/host");
  },
}));
vi.mock("next/cache", () => ({ updateTag: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => { throw new Error(`redirect:${path}`); },
  // The mocked redirect is the only framework signal these tests raise.
  unstable_rethrow: (error: unknown) => {
    if (error instanceof Error && error.message.startsWith("redirect:")) throw error;
  },
}));

const original = {
  attendeeName: "Ada Lovelace", secondName: "Charles Babbage", status: "ATTENDING" as const,
  soup: { name: "Minestrone" },
};
const fields = {
  name: "Ada Lovelace", secondName: "Charles Babbage", attendance: "attending", soupName: "Minestrone",
};
function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}
function save(rsvpId: string, overrides: Record<string, string> = {}) {
  return saveHostRsvp({ status: "idle" }, form({ ...fields, rsvpId, ...overrides }));
}
function remove(rsvpId: string, confirmRemove = "yes") {
  return removeHostRsvp({ status: "idle" }, form({ rsvpId, confirmRemove }));
}
const stored = (id: string) => db.rsvp.findUnique({ where: { id }, include: { soup: true } });
/** A saved or removed RSVP sends the host back to the responses. */
const done = "redirect:/host";

beforeEach(async () => {
  vi.clearAllMocks();
  host.signedIn = true;
  await clearRsvps();
});
afterAll(async () => db.$disconnect());

describe("host corrections", () => {
  it("are refused to anyone but the signed-in host, leaving everything as it was", async () => {
    const { id } = await createRsvp(original);
    const before = await stored(id);
    host.signedIn = false;

    await expect(getHostRsvp(id)).rejects.toThrow(done);
    await expect(save(id, { name: "Mallory", soupName: "Gruel" })).rejects.toThrow(done);
    await expect(remove(id)).rejects.toThrow(done);
    // Not even validation runs for a signed-out caller.
    await expect(save(id, { name: "" })).rejects.toThrow(done);

    expect(await stored(id)).toEqual(before);
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("show the host the guest's saved answers and nothing secret", async () => {
    const { id, editToken } = await createRsvp(original);
    const rsvp = await getHostRsvp(id);
    expect(rsvp).toEqual(original);
    const row = await db.rsvp.findUniqueOrThrow({ where: { id } });
    for (const secret of [editToken, row.editTokenHash, row.submissionHash!]) {
      expect(JSON.stringify(rsvp)).not.toContain(secret);
    }
  });

  it("persist and reach the public registry and the overview", async () => {
    const { id, editToken } = await createRsvp(original);
    const { id: otherId } = await createRsvp({ ...original, attendeeName: "Grace Hopper", soup: null });
    const other = await stored(otherId);
    const before = await db.rsvp.findUniqueOrThrow({ where: { id } });

    await expect(save(id, {
      name: " Ada Byron ", secondName: " William King ", soupName: " Tomato Basil Soup ",
    })).rejects.toThrow(done);

    expect(updateTag).toHaveBeenCalledWith("soups");
    expect(await readPublicSoups()).toEqual([
      { name: "Tomato Basil Soup", contributorName: "Ada and William" },
    ]);
    const overview = await getHostOverview();
    expect(overview.counts).toMatchObject({ guests: 4, soups: 1 });
    expect(overview.attending[0]).toMatchObject({
      attendeeName: "Ada Byron", secondName: "William King", partySize: 2,
    });
    expect((await stored(id))!.soup).toMatchObject({ normalizedName: "tomato basil" });
    // Only the named RSVP changes.
    expect(await stored(otherId)).toEqual(other);

    // The guest's private link is neither replaced nor revealed, and still works.
    const after = await db.rsvp.findUniqueOrThrow({ where: { id } });
    expect(after.editTokenHash).toBe(before.editTokenHash);
    expect(after.submissionHash).toBe(before.submissionHash);
    expect(await getEditableRsvp(editToken)).toMatchObject({ attendeeName: "Ada Byron" });
  });

  it("add a soup for an undecided guest and remove one by clearing its name", async () => {
    const { id } = await createRsvp({ ...original, soup: null });
    await expect(save(id)).rejects.toThrow(done);
    expect(await readPublicSoups()).toMatchObject([{ name: "Minestrone", contributorName: "Ada and Charles" }]);

    await expect(save(id, { soupName: " " })).rejects.toThrow(done);
    expect(await readPublicSoups()).toEqual([]);
    expect((await stored(id))!.soup).toBeNull();
    expect((await getHostOverview()).counts).toMatchObject({ attending: 1, undecided: 1 });
  });

  it("unlist a soup on a decline and relist it on a return, as a guest's own would", async () => {
    const { id } = await createRsvp(original);
    await expect(save(id, { attendance: "declined" })).rejects.toThrow(done);
    expect(await stored(id)).toMatchObject({ status: "DECLINED", partySize: null, soup: { name: "Minestrone" } });
    expect(await readPublicSoups()).toEqual([]);

    await expect(save(id, { secondName: "" })).rejects.toThrow(done);
    expect(await stored(id)).toMatchObject({ status: "ATTENDING", secondName: null, partySize: 1 });
    expect(await readPublicSoups()).toHaveLength(1);
  });

  it("are validated as a guest's answers are, and save nothing when invalid", async () => {
    const { id } = await createRsvp(original);
    const before = await stored(id);
    expect(await save(id, { name: " ", secondName: "a".repeat(81), soupName: "a".repeat(81) })).toEqual({
      status: "invalid",
      errors: {
        name: expect.any(String), secondName: expect.any(String), soupName: expect.any(String),
      },
    });
    const repeated = form({ ...fields, rsvpId: id });
    repeated.append("name", "Mallory");
    expect(await saveHostRsvp({ status: "idle" }, repeated)).toMatchObject({ status: "invalid" });
    expect(await stored(id)).toEqual(before);
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("report an RSVP that is not there, whatever is sent as its id", async () => {
    const { id, editToken } = await createRsvp(original);
    const before = await stored(id);
    const row = await db.rsvp.findUniqueOrThrow({ where: { id } });
    for (const rsvpId of ["", "1", id.toUpperCase(), `${id}'`, editToken, row.editTokenHash, crypto.randomUUID()]) {
      expect(await getHostRsvp(rsvpId)).toBeNull();
      expect(await save(rsvpId, { name: "Mallory" })).toEqual({ status: "missing" });
      expect(await remove(rsvpId)).toEqual({ status: "missing" });
    }
    expect(await save(undefined as unknown as string)).toEqual({ status: "missing" });
    expect(await stored(id)).toEqual(before);
    expect(updateTag).not.toHaveBeenCalled();
  });
});

describe("host removal", () => {
  it("needs the confirmation to arrive with the request", async () => {
    const { id } = await createRsvp(original);
    for (const confirmRemove of ["", "no", "true"]) {
      expect(await remove(id, confirmRemove)).toEqual({ status: "failed" });
    }
    expect(await removeHostRsvp({ status: "idle" }, form({ rsvpId: id }))).toEqual({ status: "failed" });
    expect(await stored(id)).not.toBeNull();
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("deletes the RSVP and its soup, and nothing else", async () => {
    const { id, editToken } = await createRsvp(original);
    const { id: otherId } = await createRsvp({
      ...original, attendeeName: "Grace Hopper", secondName: null, soup: { name: "Borscht" },
    });

    await expect(remove(id)).rejects.toThrow(done);

    expect(updateTag).toHaveBeenCalledWith("soups");
    expect(await stored(id)).toBeNull();
    expect(await db.soup.count({ where: { rsvpId: id } })).toBe(0);
    expect(await readPublicSoups()).toMatchObject([{ name: "Borscht", contributorName: "Grace" }]);
    expect((await getHostOverview()).counts).toEqual({ guests: 1, attending: 1, declined: 0, soups: 1, undecided: 0 });
    expect(await stored(otherId)).not.toBeNull();
    // The removed guest's private link opens nothing.
    expect(await getEditableRsvp(editToken)).toBeNull();
    // Removing it again, from a stale page, reports that it is gone.
    expect(await remove(id)).toEqual({ status: "missing" });
    expect(await save(id)).toEqual({ status: "missing" });
  });

  it("deletes a declined guest's retained soup with the RSVP", async () => {
    const { id, editToken } = await createRsvp(original);
    await cancelRsvp(editToken);
    await expect(remove(id)).rejects.toThrow(done);
    expect(await db.rsvp.count()).toBe(0);
    expect(await db.soup.count()).toBe(0);
  });
});
