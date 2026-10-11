import { describe, expect, it } from "vitest";

import { guestNames, publicGuestNames } from "@/lib/guest-names";

const ada = { attendeeName: "Ada Lovelace", secondName: null };
const couple = { attendeeName: "Ada Lovelace", secondName: "Charles Babbage" };

describe("guest names", () => {
  it("names one guest or both in full", () => {
    expect(guestNames(ada)).toBe("Ada Lovelace");
    expect(guestNames(couple)).toBe("Ada Lovelace and Charles Babbage");
  });

  it("shows the public first names only", () => {
    expect(publicGuestNames(ada)).toBe("Ada");
    expect(publicGuestNames(couple)).toBe("Ada and Charles");
    expect(publicGuestNames({ attendeeName: "李", secondName: "Mary Ann Evans" })).toBe("李 and Mary");
  });
});
