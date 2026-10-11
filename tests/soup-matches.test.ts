import { describe, expect, it } from "vitest";

import { findSoupMatches, soupMatchKind } from "@/lib/soup-matches";

describe("soup name matching", () => {
  it.each([
    [" BROCCOLI-cheddar Soup! ", "Broccoli cheddar"],
    ["Phở soup", "Pho"],
    ["Ham & bean soup", "Ham and bean"],
    ["Mom’s chicken noodle", "Mom's chicken noodle soup"],
    ["味噌汁", "味噌汁 Soup"],
  ])("finds normalized duplicates: %s / %s", (name, existing) => {
    expect(soupMatchKind(name, existing)).toBe("exact");
  });

  it.each([
    ["Broccoli and cheddar", "Cheddar broccoli soup"],
    ["Creamy broccoli cheddar", "Broccoli cheddar"],
    ["Broccoli cheddar with potato", "Broccoli cheddar"],
    ["Mom's chicken noodle soup", "Homemade chicken noodle"],
    ["Spicy vegan chili", "Chili"],
    ["Roasted tomato basil soup", "Tomato basil"],
  ])("finds obvious variants in both directions: %s / %s", (name, existing) => {
    expect(soupMatchKind(name, existing)).toBe("similar");
    expect(soupMatchKind(existing, name)).toBe("similar");
  });

  it.each([
    ["Chicken noodle", "Chicken rice"],
    ["Tomato basil", "Tomato lentil"],
    ["Potato leek", "Broccoli cheddar"],
    ["Creamy mushroom", "Creamy tomato"],
    ["Bean", "Chicken and bean"],
    ["Soup", "Chicken soup"],
    ["", "Minestrone"],
    ["", ""],
    ["???", "!!!"],
  ])("avoids unrelated or generic matches: %s / %s", (name, existing) => {
    expect(soupMatchKind(name, existing)).toBeNull();
  });

  it("returns every match, including two contributors with the same soup", () => {
    const soups = [
      { name: "Broccoli cheddar soup", contributorName: "Ada", editTokenHash: "private" },
      { name: "Creamy broccoli and cheddar", contributorName: "Grace", id: "private" },
      { name: "Broccoli cheddar soup", contributorName: "李" },
      { name: "Chicken noodle", contributorName: "Alan" },
    ];
    expect(findSoupMatches("Broccoli cheddar", soups)).toEqual([
      { name: "Broccoli cheddar soup", contributorName: "Ada", kind: "exact" },
      { name: "Creamy broccoli and cheddar", contributorName: "Grace", kind: "similar" },
      { name: "Broccoli cheddar soup", contributorName: "李", kind: "exact" },
    ]);
    expect(findSoupMatches("Broccoli cheddar", [])).toEqual([]);
  });
});
