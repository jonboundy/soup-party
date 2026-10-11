/**
 * Reduces a soup's name to the form stored as `normalizedName`, so that names
 * differing only in case, accents, punctuation, spacing or a trailing "soup"
 * come out the same: "Mom's Chicken-Noodle Soup!" is "moms chicken noodle".
 *
 * Changing what this returns leaves existing rows with the old form; they
 * need recomputing in a migration.
 */
export function normalizeSoupName(name: string) {
  const words = name
    // Split accented letters into a letter and a mark, then drop the marks.
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    // Apostrophes close up, so "mom's" and "moms" match.
    .replace(/['’]/g, "")
    // Everything else that is not a letter or a digit separates words.
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(" ");

  // "Soup" alone is still a name.
  while (words.length > 1 && /^soups?$/.test(words[words.length - 1])) {
    words.pop();
  }

  // A name with no letters or digits, such as an emoji, is kept as typed.
  return words.join(" ") || name.trim().toLowerCase();
}
