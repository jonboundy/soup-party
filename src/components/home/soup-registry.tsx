import Link from "next/link"
import { unstable_rethrow } from "next/navigation"

import { Container } from "@/components/layout/container"
import {
  Section,
  SectionDescription,
  SectionEyebrow,
  SectionHeader,
  SectionTitle,
} from "@/components/layout/section"
import { getPublicSoups } from "@/lib/public-soups"

async function SoupList() {
  let soups: Awaited<ReturnType<typeof getPublicSoups>>
  try {
    soups = await getPublicSoups()
  } catch (error) {
    // Preserve Next.js framework exceptions when handling database errors.
    unstable_rethrow(error)
    // Database errors may quote private data; log only their kind.
    console.error(
      "Soup registry could not be loaded:",
      error instanceof Error ? error.name : typeof error
    )
    return (
      <SectionDescription>
        The soups could not be loaded. Please try again later.
      </SectionDescription>
    )
  }

  if (soups.length === 0) {
    return <SectionDescription>No soups yet.</SectionDescription>
  }

  return (
    // One grid for the whole list, so the rows' columns line up whether or
    // not a soup has a recipe. Below `sm` the contributor goes under the soup.
    <ul
      aria-label="Registered soups"
      className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 border-t sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)_auto]"
    >
      {soups.map((soup, index) => (
        <li
          key={index}
          className="col-span-full grid grid-cols-subgrid items-baseline border-b py-4 sm:py-5"
        >
          <h3 className="type-heading [overflow-wrap:anywhere]">{soup.name}</h3>
          <p className="col-start-1 mt-1 text-muted-foreground [overflow-wrap:anywhere] sm:col-start-2 sm:mt-0">
            Brought by {soup.contributorName}
          </p>
          {soup.recipePath && (
            <Link
              href={soup.recipePath}
              // The list's links would otherwise all read "Recipe".
              aria-label={`Recipe for ${soup.name}`}
              className="col-start-2 row-start-1 underline underline-offset-4 sm:col-start-3"
            >
              Recipe
            </Link>
          )}
        </li>
      ))}
    </ul>
  )
}

async function SoupRegistry() {
  const list = await SoupList()
  return (
    <Section id="soups" aria-labelledby="soups-title" className="border-t">
      <Container>
        <SectionHeader reveal>
          <SectionEyebrow>Registry</SectionEyebrow>
          <SectionTitle id="soups-title">The soups.</SectionTitle>
        </SectionHeader>
        {list}
      </Container>
    </Section>
  )
}

export { SoupRegistry }
