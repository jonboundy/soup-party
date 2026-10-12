import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { publicGuestNames } from "@/lib/guest-names";

/** Only deliberate public fields leave this function. */
export async function getPublicSoups() {
  "use cache";
  // Keep the list in the initial HTML so it is readable without JavaScript.
  // Brief revalidation keeps other visits current; registrations expire the tag.
  cacheLife({ stale: 300, revalidate: 1, expire: 300 });
  cacheTag("soups");

  return readPublicSoups();
}

/** Fresh public projection for pre-submission checks, outside the registry cache. */
export async function readPublicSoups(excludeEditTokenHash?: string) {
  // Preview deployments have no database.
  if (!process.env.DATABASE_URL) return [];

  const { db } = await import("@/lib/db");
  const soups = await db.soup.findMany({
    where: { rsvp: {
      status: "ATTENDING",
      ...(excludeEditTokenHash ? { editTokenHash: { not: excludeEditTokenHash } } : {}),
    } },
    orderBy: [{ name: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      recipeUrl: true,
      recipeText: true,
      rsvp: { select: { attendeeName: true, secondName: true } },
    },
  });

  return soups.map(({ id, name, recipeUrl, recipeText, rsvp }) => ({
    name,
    contributorName: publicGuestNames(rsvp),
    // A soup's id is public only as the address of its recipe.
    recipePath: recipeUrl || recipeText ? `/soups/${id}` : null,
  }));
}

// Anything else is not a soup id, and PostgreSQL would reject it as an error.
function isSoupId(id: unknown): id is string {
  return typeof id === "string" && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(id);
}

/** A soup's recipe page, or null when there is nothing public to show at that address. */
export async function getPublicRecipe(id: unknown) {
  // Checked first, so that only a possible id is ever a cache entry.
  return isSoupId(id) ? cachedPublicRecipe(id) : null;
}

async function cachedPublicRecipe(id: string) {
  "use cache";
  // Expired with the registry: the same writes change both.
  cacheLife({ stale: 300, revalidate: 1, expire: 300 });
  cacheTag("soups");

  return readPublicRecipe(id);
}

/**
 * Null for anything but an active soup with a recipe, so a declined guest's
 * recipe is no more public than their soup.
 */
export async function readPublicRecipe(id: unknown) {
  // Previews have no database, and so no recipes.
  if (!process.env.DATABASE_URL || !isSoupId(id)) return null;

  const { db } = await import("@/lib/db");
  const soup = await db.soup.findFirst({
    where: {
      id,
      rsvp: { status: "ATTENDING" },
      OR: [{ recipeUrl: { not: null } }, { recipeText: { not: null } }],
    },
    select: {
      name: true,
      recipeUrl: true,
      recipeText: true,
      rsvp: { select: { attendeeName: true, secondName: true } },
    },
  });
  if (!soup) return null;

  const { rsvp, ...recipe } = soup;
  return { ...recipe, contributorName: publicGuestNames(rsvp) };
}
