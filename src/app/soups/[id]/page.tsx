import type { Metadata } from "next";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { Suspense } from "react";
import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { getPublicRecipe } from "@/lib/public-soups";

const robots = { index: false, follow: false };

export async function generateMetadata({ params }: PageProps<"/soups/[id]">): Promise<Metadata> {
  const { id } = await params;
  // A recipe that cannot be read is reported by the page, not here.
  const recipe = await getPublicRecipe(id).catch(() => null);
  return { title: recipe ? `Recipe: ${recipe.name} · Soup Party` : "Recipe · Soup Party", robots };
}

// Guests write the address, so it is shown as the site it leads to.
function site(url: string) {
  return URL.canParse(url) ? new URL(url).hostname.replace(/^www\./, "") : url;
}

async function Recipe({ params }: PageProps<"/soups/[id]">) {
  const { id } = await params;
  let recipe;
  try {
    recipe = await getPublicRecipe(id);
  } catch (error) {
    // Preserve Next.js framework exceptions when handling database errors.
    unstable_rethrow(error);
    // Database errors may quote private data; log only their kind.
    console.error("Recipe could not be loaded:", error instanceof Error ? error.name : typeof error);
    return <div className="space-y-3" role="alert">
      <h1 className="type-heading">The recipe could not be loaded.</h1>
      <p className="text-muted-foreground">Try reloading this page.</p>
    </div>;
  }
  if (!recipe) {
    return <div className="space-y-3">
      <h1 className="type-heading">This recipe is not here.</h1>
      <p className="text-muted-foreground">It may have been removed, or the soup is no longer coming.</p>
      <Link href="/#soups" className="underline underline-offset-4">Back to the soups</Link>
    </div>;
  }
  return <article className="space-y-10">
    <div className="space-y-3">
      <p className="type-eyebrow text-muted-foreground">Recipe</p>
      <h1 className="type-title [overflow-wrap:anywhere]">{recipe.name}</h1>
      <p className="type-lead text-muted-foreground [overflow-wrap:anywhere]">Brought by {recipe.contributorName}</p>
    </div>
    {recipe.recipeUrl && <p className="[overflow-wrap:anywhere]">
      {/* A guest's link: no referrer, and no endorsement for a crawler to follow. */}
      <a href={recipe.recipeUrl} rel="noopener noreferrer nofollow ugc" className="underline underline-offset-4">
        The recipe, at {site(recipe.recipeUrl)}
      </a>
    </p>}
    {/* Plain text only. A blank line starts a paragraph and other line breaks are kept. */}
    {recipe.recipeText && <div className="space-y-4 [overflow-wrap:anywhere]">
      {recipe.recipeText.split("\n\n").map((paragraph, index) => (
        <p key={index} className="whitespace-pre-line">{paragraph}</p>
      ))}
    </div>}
    {recipe.photos.length > 0 && <ul className="space-y-6">
      {recipe.photos.map((photo, index) => (
        <li key={photo.id}>
          {/* Opens the photo on its own, to be zoomed into. */}
          <a href={photo.src} className="block rounded-lg">
            {/* Already shrunk to the size it is shown at, so there is nothing for the image optimizer to do. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.src}
              width={photo.width}
              height={photo.height}
              // What a photo of a page says cannot be known here, only what it is of.
              alt={recipe.photos.length === 1
                ? `Photo of the recipe for ${recipe.name}`
                : `Photo ${index + 1} of ${recipe.photos.length} of the recipe for ${recipe.name}`}
              loading={index ? "lazy" : undefined}
              className="h-auto w-full rounded-lg border bg-card"
            />
          </a>
        </li>
      ))}
    </ul>}
    <Link href="/#soups" className="inline-block underline underline-offset-4">Back to the soups</Link>
  </article>;
}

export default function RecipePage(props: PageProps<"/soups/[id]">) {
  return <Section>
    <Container size="narrow">
      <Suspense fallback={<p role="status">Loading the recipe…</p>}>
        <Recipe {...props} />
      </Suspense>
    </Container>
  </Section>;
}
