import { describe, expect, it } from "vitest";

import {
  MAX_PARTY_SIZE,
  NAME_MAX_LENGTH,
  SOUP_DESCRIPTION_MAX_LENGTH,
  SOUP_NAME_MAX_LENGTH,
} from "@/lib/rsvp-form";
import { parseRsvp } from "@/lib/rsvp-schema";
import { SOUP_CATEGORIES } from "@/lib/soup-categories";

// A guest who is coming and has not chosen a soup.
const attending = {
  name: "Ada Lovelace",
  attendance: "attending",
  partySize: "2",
  soupName: "",
  soupCategory: "",
  soupDescription: "",
};

const minestrone = {
  soupName: "Minestrone",
  soupCategory: "VEGETABLE",
  soupDescription: "No pasta.",
};

function errorsFor(input: Partial<Record<keyof typeof attending, unknown>>) {
  const result = parseRsvp({ ...attending, ...input });
  return result.success ? {} : result.errors;
}

describe("parseRsvp", () => {
  it("accepts an attending guest with a party size", () => {
    expect(parseRsvp(attending)).toEqual({
      success: true,
      data: { attendeeName: "Ada Lovelace", status: "ATTENDING", partySize: 2, soup: null },
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
        data: { attendeeName: "Ada Lovelace", status: "DECLINED", partySize: null, soup: null },
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

  it("accepts a soup with a name, a category and a description", () => {
    expect(parseRsvp({ ...attending, ...minestrone })).toMatchObject({
      success: true,
      data: {
        status: "ATTENDING",
        soup: { name: "Minestrone", category: "VEGETABLE", description: "No pasta." },
      },
    });
  });

  it("accepts every category", () => {
    for (const { value } of SOUP_CATEGORIES) {
      expect(parseRsvp({ ...attending, ...minestrone, soupCategory: value })).toMatchObject({
        data: { soup: { category: value } },
      });
    }
  });

  it("lets an attending guest decide on the soup later", () => {
    for (const soupName of ["", "   ", "\n", null, undefined]) {
      expect(parseRsvp({ ...attending, soupName })).toMatchObject({
        success: true,
        data: { status: "ATTENDING", soup: null },
      });
    }
  });

  it("ignores a category and description sent without a soup name", () => {
    for (const soupCategory of ["VEGETABLE", "SALAD", null]) {
      expect(
        parseRsvp({
          ...attending,
          soupCategory,
          soupDescription: "x".repeat(SOUP_DESCRIPTION_MAX_LENGTH + 1),
        }),
      ).toMatchObject({ success: true, data: { soup: null } });
    }
  });

  it("gives a declining guest no soup, whatever was sent", () => {
    for (const soup of [minestrone, { soupName: 7, soupCategory: "SALAD", soupDescription: null }]) {
      expect(parseRsvp({ ...attending, ...soup, attendance: "declined" })).toEqual({
        success: true,
        data: { attendeeName: "Ada Lovelace", status: "DECLINED", partySize: null, soup: null },
      });
    }
  });

  it("tidies whitespace in the soup's name and description", () => {
    const result = parseRsvp({
      ...attending,
      ...minestrone,
      soupName: "  Chicken \t noodle\n",
      soupDescription: " With dill.\n\nNo celery. ",
    });

    expect(result).toMatchObject({
      data: { soup: { name: "Chicken noodle", description: "With dill. No celery." } },
    });
  });

  it("stores no description when it is left blank", () => {
    for (const soupDescription of ["", "  \n ", null, undefined]) {
      expect(parseRsvp({ ...attending, ...minestrone, soupDescription })).toMatchObject({
        success: true,
        data: { soup: { name: "Minestrone", description: null } },
      });
    }
  });

  it("requires a category once the soup has a name", () => {
    for (const soupCategory of ["", "SALAD", "vegetable", null, undefined, 3]) {
      expect(errorsFor({ ...minestrone, soupCategory })).toEqual({
        soupCategory: "Choose a category.",
      });
    }
  });

  it("limits the length of the soup's name and description", () => {
    expect(
      errorsFor({
        ...minestrone,
        soupName: "a".repeat(SOUP_NAME_MAX_LENGTH),
        soupDescription: "a".repeat(SOUP_DESCRIPTION_MAX_LENGTH),
      }),
    ).toEqual({});
    expect(
      errorsFor({
        ...minestrone,
        soupName: "a".repeat(SOUP_NAME_MAX_LENGTH + 1),
        soupDescription: "a".repeat(SOUP_DESCRIPTION_MAX_LENGTH + 1),
      }),
    ).toEqual({
      soupName: `Use ${SOUP_NAME_MAX_LENGTH} characters or fewer.`,
      soupDescription: `Use ${SOUP_DESCRIPTION_MAX_LENGTH} characters or fewer.`,
    });
  });

  it("rejects a soup name or description that is not text", () => {
    expect(errorsFor({ ...minestrone, soupName: 7, soupDescription: 7 })).toEqual({
      soupName: "Enter the name of the soup.",
      soupDescription: "Describe the soup in words.",
    });
  });

  it("reports problems with the guest and the soup together", () => {
    expect(errorsFor({ ...minestrone, name: "", partySize: "0", soupCategory: "" })).toEqual({
      name: "Enter your name.",
      partySize: "A party is at least 1 person.",
      soupCategory: "Choose a category.",
    });
  });
});
