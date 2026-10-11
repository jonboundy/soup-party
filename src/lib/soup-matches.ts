import { normalizeSoupName } from "@/lib/soup-name";

export type SoupMatch = {
  name: string;
  contributorName: string;
  kind: "exact" | "similar";
};

// Connectors and common preparation/personal qualifiers do not identify a soup.
// Keep ingredients: chicken noodle and chicken rice should not match each other.
const qualifiers = new Set([
  "a", "and", "of", "the", "with", "soup", "soups",
  "homemade", "classic", "traditional", "creamy", "roasted", "spicy",
  "vegan", "vegetarian", "moms", "grandmas",
]);

function ingredients(name: string) {
  return new Set(
    name.split(" ").filter((word) => /[\p{L}\p{N}]/u.test(word) && !qualifiers.has(word)),
  );
}

/** A conservative naming heuristic, rather than a recipe classifier. */
export function soupMatchKind(name: string, existingName: string): SoupMatch["kind"] | null {
  const normalized = normalizeSoupName(name);
  const existing = normalizeSoupName(existingName);
  if (!normalized || !existing) return null;
  if (normalized === existing) return "exact";

  const left = ingredients(normalized);
  const right = ingredients(existing);
  if (!left.size || !right.size) return null;
  const shared = [...left].filter((word) => right.has(word)).length;
  const smaller = Math.min(left.size, right.size);
  const union = left.size + right.size - shared;

  // Reordered ingredients or preparation qualifiers, even for one-word names.
  if (shared === left.size && shared === right.size) return "similar";
  // Additional ingredients/qualifiers around a shared, multi-word soup name.
  if (shared >= 2 && (shared === smaller || shared / union >= 0.75)) return "similar";
  return null;
}

/** Projects only the fields a guest needs to understand a warning. */
export function findSoupMatches(
  name: string,
  soups: readonly { name: string; contributorName: string }[],
): SoupMatch[] {
  return soups.flatMap((soup) => {
    const kind = soupMatchKind(name, soup.name);
    return kind ? [{ name: soup.name, contributorName: soup.contributorName, kind }] : [];
  });
}
