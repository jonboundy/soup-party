// Where a soup's “Recipe” link leads, for the registry and the host's overview.

/** What decides it: the soup's recipe columns and how many photos it has. */
type SoupRecipe = {
  id: string;
  recipeUrl: string | null;
  recipeText: string | null;
  _count: { photos: number };
};

/**
 * A recipe that is a link is linked to directly, by `recipeUrl`. One that is
 * text or photos is read on the soup's own page, at `recipePath`. Both are
 * null for a soup with no recipe.
 */
export function recipeLinks({ id, recipeUrl, recipeText, _count }: SoupRecipe) {
  const page = !!(recipeText || _count.photos);
  return {
    recipeUrl: page ? null : recipeUrl,
    // A soup's id is public only as the address of its recipe page.
    recipePath: page ? `/soups/${id}` : null,
  };
}

/** Guests write the address, so it is described as the site it leads to. */
export function recipeSite(url: string) {
  return URL.canParse(url) ? new URL(url).hostname.replace(/^www\./, "") : url;
}
