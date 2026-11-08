import { unstable_rethrow } from "next/navigation"

import { Container } from "@/components/layout/container"
import {
  Section,
  SectionDescription,
  SectionHeader,
  SectionTitle,
} from "@/components/layout/section"
import { getPublicGuests } from "@/lib/public-soups"

async function Guests() {
  let guests: Awaited<ReturnType<typeof getPublicGuests>>
  try {
    guests = await getPublicGuests()
  } catch (error) {
    // Preserve Next.js framework exceptions when handling database errors.
    unstable_rethrow(error)
    // Database errors may quote private data; log only their kind.
    console.error(
      "Guest list could not be loaded:",
      error instanceof Error ? error.name : typeof error
    )
    return (
      <SectionDescription>
        The guests could not be loaded. Please try again later.
      </SectionDescription>
    )
  }

  if (guests.length === 0) {
    return <SectionDescription>No guests yet.</SectionDescription>
  }

  return (
    // Everyone attending, soup or not, and nothing to say which is which.
    <ul
      aria-label="Guests"
      className="grid grid-cols-2 gap-x-6 border-t sm:grid-cols-3 lg:grid-cols-4"
    >
      {guests.map((names, index) => (
        <li key={index} className="border-b py-4 [overflow-wrap:anywhere] sm:py-5">
          {names}
        </li>
      ))}
    </ul>
  )
}

async function GuestList() {
  const list = await Guests()
  return (
    <Section id="guests" aria-labelledby="guests-title" className="border-t">
      <Container>
        <SectionHeader reveal>
          <SectionTitle id="guests-title">Who’s coming</SectionTitle>
        </SectionHeader>
        {list}
      </Container>
    </Section>
  )
}

export { GuestList }
