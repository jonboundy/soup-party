import * as React from "react"

import { Container } from "@/components/layout/container"
import { Reveal } from "@/components/layout/reveal"
import {
  Section,
  SectionEyebrow,
  SectionHeader,
  SectionTitle,
} from "@/components/layout/section"
import { getEventDetails } from "@/lib/event"

function Detail({
  term,
  children,
}: {
  term: string
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-2 border-t py-6 last:border-b sm:grid-cols-[10rem_1fr] sm:items-baseline sm:gap-8 sm:py-8 lg:grid-cols-[14rem_1fr]">
      <dt className="type-eyebrow text-muted-foreground">{term}</dt>
      <dd className="flex max-w-2xl flex-col gap-1.5">{children}</dd>
    </div>
  )
}

function Unset({ children = "To be announced." }: { children?: string }) {
  return <p className="type-lead text-muted-foreground">{children}</p>
}

async function EventDetails() {
  const { start, locationLabel, address, mapUrl, instructions } =
    await getEventDetails()

  return (
    <Section id="details" aria-labelledby="details-title" className="border-t">
      <Container>
        <SectionHeader reveal>
          <SectionEyebrow>Details</SectionEyebrow>
          <SectionTitle id="details-title">When and where.</SectionTitle>
        </SectionHeader>
        <Reveal as="dl">
          <Detail term="Date">
            {start ? (
              <p className="type-heading">
                <time dateTime={start.iso}>{start.date}</time>
              </p>
            ) : (
              <Unset>November 2026. The exact date is to be announced.</Unset>
            )}
          </Detail>
          <Detail term="Time">
            {start ? <p className="type-heading">{start.time}</p> : <Unset />}
          </Detail>
          <Detail term="Location">
            {locationLabel && <p className="type-heading">{locationLabel}</p>}
            {address && (
              <p
                className={
                  locationLabel
                    ? "type-lead whitespace-pre-line text-muted-foreground"
                    : "type-heading whitespace-pre-line"
                }
              >
                {address}
              </p>
            )}
            {!locationLabel && !address && <Unset />}
            {mapUrl && (
              <p className="mt-1.5">
                <a
                  href={mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center rounded-md text-sm font-medium underline decoration-1 underline-offset-4 transition-colors hover:decoration-brand"
                >
                  Map and directions
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </p>
            )}
          </Detail>
          <Detail term="Instructions">
            {instructions ? (
              <p className="type-lead whitespace-pre-line">{instructions}</p>
            ) : (
              <Unset />
            )}
          </Detail>
        </Reveal>
      </Container>
    </Section>
  )
}

export { EventDetails }
