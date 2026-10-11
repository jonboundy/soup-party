import { describe, expect, it } from "vitest";

import { NAME_MAX_LENGTH, SOUP_NAME_MAX_LENGTH } from "@/lib/rsvp-form";
import { parseRsvp } from "@/lib/rsvp-schema";

// A guest who is coming alone and has not chosen a soup.
const attending = {
  name: "Ada Lovelace",
  secondName: "",
  attendance: "attending",
  soupName: "",
};

function errorsFor(input: Partial<Record<keyof typeof attending, unknown>>) {
  const result = parseRsvp({ ...attending, ...input });
  return result.success ? {} : result.errors;
}

describe("parseRsvp", () => {
  it("accepts an attending guest on their own", () => {
    expect(parseRsvp(attending)).toEqual({
      success: true,
      data: { attendeeName: "Ada Lovelace", secondName: null, status: "ATTENDING", soup: null },
    });
  });

  it("accepts two guests responding together", () => {
    expect(parseRsvp({ ...attending, secondName: " Charles  Babbage " })).toEqual({
      success: true,
      data: {
        attendeeName: "Ada Lovelace",
        secondName: "Charles Babbage",
        status: "ATTENDING",
        soup: null,
      },
    });
  });

  it("treats a blank or missing second name as one guest", () => {
    for (const secondName of ["", "   ", "\n", null, undefined]) {
      expect(parseRsvp({ ...attending, secondName })).toMatchObject({
        success: true,
        data: { secondName: null },
      });
    }
  });

  it("keeps both names when declining", () => {
    expect(
      parseRsvp({ ...attending, secondName: "Charles Babbage", attendance: "declined" }),
    ).toEqual({
      success: true,
      data: {
        attendeeName: "Ada Lovelace",
        secondName: "Charles Babbage",
        status: "DECLINED",
        soup: null,
      },
    });
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

  it("limits the length of both names", () => {
    const longest = "a".repeat(NAME_MAX_LENGTH);
    expect(errorsFor({ name: longest, secondName: longest })).toEqual({});
    expect(errorsFor({ name: `${longest}a`, secondName: `${longest}a` })).toEqual({
      name: `Use ${NAME_MAX_LENGTH} characters or fewer.`,
      secondName: `Use ${NAME_MAX_LENGTH} characters or fewer.`,
    });
  });

  it("rejects a second name that is not text", () => {
    expect(errorsFor({ secondName: 7 })).toEqual({ secondName: "Enter their name." });
    expect(errorsFor({ secondName: "Charles\0Babbage" })).toEqual({
      secondName: "Enter their name without control characters.",
    });
  });

  it("requires one of the two answers", () => {
    for (const attendance of ["", "maybe", "ATTENDING", null, undefined]) {
      expect(errorsFor({ attendance })).toEqual({
        attendance: "Say whether you will be there.",
      });
    }
  });

  it("reports every problem at once", () => {
    expect(errorsFor({ name: "", secondName: 7, attendance: null })).toEqual({
      name: "Enter your name.",
      secondName: "Enter their name.",
      attendance: "Say whether you will be there.",
    });
  });

  it("accepts a soup by its name", () => {
    expect(parseRsvp({ ...attending, soupName: "Minestrone" })).toMatchObject({
      success: true,
      data: { status: "ATTENDING", soup: { name: "Minestrone" } },
    });
  });

  it("lets an attending guest decide on the soup later", () => {
    for (const soupName of ["", "   ", "\n", null, undefined]) {
      expect(parseRsvp({ ...attending, soupName })).toMatchObject({
        success: true,
        data: { status: "ATTENDING", soup: null },
      });
    }
  });

  it("gives a declining guest no soup, whatever was sent", () => {
    for (const soupName of ["Minestrone", 7, "a".repeat(SOUP_NAME_MAX_LENGTH + 1)]) {
      expect(parseRsvp({ ...attending, soupName, attendance: "declined" })).toEqual({
        success: true,
        data: { attendeeName: "Ada Lovelace", secondName: null, status: "DECLINED", soup: null },
      });
    }
  });

  it("tidies whitespace in the soup's name", () => {
    const result = parseRsvp({ ...attending, soupName: "  Chicken \t noodle\n" });

    expect(result).toMatchObject({ data: { soup: { name: "Chicken noodle" } } });
  });

  it("limits the length of the soup's name", () => {
    expect(errorsFor({ soupName: "a".repeat(SOUP_NAME_MAX_LENGTH) })).toEqual({});
    expect(errorsFor({ soupName: "a".repeat(SOUP_NAME_MAX_LENGTH + 1) })).toEqual({
      soupName: `Use ${SOUP_NAME_MAX_LENGTH} characters or fewer.`,
    });
  });

  it("rejects a soup name that is not text", () => {
    expect(errorsFor({ soupName: 7 })).toEqual({ soupName: "Enter the name of the soup." });
  });

  it("reports problems with the guest and the soup together", () => {
    expect(errorsFor({ name: "", soupName: 7 })).toEqual({
      name: "Enter your name.",
      soupName: "Enter the name of the soup.",
    });
  });
});
