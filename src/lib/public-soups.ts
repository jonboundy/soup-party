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
      name: true,
      rsvp: { select: { attendeeName: true, secondName: true } },
    },
  });

  return soups.map(({ rsvp, ...soup }) => ({ ...soup, contributorName: publicGuestNames(rsvp) }));
}
