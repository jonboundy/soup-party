import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { refresh, updateTag } from "next/cache";
import { cancelGuestRsvp, editRsvp } from "@/app/actions";
import { db } from "@/lib/db";
import { getEditableRsvp, createRsvp, updateRsvp } from "@/lib/rsvp";
import { createEditToken, hashEditToken } from "@/lib/edit-token";
import { readPublicSoups } from "@/lib/public-soups";
import { clearRsvps } from "./database";

vi.mock("next/cache", () => ({ refresh: vi.fn(), updateTag: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
const original = {
  attendeeName: "Ada Lovelace", secondName: "Charles Babbage", status: "ATTENDING" as const,
  soup: { name: "Minestrone" },
};
const fields = { name: "Ada Lovelace", secondName: "Charles Babbage", attendance: "attending", soupName: "Minestrone" };
const partySize = async (id: string) => (await db.rsvp.findUniqueOrThrow({ where: { id } })).partySize;
function form(token: string, overrides: Record<string, string> = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ ...fields, editToken: token, ...overrides })) data.set(key, value);
  return data;
}
function edit(token: string, overrides: Record<string, string> = {}) {
  return editRsvp({ status: "idle" }, form(token, overrides));
}
function cancel(token: string) {
  return cancelGuestRsvp({ status: "idle" }, form(token, { confirmCancel: "yes" }));
}
beforeEach(async () => { vi.clearAllMocks(); await clearRsvps(); });
afterEach(() => vi.unstubAllEnvs());
afterAll(async () => db.$disconnect());

describe("private guest RSVP management", () => {
  it("reveals editable fields only with a valid token; ids and hashes cannot authorize", async () => {
    const { id, editToken } = await createRsvp(original);
    expect(await getEditableRsvp(editToken)).toEqual(original);
    for (const token of [undefined, null, [editToken], "", id, hashEditToken(editToken), createEditToken().token]) {
      expect(await getEditableRsvp(token)).toBeNull();
    }
  });

  it("rejects forged, missing, and malformed credentials for edits and cancellation", async () => {
    const { id, editToken } = await createRsvp(original);
    const before = await db.rsvp.findUniqueOrThrow({ where: { id }, include: { soup: true } });
    for (const token of ["", id, hashEditToken(editToken), createEditToken().token]) {
      expect(await edit(token)).toEqual({ status: "unauthorized" });
      expect(await cancel(token)).toEqual({ status: "unauthorized" });
    }
    const missing = form(editToken); missing.delete("editToken");
    expect(await editRsvp({ status: "idle" }, missing)).toEqual({ status: "unauthorized" });
    expect(await cancelGuestRsvp({ status: "idle" }, {} as FormData)).toEqual({ status: "unauthorized" });
    expect(await db.rsvp.findUniqueOrThrow({ where: { id }, include: { soup: true } })).toEqual(before);
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("updates names, party size, and soup atomically, while preserving the token", async () => {
    const { id, editToken } = await createRsvp(original);
    const { id: otherId } = await createRsvp({ ...original, attendeeName: "Grace Hopper", soup: null });
    const other = await db.rsvp.findUniqueOrThrow({ where: { id: otherId } });
    expect(await edit(editToken, {
      name: " Ada Byron ", secondName: "", soupName: " Tomato Basil Soup ", partySize: "4",
      id: otherId, rsvpId: otherId, editTokenHash: other.editTokenHash, normalizedName: "wrong", status: "DECLINED",
    })).toEqual({
      status: "attending", name: "Ada Byron", secondName: null, editPath: `/rsvp/edit?token=${editToken}`,
      soup: { name: "Tomato Basil Soup" },
    });
    expect(await db.rsvp.findUniqueOrThrow({ where: { id }, include: { soup: true } })).toMatchObject({
      attendeeName: "Ada Byron", secondName: null, partySize: 1, status: "ATTENDING", editTokenHash: hashEditToken(editToken),
      soup: { rsvpId: id, normalizedName: "tomato basil" },
    });
    expect(await db.rsvp.findUniqueOrThrow({ where: { id: otherId } })).toEqual(other);
    expect(await readPublicSoups()).toMatchObject([{ name: "Tomato Basil Soup", contributorName: "Ada" }]);
    expect(updateTag).toHaveBeenCalledExactlyOnceWith("soups");
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("validates edits and rolls back both writes if soup storage fails", async () => {
    const { id, editToken } = await createRsvp(original);
    const before = await db.rsvp.findUniqueOrThrow({ where: { id }, include: { soup: true } });
    expect(await edit(editToken, { name: " ", soupName: "a".repeat(81) })).toMatchObject({ status: "invalid" });
    await expect(updateRsvp(editToken, { ...original, attendeeName: "Changed", soup: { name: " " } })).rejects.toThrow();
    expect(await db.rsvp.findUniqueOrThrow({ where: { id }, include: { soup: true } })).toEqual(before);
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("excludes the guest's soup from warnings and permits an acknowledged match to another guest", async () => {
    const { editToken } = await createRsvp(original);
    expect(await edit(editToken)).toMatchObject({ status: "attending" });
    await createRsvp({ ...original, attendeeName: "Grace Hopper", soup: { name: "Tomato basil" } });
    vi.clearAllMocks();
    expect(await edit(editToken, { soupName: "Tomato basil" })).toEqual({
      status: "duplicate", soupName: "Tomato basil", matches: [{ name: "Tomato basil", contributorName: "Grace and Charles", kind: "exact" }],
    });
    expect(await getEditableRsvp(editToken)).toMatchObject({ soup: { name: "Minestrone" } });
    expect(updateTag).not.toHaveBeenCalled();
    expect(await edit(editToken, { soupName: "Tomato basil", acknowledgedSoupName: "Minestrone" })).toMatchObject({ status: "duplicate" });
    expect(await edit(editToken, { soupName: "Tomato basil", acknowledgedSoupName: "Tomato basil" })).toMatchObject({ status: "attending" });
  });

  it("can remove a soup, decide later, and register a new one using the same link", async () => {
    const { editToken } = await createRsvp(original);
    expect(await edit(editToken, { soupName: "" })).toMatchObject({ status: "attending", soup: null });
    expect(await readPublicSoups()).toEqual([]);
    expect(await db.soup.count()).toBe(0);
    expect(updateTag).toHaveBeenCalledWith("soups");
    expect(await edit(editToken)).toMatchObject({ status: "attending", soup: { name: "Minestrone" } });
  });

  it("releases a soup on decline and allows attendance to resume", async () => {
    const { id, editToken } = await createRsvp(original);
    expect(await partySize(id)).toBe(2);
    expect(await edit(editToken, { attendance: "declined" })).toEqual({
      status: "declined", name: "Ada Lovelace", secondName: "Charles Babbage", unlistedSoup: "Minestrone",
      editPath: `/rsvp/edit?token=${editToken}`,
    });
    expect(await getEditableRsvp(editToken)).toEqual({ ...original, status: "DECLINED" });
    expect(await partySize(id)).toBeNull();
    expect(await readPublicSoups()).toEqual([]);
    expect(await edit(editToken)).toMatchObject({ status: "attending" });
    expect(await partySize(id)).toBe(2);
    expect(await readPublicSoups()).toHaveLength(1);
  });

  it("requires deliberate cancellation, releases headcount and soup, and is repeatable", async () => {
    const { id, editToken } = await createRsvp(original);
    expect(await cancelGuestRsvp({ status: "idle" }, form(editToken))).toEqual({ status: "failed" });
    expect(await readPublicSoups()).toHaveLength(1);
    const cancelled = {
      status: "cancelled", name: "Ada Lovelace", secondName: "Charles Babbage", unlistedSoup: "Minestrone",
      editPath: `/rsvp/edit?token=${editToken}`,
    };
    expect(await cancel(editToken)).toEqual(cancelled);
    expect(await cancel(editToken)).toEqual(cancelled);
    expect(await readPublicSoups()).toEqual([]);
    expect(await db.rsvp.count({ where: { status: "ATTENDING" } })).toBe(0);
    expect(await getEditableRsvp(editToken)).toMatchObject({ status: "DECLINED", secondName: "Charles Babbage" });
    expect(await partySize(id)).toBeNull();
    expect(await edit(editToken)).toMatchObject({ status: "attending" });
  });

  it("confirms a decline or cancellation without a soup when none was registered", async () => {
    const { editToken } = await createRsvp({ ...original, soup: null });
    expect(await edit(editToken, { attendance: "declined" })).toMatchObject({ status: "declined", unlistedSoup: null });
    expect(await cancel(editToken)).toMatchObject({ status: "cancelled", unlistedSoup: null });
    expect(await db.soup.count()).toBe(0);
  });

  it("rejects a stale link after the host removes the RSVP", async () => {
    const { id, editToken } = await createRsvp(original);
    await db.rsvp.delete({ where: { id } });
    expect(await edit(editToken)).toEqual({ status: "unauthorized" });
    expect(await cancel(editToken)).toEqual({ status: "unauthorized" });
    expect(await db.rsvp.count()).toBe(0);
  });

  it("reports an unavailable database without changing anything", async () => {
    const { editToken } = await createRsvp(original);
    vi.stubEnv("DATABASE_URL", "");
    expect(await edit(editToken)).toEqual({ status: "failed" });
    expect(await cancel(editToken)).toEqual({ status: "failed" });
  });
});
