import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { refresh, updateTag } from "next/cache";
import { cancelGuestRsvp, editRsvp } from "@/app/actions";
import { db } from "@/lib/db";
import { getEditableRsvp, createRsvp, updateRsvp } from "@/lib/rsvp";
import { createEditToken, hashEditToken } from "@/lib/edit-token";
import { readPublicRecipe, readPublicSoups } from "@/lib/public-soups";
import { clearRsvps, soupNamed } from "./database";

vi.mock("next/cache", () => ({ refresh: vi.fn(), updateTag: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: vi.fn() }), headers: async () => new Headers() }));
const original = {
  attendeeName: "Ada Lovelace", secondName: "Charles Babbage", status: "ATTENDING" as const,
  soup: soupNamed("Minestrone"),
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
      soup: soupNamed("Tomato Basil Soup"),
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
    await expect(updateRsvp(editToken, { ...original, attendeeName: "Changed", soup: soupNamed(" ") })).rejects.toThrow();
    expect(await db.rsvp.findUniqueOrThrow({ where: { id }, include: { soup: true } })).toEqual(before);
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("excludes the guest's soup from warnings and permits an acknowledged match to another guest", async () => {
    const { editToken } = await createRsvp(original);
    expect(await edit(editToken)).toMatchObject({ status: "attending" });
    await createRsvp({ ...original, attendeeName: "Grace Hopper", soup: soupNamed("Tomato basil") });
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

  it("cannot decline by editing, and returns a cancelled RSVP to the list", async () => {
    const { id, editToken } = await createRsvp(original);
    expect(await edit(editToken, { attendance: "declined" })).toMatchObject({ status: "attending" });
    expect(await partySize(id)).toBe(2);
    expect(await readPublicSoups()).toHaveLength(1);

    await cancel(editToken);
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

  it("confirms a cancellation without a soup when none was registered", async () => {
    const { editToken } = await createRsvp({ ...original, soup: null });
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

  it("adds, changes and removes a recipe using the same link", async () => {
    const { id, editToken } = await createRsvp(original);
    const soupId = (await db.soup.findUniqueOrThrow({ where: { rsvpId: id } })).id;
    const link = { recipeUrl: "https://example.com/minestrone", recipeText: null };
    const text = { recipeUrl: null, recipeText: "Beans.\n\nSimmer." };

    expect(await edit(editToken, { recipeKind: "link", recipeUrl: " example.com/minestrone " }))
      .toMatchObject({ status: "attending", soup: { name: "Minestrone", ...link } });
    expect(await getEditableRsvp(editToken)).toMatchObject({ soup: link });
    // A recipe that is a link is linked to directly, and needs no page of its own.
    expect(await readPublicSoups()).toMatchObject([{ recipeUrl: link.recipeUrl, recipePath: null }]);
    expect(updateTag).toHaveBeenCalledWith("soups");

    // Saved as another kind, it is that kind alone, whatever else the form still held.
    expect(await edit(editToken, {
      soupName: "Ribollita", recipeKind: "text", recipeUrl: link.recipeUrl, recipeText: "Beans.\r\n\r\nSimmer. ",
    })).toMatchObject({ status: "attending", soup: text });
    expect(await readPublicRecipe(soupId)).toMatchObject({ name: "Ribollita", ...text });
    expect(await readPublicSoups()).toMatchObject([{ recipeUrl: null, recipePath: `/soups/${soupId}` }]);

    // Left blank, of no kind, or not sent at all, the recipe is removed.
    const nones: Record<string, string>[] = [
      { recipeKind: "text", recipeText: " " }, { recipeKind: "none", recipeText: "Simmer." }, {},
    ];
    for (const none of nones) {
      expect(await edit(editToken, { recipeKind: "text", recipeText: "Simmer." })).toMatchObject({ status: "attending" });
      expect(await edit(editToken, none)).toMatchObject({ soup: { recipeUrl: null, recipeText: null } });
      expect(await readPublicRecipe(soupId)).toBeNull();
      expect(await readPublicSoups()).toMatchObject([{ recipeUrl: null, recipePath: null }]);
    }
  });

  it("saves nothing when the recipe is invalid", async () => {
    const { editToken } = await createRsvp(original);
    expect(await edit(editToken, { name: "Ada Byron", recipeKind: "link", recipeUrl: "minestrone" })).toEqual({
      status: "invalid", errors: { recipeUrl: "Enter a web address, such as https://example.com/soup." },
    });
    expect(await edit(editToken, { name: "Ada Byron", recipeKind: "both" })).toEqual({
      status: "invalid", errors: { recipeKind: "Choose what the recipe is." },
    });
    expect(await getEditableRsvp(editToken)).toEqual(original);
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("keeps a recipe, unlisted, through a cancellation, and loses it with the soup", async () => {
    const recipe = { recipeUrl: null, recipeText: "Simmer." };
    const { id, editToken } = await createRsvp({ ...original, soup: soupNamed("Minestrone", recipe) });
    const soupId = (await db.soup.findUniqueOrThrow({ where: { rsvpId: id } })).id;

    expect(await cancel(editToken)).toMatchObject({ status: "cancelled" });
    expect(await readPublicRecipe(soupId)).toBeNull();
    expect(await getEditableRsvp(editToken)).toMatchObject({ soup: recipe });
    expect(await edit(editToken, { recipeKind: "text", recipeText: "Simmer." })).toMatchObject({ status: "attending" });
    expect(await readPublicRecipe(soupId)).toMatchObject(recipe);

    // A soup with no name is no soup, so its recipe goes with it.
    expect(await edit(editToken, { soupName: "" })).toMatchObject({ status: "attending", soup: null });
    expect(await readPublicRecipe(soupId)).toBeNull();
    expect(await db.soup.count()).toBe(0);
  });
});
