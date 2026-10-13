import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { publicGuestNames } from "@/lib/guest-names";
import { isUuid } from "@/lib/uuid";

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
      _count: { select: { photos: true } },
      rsvp: { select: { attendeeName: true, secondName: true } },
    },
  });

  return soups.map(({ id, name, recipeUrl, recipeText, _count, rsvp }) => ({
    name,
    contributorName: publicGuestNames(rsvp),
    // A soup's id is public only as the address of its recipe.
    recipePath: recipeUrl || recipeText || _count.photos ? `/soups/${id}` : null,
  }));
}

/** A soup's recipe page, or null when there is nothing public to show at that address. */
export async function getPublicRecipe(id: unknown) {
  // Checked first, so that only a possible id is ever a cache entry.
  return isUuid(id) ? cachedPublicRecipe(id) : null;
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
  if (!process.env.DATABASE_URL || !isUuid(id)) return null;

  const { db } = await import("@/lib/db");
  const soup = await db.soup.findFirst({
    where: {
      id,
      rsvp: { status: "ATTENDING" },
      OR: [{ recipeUrl: { not: null } }, { recipeText: { not: null } }, { photos: { some: {} } }],
    },
    select: {
      name: true,
      recipeUrl: true,
      recipeText: true,
      // Never the bytes: the photo route serves those, one photo to a request.
      photos: { orderBy: { position: "asc" }, select: { id: true, width: true, height: true } },
      rsvp: { select: { attendeeName: true, secondName: true } },
    },
  });
  if (!soup) return null;

  const { rsvp, photos, ...recipe } = soup;
  return {
    ...recipe,
    contributorName: publicGuestNames(rsvp),
    photos: photos.map((photo) => ({ ...photo, src: `/soups/${id}/photos/${photo.id}` })),
  };
}
