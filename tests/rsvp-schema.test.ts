import { describe, expect, it } from "vitest";

import { MAX_PARTY_SIZE, NAME_MAX_LENGTH } from "@/lib/rsvp-form";
import { parseRsvp } from "@/lib/rsvp-schema";

const attending = { name: "Ada Lovelace", attendance: "attending", partySize: "2" };

function errorsFor(input: Partial<Record<keyof typeof attending, unknown>>) {
  const result = parseRsvp({ ...attending, ...input });
  return result.success ? {} : result.errors;
}

describe("parseRsvp", () => {
  it("accepts an attending guest with a party size", () => {
    expect(parseRsvp(attending)).toEqual({
      success: true,
      data: { attendeeName: "Ada Lovelace", status: "ATTENDING", partySize: 2 },
    });
  });

  it("accepts a party of one and a party of the maximum", () => {
    expect(errorsFor({ partySize: "1" })).toEqual({});
    expect(errorsFor({ partySize: String(MAX_PARTY_SIZE) })).toEqual({});
  });

  it("gives a declining guest no party size, whatever was sent", () => {
    for (const partySize of ["4", "", "many", null]) {
      expect(parseRsvp({ ...attending, attendance: "declined", partySize })).toEqual({
        success: true,
        data: { attendeeName: "Ada Lovelace", status: "DECLINED", partySize: null },
      });
    }
  });

  it("tidies whitespace in the name", () => {
    const result = parseRsvp({ ...attending, name: "  Ada \t Lovelace\n" });

    expect(result).toMatchObject({ data: { attendeeName: "Ada Lovelace" } });
  });

  it("requires a name", () => {
    for (const name of ["", "   ", null, undefined, 7]) {
      expect(errorsFor({ name })).toEqual({ name: "Enter your name." });
    }
  });

  it("limits the length of the name", () => {
    expect(errorsFor({ name: "a".repeat(NAME_MAX_LENGTH) })).toEqual({});
    expect(errorsFor({ name: "a".repeat(NAME_MAX_LENGTH + 1) })).toEqual({
      name: `Use ${NAME_MAX_LENGTH} characters or fewer.`,
    });
  });

  it("requires one of the two answers", () => {
    for (const attendance of ["", "maybe", "ATTENDING", null, undefined]) {
      expect(errorsFor({ attendance })).toEqual({
        attendance: "Say whether you will be there.",
      });
    }
  });

  it("requires a whole party size when attending", () => {
    for (const partySize of ["", "two", "2.5", "-1", " 2", "1e1", null, undefined, 2]) {
      expect(errorsFor({ partySize })).toEqual({ partySize: "Choose a party size." });
    }
  });

  it("keeps the party size within bounds", () => {
    expect(errorsFor({ partySize: "0" })).toEqual({
      partySize: "A party is at least 1 person.",
    });
    expect(errorsFor({ partySize: String(MAX_PARTY_SIZE + 1) })).toEqual({
      partySize: `A party is at most ${MAX_PARTY_SIZE} people.`,
    });
  });

  it("reports every problem at once", () => {
    expect(errorsFor({ name: "", partySize: "0" })).toEqual({
      name: "Enter your name.",
      partySize: "A party is at least 1 person.",
    });
    expect(errorsFor({ name: "", attendance: null, partySize: null })).toEqual({
      name: "Enter your name.",
      attendance: "Say whether you will be there.",
    });
  });
});
