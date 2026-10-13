import "server-only";

import { db } from "@/lib/db";
import { guestNames } from "@/lib/guest-names";
import { requireHost } from "@/lib/host-session";
import type { Jpeg } from "@/lib/jpeg";
import { addRecipePhoto, listRecipePhotos, removeRecipePhoto } from "@/lib/recipe-photos";
import { writeRsvp } from "@/lib/rsvp";
import type { RsvpInput } from "@/lib/rsvp-schema";
import { isUuid } from "@/lib/uuid";

/**
 * Every RSVP as the host sees it, with the figures counted from that same
 * read so they cannot disagree with the lists. Read from the database on each
 * request and never cached, so it is current whenever the page is loaded.
 * Edit-token and submission hashes are never selected.
 */
export async function getHostOverview() {
  await requireHost();

  const [rows, event] = await Promise.all([
    db.rsvp.findMany({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        attendeeName: true,
        secondName: true,
        status: true,
        partySize: true,
        createdAt: true,
        updatedAt: true,
        soup: {
          select: {
            id: true,
            name: true,
            recipeUrl: true,
            recipeText: true,
            updatedAt: true,
            _count: { select: { photos: true } },
          },
        },
      },
    }),
    db.event.findUnique({ where: { id: 1 }, select: { timeZone: true } }),
  ]);

  const rsvps = rows.map(({ soup, updatedAt, ...rsvp }) => ({
    ...rsvp,
    // A guest may change only the soup, which leaves the RSVP row as it was.
    updatedAt: soup && soup.updatedAt > updatedAt ? soup.updatedAt : updatedAt,
    // The id is public once there is a recipe: it is the recipe page's address.
    soup: soup && {
      name: soup.name,
      recipePath:
        soup.recipeUrl || soup.recipeText || soup._count.photos ? `/soups/${soup.id}` : null,
    },
  }));
  const attending = rsvps.filter(({ status }) => status === "ATTENDING");
  const declined = rsvps.filter(({ status }) => status === "DECLINED");
  // A soup is active only while its RSVP is attending, as in the public registry.
  const soups = attending
    .flatMap(({ soup, ...rsvp }) => (soup ? [{ ...soup, guests: guestNames(rsvp) }] : []))
    .sort((a, b) => a.name.localeCompare(b.name, "en"));
  const undecided = attending.filter(({ soup }) => !soup);

  return {
    counts: {
      guests: attending.reduce((total, { partySize }) => total + (partySize ?? 0), 0),
      attending: attending.length,
      declined: declined.length,
      soups: soups.length,
      undecided: undecided.length,
    },
    attending,
    declined,
    soups,
    undecided,
    /** IANA zone for showing when responses arrived. Null until the event has one. */
    timeZone: event?.timeZone ?? null,
  };
}

export type HostOverview = Awaited<ReturnType<typeof getHostOverview>>;
export type HostRsvp = HostOverview["attending"][number];

/** One RSVP's answers, for the host to correct. Null when there is none. */
export async function getHostRsvp(id: unknown) {
  await requireHost();
  if (!isUuid(id)) return null;
  return db.rsvp.findUnique({
    where: { id },
    select: {
      attendeeName: true,
      secondName: true,
      status: true,
      soup: { select: { name: true, recipeUrl: true, recipeText: true } },
    },
  });
}

/**
 * Replaces a guest's answers with the host's correction, under the rules a
 * guest's own edit follows. The guest's private link is untouched and keeps
 * working. False when the RSVP is gone.
 */
export async function updateHostRsvp(id: unknown, input: RsvpInput) {
  await requireHost();
  if (!isUuid(id)) return false;
  return writeRsvp({ id }, input);
}

/**
 * Deletes an RSVP and, with it, its soup. Unlike a guest's cancellation,
 * nothing is kept and the guest's private link stops working. False when the
 * RSVP was already gone.
 */
export async function removeHostRsvp(id: unknown) {
  await requireHost();
  if (!isUuid(id)) return false;
  const removed = await db.rsvp.deleteMany({ where: { id } });
  return removed.count === 1;
}

/** The photos of a guest's recipe, for the host's editor. */
export async function listHostRecipePhotos(id: unknown) {
  await requireHost();
  return isUuid(id) ? listRecipePhotos({ id }) : [];
}

/** Adds a photo to a guest's recipe, as the guest could with their link. */
export async function addHostRecipePhoto(id: unknown, photo: Jpeg) {
  await requireHost();
  if (!isUuid(id)) return { status: "no-soup" as const };
  return addRecipePhoto({ id }, photo);
}

/** Removes a photo from a guest's recipe. Nothing happens if it is not theirs. */
export async function removeHostRecipePhoto(id: unknown, photoId: unknown) {
  await requireHost();
  if (isUuid(id)) await removeRecipePhoto({ id }, photoId);
}
