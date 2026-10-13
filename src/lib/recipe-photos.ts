import "server-only";

import { db } from "@/lib/db";
import type { Jpeg } from "@/lib/jpeg";
import { RECIPE_PHOTO_LIMIT, type RecipePhotoRef } from "@/lib/recipe-photo";
import { isUuid } from "@/lib/uuid";

/**
 * The RSVP whose soup the photos belong to. The caller has already
 * authorized it: a guest by the token behind the hash, the host by their
 * session.
 */
type Owner = { editTokenHash: string } | { id: string };

function photoPath(soupId: string, photoId: string) {
  return `/soups/${soupId}/photos/${photoId}`;
}

/** The photos of an RSVP's soup, in the order the recipe page shows them. */
export async function listRecipePhotos(owner: Owner): Promise<RecipePhotoRef[]> {
  const soup = await db.soup.findFirst({
    where: { rsvp: owner },
    select: {
      id: true,
      rsvp: { select: { status: true } },
      // Never the bytes: only the route that serves a photo reads those.
      photos: { orderBy: { position: "asc" }, select: { id: true } },
    },
  });
  if (!soup) return [];
  // A declined guest's photos are kept but, like their soup, are not public.
  const listed = soup.rsvp.status === "ATTENDING";
  return soup.photos.map(({ id }) => ({ id, src: listed ? photoPath(soup.id, id) : null }));
}

/**
 * Adds a photo to an RSVP's soup, in the first free place. The unique
 * (soup, position) index is what keeps a soup to its limit: two uploads
 * racing for one place cannot both have it, and the loser tries the next.
 */
export async function addRecipePhoto(
  owner: Owner,
  { bytes, width, height }: Jpeg,
): Promise<{ status: "saved"; photo: RecipePhotoRef } | { status: "full" | "no-soup" }> {
  for (let attempt = 0; attempt <= RECIPE_PHOTO_LIMIT; attempt++) {
    const soup = await db.soup.findFirst({
      where: { rsvp: owner },
      select: { id: true, rsvp: { select: { status: true } }, photos: { select: { position: true } } },
    });
    if (!soup) return { status: "no-soup" };
    const taken = new Set(soup.photos.map(({ position }) => position));
    const position = Array.from({ length: RECIPE_PHOTO_LIMIT }, (_, index) => index).find(
      (index) => !taken.has(index),
    );
    if (position === undefined) return { status: "full" };
    try {
      const { id } = await db.recipePhoto.create({
        data: { soupId: soup.id, position, bytes, width, height },
        select: { id: true },
      });
      const src = soup.rsvp.status === "ATTENDING" ? photoPath(soup.id, id) : null;
      return { status: "saved", photo: { id, src } };
    } catch (error) {
      const code = (error as { code?: string })?.code;
      // The soup was removed in the meantime.
      if (code === "P2003") return { status: "no-soup" };
      // Another upload took the place. Look again.
      if (code !== "P2002") throw error;
    }
  }
  return { status: "full" };
}

/**
 * Removes a photo, if it is one of this RSVP's soup's. Removing one that is
 * already gone is not an error, so a repeated request is safe.
 */
export async function removeRecipePhoto(owner: Owner, photoId: unknown) {
  if (!isUuid(photoId)) return;
  await db.recipePhoto.deleteMany({ where: { id: photoId, soup: { rsvp: owner } } });
}

/**
 * A photo's bytes for anyone who asks, or null unless it belongs to that
 * soup and the soup is active: a declined guest's photos are no more public
 * than their soup.
 */
export async function readPublicRecipePhoto(soupId: unknown, photoId: unknown) {
  if (!isUuid(soupId) || !isUuid(photoId)) return null;
  const photo = await db.recipePhoto.findFirst({
    where: { id: photoId, soupId, soup: { rsvp: { status: "ATTENDING" } } },
    select: { bytes: true },
  });
  return photo?.bytes ?? null;
}
