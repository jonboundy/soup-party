import * as React from "react"
import { cn } from "cn"

import { Container } from "@/components/layout/container"
import { Reveal } from "@/components/layout/reveal"
import { Section } from "@/components/layout/section"
import { getEventDetails } from "@/lib/event"

function Fact({
  term,
  children,
}: {
  term: string
  children: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr] items-baseline gap-x-4 border-t py-4 sm:flex sm:flex-col sm:items-start sm:gap-2.5 sm:border-t-0 sm:py-0">
      <dt className="type-eyebrow text-muted-foreground">{term}</dt>
      <dd className="flex flex-col gap-1">{children}</dd>
    </div>
  )
}

function Unset({ children = "To be announced." }: { children?: string }) {
  return <p className="text-muted-foreground">{children}</p>
}

// The date, time and location, for the hero: a row of three from the `sm`
// breakpoint and a short list below it.
async function EventFacts({ className, ...props }: React.ComponentProps<"dl">) {
  const { start, locationLabel, address, mapUrl } = await getEventDetails()

  return (
    <dl
      className={cn(
        "grid sm:grid-cols-3 sm:gap-x-8 sm:border-t sm:pt-8",
        className
      )}
      {...props}
    >
      <Fact term="Date">
        {start ? (
          <p className="type-heading">
            <time dateTime={start.iso}>{start.date}</time>
          </p>
        ) : (
          <Unset>November 2026. The exact date is to be announced.</Unset>
        )}
      </Fact>
      <Fact term="Time">
        {start ? <p className="type-heading">{start.time}</p> : <Unset />}
      </Fact>
      <Fact term="Location">
        {locationLabel && <p className="type-heading">{locationLabel}</p>}
        {address && (
          <p
            className={
              locationLabel
                ? "whitespace-pre-line text-muted-foreground"
                : "type-heading whitespace-pre-line"
            }
          >
            {address}
          </p>
        )}
        {!locationLabel && !address && <Unset />}
        {mapUrl && (
          <p>
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
      </Fact>
    </dl>
  )
}

async function Instructions() {
  const { instructions } = await getEventDetails()

  return (
    <Section
      aria-labelledby="instructions-title"
      className="border-t py-10 sm:py-14 lg:py-16"
    >
      <Container>
        <Reveal className="grid gap-2 sm:grid-cols-[10rem_1fr] sm:items-baseline sm:gap-8 lg:grid-cols-[14rem_1fr]">
          <h2
            id="instructions-title"
            className="type-eyebrow text-muted-foreground"
          >
            Instructions
          </h2>
          {instructions ? (
            <p className="type-lead max-w-2xl whitespace-pre-line">
              {instructions}
            </p>
          ) : (
            <p className="type-lead text-muted-foreground">To be announced.</p>
          )}
        </Reveal>
      </Container>
    </Section>
  )
}

export { EventFacts, Instructions }
