import { describe, expect, it } from "vitest";

import { toEventDetails } from "@/lib/event-details";

const unset = {
  startsAt: null,
  timeZone: null,
  locationLabel: null,
  address: null,
  mapUrl: null,
  instructions: null,
};

const nothing = {
  start: null,
  locationLabel: null,
  address: null,
  mapUrl: null,
  instructions: null,
};

describe("toEventDetails", () => {
  it("reports nothing for an event that is not configured", () => {
    expect(toEventDetails(unset)).toEqual(nothing);
    expect(toEventDetails(null)).toEqual(nothing);
  });

  it("passes supplied details through unchanged", () => {
    const details = toEventDetails({
      startsAt: new Date("2026-11-14T23:00:00Z"),
      timeZone: "America/New_York",
      locationLabel: "The house",
      address: "1 Example Street\nSpringfield",
      mapUrl: "https://maps.example.com/?q=1+Example+Street",
      instructions: "Bring a ladle.",
    });

    expect(details).toEqual({
      start: {
        iso: "2026-11-14T23:00:00.000Z",
        date: "Saturday, November 14, 2026",
        time: "6:00 PM EST",
      },
      locationLabel: "The house",
      address: "1 Example Street\nSpringfield",
      mapUrl: "https://maps.example.com/?q=1+Example+Street",
      instructions: "Bring a ladle.",
    });
  });

  it("shows the start in the event's zone, not the server's", () => {
    // 03:30 UTC on the 15th is still the evening of the 14th in Los Angeles.
    const { start } = toEventDetails({
      ...unset,
      startsAt: new Date("2026-11-15T03:30:00Z"),
      timeZone: "America/Los_Angeles",
    });

    expect(start?.date).toBe("Saturday, November 14, 2026");
    expect(start?.time).toBe("7:30 PM PST");
  });

  it("has no start without a usable time zone", () => {
    const startsAt = new Date("2026-11-14T23:00:00Z");

    expect(toEventDetails({ ...unset, startsAt }).start).toBeNull();
    expect(toEventDetails({ ...unset, startsAt, timeZone: "Soup/Standard" }).start).toBeNull();
  });

  it("treats blank text as unset", () => {
    expect(
      toEventDetails({ ...unset, locationLabel: "  ", address: "", instructions: "\n" }),
    ).toEqual(nothing);
  });

  it("trims surrounding whitespace", () => {
    expect(toEventDetails({ ...unset, address: " 1 Example Street\n" }).address).toBe(
      "1 Example Street",
    );
  });

  it("only links to web addresses", () => {
    expect(toEventDetails({ ...unset, mapUrl: "javascript:alert(1)" }).mapUrl).toBeNull();
    expect(toEventDetails({ ...unset, mapUrl: "maps.example.com" }).mapUrl).toBeNull();
    expect(toEventDetails({ ...unset, mapUrl: "http://maps.example.com" }).mapUrl).toBe(
      "http://maps.example.com",
    );
  });
});
