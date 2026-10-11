import "server-only";

import { db } from "@/lib/db";
import { guestNames } from "@/lib/guest-names";
import { requireHost } from "@/lib/host-session";
import { writeRsvp } from "@/lib/rsvp";
import type { RsvpInput } from "@/lib/rsvp-schema";

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
        soup: { select: { name: true, updatedAt: true } },
      },
    }),
    db.event.findUnique({ where: { id: 1 }, select: { timeZone: true } }),
  ]);

  const rsvps = rows.map(({ soup, updatedAt, ...rsvp }) => ({
    ...rsvp,
    // A guest may change only the soup, which leaves the RSVP row as it was.
    updatedAt: soup && soup.updatedAt > updatedAt ? soup.updatedAt : updatedAt,
    soup: soup && { name: soup.name },
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

// Anything else is not an RSVP id, and PostgreSQL would reject it as an error.
function isRsvpId(id: unknown): id is string {
  return typeof id === "string" && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(id);
}

/** One RSVP's answers, for the host to correct. Null when there is none. */
export async function getHostRsvp(id: unknown) {
  await requireHost();
  if (!isRsvpId(id)) return null;
  return db.rsvp.findUnique({
    where: { id },
    select: {
      attendeeName: true,
      secondName: true,
      status: true,
      soup: { select: { name: true } },
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
  if (!isRsvpId(id)) return false;
  return writeRsvp({ id }, input);
}

/**
 * Deletes an RSVP and, with it, its soup. Unlike a guest's cancellation,
 * nothing is kept and the guest's private link stops working. False when the
 * RSVP was already gone.
 */
export async function removeHostRsvp(id: unknown) {
  await requireHost();
  if (!isRsvpId(id)) return false;
  const removed = await db.rsvp.deleteMany({ where: { id } });
  return removed.count === 1;
}
