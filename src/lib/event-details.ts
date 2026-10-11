import type { Event } from "@/generated/prisma/client";

type EventFields = Pick<
  Event,
  "startsAt" | "timeZone" | "locationLabel" | "address" | "mapUrl" | "instructions"
>;

/** What the homepage shows about the event. A null field is not known yet. */
export type EventDetails = {
  start: {
    /** The instant, for a `<time>` element. */
    iso: string;
    /** e.g. "Saturday, November 14, 2026" */
    date: string;
    /** e.g. "6:00 PM EST" */
    time: string;
  } | null;
  locationLabel: string | null;
  address: string | null;
  mapUrl: string | null;
  instructions: string | null;
};

function text(value: string | null) {
  return value?.trim() || null;
}

function formatStart(startsAt: Date | null, timeZone: string | null): EventDetails["start"] {
  if (!startsAt || !timeZone) return null;

  try {
    return {
      iso: startsAt.toISOString(),
      date: new Intl.DateTimeFormat("en-US", {
        timeZone,
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(startsAt),
      time: new Intl.DateTimeFormat("en-US", {
        timeZone,
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      }).format(startsAt),
    };
  } catch {
    // An unrecognized zone. Showing nothing beats showing the wrong hour.
    return null;
  }
}

function webUrl(value: string | null) {
  const url = text(value);
  if (!url || !URL.canParse(url)) return null;
  return ["http:", "https:"].includes(new URL(url).protocol) ? url : null;
}

/**
 * Reduces the event row to what is safe to display. Anything unset, blank or
 * unusable becomes null rather than a guess.
 */
export function toEventDetails(event: EventFields | null): EventDetails {
  return {
    start: formatStart(event?.startsAt ?? null, event?.timeZone ?? null),
    locationLabel: text(event?.locationLabel ?? null),
    address: text(event?.address ?? null),
    mapUrl: webUrl(event?.mapUrl ?? null),
    instructions: text(event?.instructions ?? null),
  };
}
