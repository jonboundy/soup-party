import { describe, expect, it } from "vitest";

import {
  NAME_MAX_LENGTH,
  RECIPE_TEXT_MAX_LENGTH,
  RECIPE_URL_MAX_LENGTH,
  SOUP_NAME_MAX_LENGTH,
} from "@/lib/rsvp-form";
import { parseRsvp } from "@/lib/rsvp-schema";

// A guest who is coming alone and has not chosen a soup.
const attending = {
  name: "Ada Lovelace",
  secondName: "",
  attendance: "attending",
  soupName: "",
  recipeUrl: "",
  recipeText: "",
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
      data: { status: "ATTENDING", soup: { name: "Minestrone", recipeUrl: null, recipeText: null } },
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

  describe("a recipe", () => {
    const minestrone = { ...attending, soupName: "Minestrone" };
    const recipeOf = (input: Record<string, unknown>) => {
      const result = parseRsvp({ ...minestrone, ...input });
      if (!result.success) throw new Error(JSON.stringify(result.errors));
      return { recipeUrl: result.data.soup?.recipeUrl, recipeText: result.data.soup?.recipeText };
    };
    const address = "Enter a web address, such as https://example.com/soup.";

    it("may be a link, the recipe written out, or both", () => {
      const recipeUrl = "https://example.com/minestrone";
      expect(recipeOf({ recipeUrl })).toEqual({ recipeUrl, recipeText: null });
      expect(recipeOf({ recipeText: "Simmer." })).toEqual({ recipeUrl: null, recipeText: "Simmer." });
      expect(recipeOf({ recipeUrl, recipeText: "Simmer." })).toEqual({ recipeUrl, recipeText: "Simmer." });
    });

    it("is optional, and blank or missing fields are no recipe", () => {
      for (const blank of ["", "  ", "\n \n", null, undefined]) {
        expect(recipeOf({ recipeUrl: blank, recipeText: blank })).toEqual({ recipeUrl: null, recipeText: null });
      }
    });

    it("assumes https for an address pasted without a scheme", () => {
      expect(recipeOf({ recipeUrl: "  example.com/soup?id=1 " }).recipeUrl).toBe("https://example.com/soup?id=1");
      expect(recipeOf({ recipeUrl: "//example.com/soup" }).recipeUrl).toBe("https://example.com/soup");
      expect(recipeOf({ recipeUrl: "HTTP://Example.com" }).recipeUrl).toBe("http://example.com/");
    });

    it("stores an address with nothing a link cannot hold", () => {
      expect(recipeOf({ recipeUrl: "https://example.com/my soup" }).recipeUrl).toBe("https://example.com/my%20soup");
    });

    it("accepts only a web address as the link", () => {
      for (const recipeUrl of [
        "javascript:alert(1)", "data:text/html,soup", "mailto:ada@example.com", "ftp://example.com/soup",
        "file:///etc/passwd", "example.com:8080/soup", "https://", "minestrone", "https://localhost/soup",
        "https://ada:secret@example.com/soup", "my grandmother's recipe", "https://exa\0mple.com", 7, ["https://example.com"],
      ]) {
        expect(errorsFor({ soupName: "Minestrone", recipeUrl })).toEqual({ recipeUrl: address });
      }
    });

    it("limits the length of the link", () => {
      const longest = `https://example.com/${"a".repeat(RECIPE_URL_MAX_LENGTH - 20)}`;
      expect(recipeOf({ recipeUrl: longest }).recipeUrl).toBe(longest);
      expect(errorsFor({ soupName: "Minestrone", recipeUrl: `${longest}a` })).toEqual({
        recipeUrl: `Use ${RECIPE_URL_MAX_LENGTH} characters or fewer.`,
      });
    });

    it("keeps the written recipe's lines and paragraphs, and tidies around them", () => {
      const recipeText = "\r\n  Ingredients \r\n- beans\t\r- pasta\n\n\n\n  Simmer for an hour.  \n\n";
      expect(recipeOf({ recipeText }).recipeText).toBe("  Ingredients\n- beans\n- pasta\n\n  Simmer for an hour.");
    });

    it("limits the length of the written recipe, counted after tidying", () => {
      const longest = "a".repeat(RECIPE_TEXT_MAX_LENGTH);
      expect(recipeOf({ recipeText: `\n${longest}  \n` }).recipeText).toBe(longest);
      expect(errorsFor({ soupName: "Minestrone", recipeText: `${longest}a` })).toEqual({
        recipeText: "Use 10,000 characters or fewer.",
      });
    });

    it("rejects a written recipe that is not text", () => {
      expect(errorsFor({ soupName: "Minestrone", recipeText: 7 })).toEqual({ recipeText: "Enter the recipe." });
      expect(errorsFor({ soupName: "Minestrone", recipeText: "Sim\0mer" })).toEqual({
        recipeText: "Enter the recipe without control characters.",
      });
    });

    it("tidies a long run of spaces without slowing down", () => {
      const started = performance.now();
      errorsFor({ soupName: "Minestrone", recipeText: `${" ".repeat(900_000)}x` });
      expect(performance.now() - started).toBeLessThan(1000);
    });

    it("needs a soup to be the recipe for", () => {
      for (const recipe of [{ recipeUrl: "example.com/soup" }, { recipeText: "Simmer." }]) {
        expect(errorsFor(recipe)).toEqual({ soupName: "Name the soup this recipe is for." });
      }
    });

    it("is ignored on a decline, whatever was sent", () => {
      expect(
        parseRsvp({ ...minestrone, attendance: "declined", recipeUrl: "javascript:alert(1)", recipeText: 7 }),
      ).toEqual({
        success: true,
        data: { attendeeName: "Ada Lovelace", secondName: null, status: "DECLINED", soup: null },
      });
    });
  });
});
