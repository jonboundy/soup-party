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
    <ul aria-label="Registered soups" className="border-t">
      {soups.map((soup, index) => (
        <li key={index} className="border-b py-6 sm:py-8">
          <h3 className="type-heading [overflow-wrap:anywhere]">{soup.name}</h3>
          <p className="mt-2 text-muted-foreground [overflow-wrap:anywhere]">
            Brought by {soup.contributorName}
          </p>
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
