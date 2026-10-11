import { describe, expect, it } from "vitest";

import { normalizeSoupName } from "@/lib/soup-name";

describe("normalizeSoupName", () => {
  it("ignores case and spacing", () => {
    expect(normalizeSoupName("  Chicken   NOODLE\t")).toBe("chicken noodle");
  });

  it("ignores punctuation", () => {
    expect(normalizeSoupName("Chicken-noodle!")).toBe("chicken noodle");
    expect(normalizeSoupName("Tomato (roasted), basil.")).toBe("tomato roasted basil");
    expect(normalizeSoupName("Ham & bean")).toBe(normalizeSoupName("Ham and bean"));
  });

  it("closes up apostrophes", () => {
    for (const name of ["Mom's chili", "Mom’s chili", "Moms chili"]) {
      expect(normalizeSoupName(name)).toBe("moms chili");
    }
  });

  it("ignores accents", () => {
    expect(normalizeSoupName("Phở")).toBe("pho");
    expect(normalizeSoupName("Velouté de légumes")).toBe("veloute de legumes");
  });

  it("drops a trailing soup", () => {
    for (const name of ["Minestrone soup", "Minestrone Soup.", "minestrone soups", "Minestrone"]) {
      expect(normalizeSoupName(name)).toBe("minestrone");
    }
  });

  it("keeps soup anywhere else", () => {
    expect(normalizeSoupName("Soup of the day")).toBe("soup of the day");
    expect(normalizeSoupName("Soupe à l’oignon")).toBe("soupe a loignon");
    expect(normalizeSoupName("Soup")).toBe("soup");
    expect(normalizeSoupName("Soup soup")).toBe("soup");
  });

  it("keeps names in other scripts", () => {
    expect(normalizeSoupName("Борщ")).toBe("борщ");
    expect(normalizeSoupName("味噌汁")).toBe("味噌汁");
  });

  it("keeps a name with no letters or digits as typed", () => {
    expect(normalizeSoupName(" 🍲 ")).toBe("🍲");
    expect(normalizeSoupName("???")).toBe("???");
  });

  it("tells different soups apart", () => {
    expect(normalizeSoupName("Chicken noodle")).not.toBe(normalizeSoupName("Chicken rice"));
    expect(normalizeSoupName("Pho 2")).not.toBe(normalizeSoupName("Pho"));
  });
});
