import { db } from "@/lib/db";

/**
 * Deletes every RSVP, and with them every soup, along with rate limits and
 * host sessions. Refuses outside a test database.
 */
export async function clearRsvps() {
  const [{ name }] = await db.$queryRaw<{ name: string }[]>`SELECT current_database() AS name`;
  if (!name.endsWith("_test")) {
    throw new Error(`Refusing to clear "${name}": not a test database.`);
  }
  await db.rsvp.deleteMany();
  await db.rsvpRateLimit.deleteMany();
  await db.hostSession.deleteMany();
}
