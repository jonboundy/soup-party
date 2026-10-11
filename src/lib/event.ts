import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { toEventDetails } from "@/lib/event-details";

/**
 * The event's details for display. Cached, so an edit to the `events` row
 * reaches the site within about a minute.
 */
export async function getEventDetails() {
  "use cache";
  cacheLife("minutes");
  cacheTag("event");

  // Preview deployments have no database. They show every detail as unset.
  if (!process.env.DATABASE_URL) {
    return toEventDetails(null);
  }

  // Imported here because the client cannot be constructed without a database.
  const { db } = await import("@/lib/db");
  return toEventDetails(await db.event.findUnique({ where: { id: 1 } }));
}
