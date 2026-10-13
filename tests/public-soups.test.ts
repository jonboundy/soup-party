import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/lib/db";
import { getPublicRecipe, getPublicSoups } from "@/lib/public-soups";
import { createRsvp } from "@/lib/rsvp";

import { clearRsvps, soupNamed } from "./database";

// The query and public projection are real; Next.js owns the cache at runtime.
vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));

beforeEach(clearRsvps);
afterEach(() => vi.unstubAllEnvs());
afterAll(async () => db.$disconnect());

async function register(name = "Minestrone", attendeeName = "Ada Lovelace", secondName: string | null = null) {
  return createRsvp({ attendeeName, secondName, status: "ATTENDING", soup: soupNamed(name) });
}

const recipe = { recipeUrl: "https://example.com/minestrone", recipeText: "Beans.\n\nSimmer." };

/** Registers a soup with a recipe and returns the soup's id with the RSVP's. */
async function registerWithRecipe(given: Partial<typeof recipe> = recipe) {
  const { id, editToken } = await createRsvp({
    attendeeName: "Ada Lovelace", secondName: "Charles Babbage", status: "ATTENDING",
    soup: soupNamed("Minestrone", given),
  });
  const soup = await db.soup.findUniqueOrThrow({ where: { rsvpId: id } });
  return { id, editToken, soupId: soup.id };
}

describe("public soup registry", () => {
  it("returns an empty list when no soups have been registered", async () => {
    expect(await getPublicSoups()).toEqual([]);
  });

  it("exposes only the soup's name and the contributors' first names", async () => {
    const { id, editToken } = await register("Minestrone", "Ada Lovelace", "Charles Babbage");
    const rsvp = await db.rsvp.findUniqueOrThrow({ where: { id }, include: { soup: true } });
    const soups = await getPublicSoups();

    expect(soups).toEqual([{ name: "Minestrone", contributorName: "Ada and Charles", recipePath: null }]);
    for (const privateValue of [id, editToken, rsvp.editTokenHash, rsvp.soup!.id, "Lovelace", "Babbage"]) {
      expect(JSON.stringify(soups)).not.toContain(privateValue);
    }
  });

  it("omits declined guests' soups and attending guests who have not chosen a soup", async () => {
    const { id } = await register("Hidden soup", "Grace Hopper");
    await db.rsvp.update({ where: { id }, data: { status: "DECLINED", partySize: null } });
    await createRsvp({ attendeeName: "Alan Turing", secondName: null, status: "ATTENDING", soup: null });
    await register();

    expect((await getPublicSoups()).map(({ name }) => name)).toEqual(["Minestrone"]);
  });

  it("lists soups alphabetically and retains duplicate names", async () => {
    await register("Zucchini");
    await register("Bean", "Grace Hopper");
    await register("Bean", "李");

    expect((await getPublicSoups()).map(({ name, contributorName }) => [name, contributorName]))
      .toEqual([["Bean", "Grace"], ["Bean", "李"], ["Zucchini", "Ada"]]);
  });

  it("reflects registrations, soup edits, declines, and deleted RSVPs", async () => {
    const { id } = await register();
    expect(await getPublicSoups()).toHaveLength(1);
    await db.soup.update({ where: { rsvpId: id }, data: { name: "Tomato" } });
    expect(await getPublicSoups()).toMatchObject([{ name: "Tomato" }]);
    await db.rsvp.update({ where: { id }, data: { status: "DECLINED", partySize: null } });
    expect(await getPublicSoups()).toEqual([]);
    await db.rsvp.update({ where: { id }, data: { status: "ATTENDING", partySize: 1 } });
    expect(await getPublicSoups()).toHaveLength(1);
    await db.rsvp.delete({ where: { id } });
    expect(await getPublicSoups()).toEqual([]);
  });

  it("returns an empty list on previews without a database", async () => {
    await register();
    vi.stubEnv("DATABASE_URL", "");
    expect(await getPublicSoups()).toEqual([]);
  });
});

describe("public recipes", () => {
  it("are linked from the registry by the soup's id, and only for a soup that has one", async () => {
    const { soupId } = await registerWithRecipe();
    await register("Borscht", "Grace Hopper");

    expect(await getPublicSoups()).toEqual([
      { name: "Borscht", contributorName: "Grace", recipePath: null },
      { name: "Minestrone", contributorName: "Ada and Charles", recipePath: `/soups/${soupId}` },
    ]);
  });

  it("expose the soup, the contributors' first names and the recipe, and nothing else", async () => {
    const { id, editToken, soupId } = await registerWithRecipe();
    const rsvp = await db.rsvp.findUniqueOrThrow({ where: { id } });
    const page = await getPublicRecipe(soupId);

    expect(page).toEqual({ name: "Minestrone", contributorName: "Ada and Charles", ...recipe, photos: [] });
    for (const privateValue of [id, editToken, rsvp.editTokenHash, rsvp.submissionHash!, "Lovelace", "Babbage"]) {
      expect(JSON.stringify(page)).not.toContain(privateValue);
    }
  });

  it("need only a link or only the recipe written out", async () => {
    const link = await registerWithRecipe({ recipeUrl: recipe.recipeUrl });
    expect(await getPublicRecipe(link.soupId)).toMatchObject({ recipeUrl: recipe.recipeUrl, recipeText: null });
    const text = await registerWithRecipe({ recipeText: recipe.recipeText });
    expect(await getPublicRecipe(text.soupId)).toMatchObject({ recipeUrl: null, recipeText: recipe.recipeText });
  });

  it("have no page for a soup without one", async () => {
    const { id } = await register();
    const soup = await db.soup.findUniqueOrThrow({ where: { rsvpId: id } });
    expect(await getPublicRecipe(soup.id)).toBeNull();
  });

  it("are unlisted with a declined guest's soup, and return with it", async () => {
    const { id, soupId } = await registerWithRecipe();
    await db.rsvp.update({ where: { id }, data: { status: "DECLINED", partySize: null } });
    expect(await getPublicRecipe(soupId)).toBeNull();
    expect(await getPublicSoups()).toEqual([]);
    await db.rsvp.update({ where: { id }, data: { status: "ATTENDING", partySize: 2 } });
    expect(await getPublicRecipe(soupId)).toMatchObject(recipe);
  });

  it("are not found by an RSVP's id, another id, or anything that is not one", async () => {
    const { id } = await registerWithRecipe();
    for (const address of [
      id, "00000000-0000-4000-8000-000000000000", "", "minestrone", "' OR 1=1 --", undefined, null, ["x"],
    ]) {
      expect(await getPublicRecipe(address)).toBeNull();
    }
  });

  it("are gone with the RSVP", async () => {
    const { id, soupId } = await registerWithRecipe();
    await db.rsvp.delete({ where: { id } });
    expect(await getPublicRecipe(soupId)).toBeNull();
  });

  it("are absent on previews without a database", async () => {
    const { soupId } = await registerWithRecipe();
    vi.stubEnv("DATABASE_URL", "");
    expect(await getPublicRecipe(soupId)).toBeNull();
  });
});
