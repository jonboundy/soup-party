import "server-only";

import { db } from "@/lib/db";
import { requireHost } from "@/lib/host-session";

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
        status: true,
        partySize: true,
        createdAt: true,
        updatedAt: true,
        soup: { select: { name: true, category: true, description: true, updatedAt: true } },
      },
    }),
    db.event.findUnique({ where: { id: 1 }, select: { timeZone: true } }),
  ]);

  const rsvps = rows.map(({ soup, updatedAt, ...rsvp }) => ({
    ...rsvp,
    // A guest may change only the soup, which leaves the RSVP row as it was.
    updatedAt: soup && soup.updatedAt > updatedAt ? soup.updatedAt : updatedAt,
    soup: soup && { name: soup.name, category: soup.category, description: soup.description },
  }));
  const attending = rsvps.filter(({ status }) => status === "ATTENDING");
  const declined = rsvps.filter(({ status }) => status === "DECLINED");
  // A soup is active only while its RSVP is attending, as in the public registry.
  const soups = attending
    .flatMap(({ soup, attendeeName }) => (soup ? [{ ...soup, attendeeName }] : []))
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
