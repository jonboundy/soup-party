import { describe, expect, it } from "vitest";

import { SoupCategory } from "@/generated/prisma/client";
import { SOUP_CATEGORIES } from "@/lib/soup-categories";

describe("SOUP_CATEGORIES", () => {
  it("offers every category the database has, once", () => {
    const offered = SOUP_CATEGORIES.map(({ value }) => value);

    expect([...offered].sort()).toEqual(Object.values(SoupCategory).sort());
  });

  it("ends with the catch-all", () => {
    expect(SOUP_CATEGORIES.at(-1)).toEqual({ value: "OTHER", label: "Other" });
  });
});
