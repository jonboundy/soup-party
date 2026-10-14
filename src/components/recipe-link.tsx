import Link from "next/link"

import { recipeSite } from "@/lib/recipe-link"

/**
 * A soup's “Recipe” link, or nothing for a soup without a recipe. A recipe
 * that is a link leads straight to it; any other is on the soup's page here.
 */
function RecipeLink({
  soup,
  className,
}: {
  soup: { name: string; recipeUrl: string | null; recipePath: string | null }
  className?: string
}) {
  // A list's links would otherwise all read "Recipe".
  const label = `Recipe for ${soup.name}`
  if (soup.recipeUrl) {
    return (
      // A guest's link: no referrer, and no endorsement for a crawler to follow.
      <a
        href={soup.recipeUrl}
        rel="noopener noreferrer nofollow ugc"
        aria-label={`${label}, at ${recipeSite(soup.recipeUrl)}`}
        className={className}
      >
        Recipe
      </a>
    )
  }
  if (!soup.recipePath) return null
  return (
    <Link href={soup.recipePath} aria-label={label} className={className}>
      Recipe
    </Link>
  )
}

export { RecipeLink }
