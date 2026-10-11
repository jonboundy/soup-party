import { describe, expect, it } from "vitest";

import { layoutSoupCascade } from "@/lib/soup-cascade";

const SOUPS = 6;

describe("layoutSoupCascade", () => {
  const bowls = layoutSoupCascade(SOUPS);

  it("always lays out the same cascade", () => {
    expect(layoutSoupCascade(SOUPS)).toEqual(bowls);
    expect(layoutSoupCascade(SOUPS, undefined, 12)).not.toEqual(bowls);
  });

  it("gives every bowl a place on the page and a time to fall", () => {
    for (const bowl of bowls) {
      expect(bowl.x).toBeGreaterThanOrEqual(0);
      expect(bowl.x).toBeLessThan(1);
      expect(bowl.start).toBeGreaterThanOrEqual(0);
      expect(bowl.start).toBeLessThan(1);
      expect(bowl.seconds).toBeGreaterThan(0);
    }
  });

  it("serves every soup, and none much more than another", () => {
    const served = Array.from({ length: SOUPS }, () => 0);
    for (const bowl of bowls) {
      expect(Number.isInteger(bowl.soup)).toBe(true);
      served[bowl.soup]++;
    }
    expect(Math.min(...served)).toBeGreaterThan(0);
    expect(Math.max(...served) - Math.min(...served)).toBeLessThanOrEqual(1);
  });

  it("has nearer bowls fall faster", () => {
    const seconds = (depth: number) =>
      bowls.filter((bowl) => bowl.depth === depth).map((bowl) => bowl.seconds);
    expect(Math.max(...seconds(2))).toBeLessThan(Math.min(...seconds(1)));
    expect(Math.max(...seconds(1))).toBeLessThan(Math.min(...seconds(0)));
  });

  // A narrow screen shows only the first seven.
  it.each([7, 15])("spreads the first %i across and down the page", (shown) => {
    const first = bowls.slice(0, shown);
    for (const side of ["x", "start"] as const) {
      for (let quarter = 0; quarter < 4; quarter++) {
        expect(
          first.some((bowl) => Math.floor(bowl[side] * 4) === quarter),
        ).toBe(true);
      }
    }
  });
});
