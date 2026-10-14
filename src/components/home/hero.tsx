import Link from "next/link"
import { cn } from "cn"

import { AlphabetSoup } from "@/components/home/alphabet-soup"
import { EventFacts } from "@/components/home/event-details"
import { Container } from "@/components/layout/container"
import { RsvpLink } from "@/components/layout/rsvp-link"
import { Section } from "@/components/layout/section"
import { buttonVariants } from "@/components/ui/button"

function Hero() {
  return (
    <Section className="flex min-h-[calc(92svh-var(--header-height))] items-center py-12 sm:py-16 lg:py-16">
      <Container className="grid items-center gap-y-10 sm:gap-y-12 lg:grid-cols-[1fr_auto] lg:gap-x-16">
        <div>
          <p
            data-slot="event-title"
            className="mb-4 text-muted-foreground sm:mb-5"
          >
            Soup Party 2: <span>Electric Boogaloo</span>
          </p>
          <h1 className="type-display">Soup is happening.</h1>
          <p className="type-lead mt-5 text-muted-foreground sm:mt-8">
            Everyone brings soup. Everyone eats soup.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-x-7 gap-y-2 sm:mt-12">
            <RsvpLink className={buttonVariants({ size: "lg" })} newLabel="I'll be there" />
            <Link
              href="/#soups"
              className={cn(buttonVariants({ variant: "link" }), "px-0")}
            >
              View the soups
            </Link>
          </div>
        </div>
        {/* After the text in the source, and on a small screen, where the
            date matters more than the bowl. Under both from `lg`, where the
            bowl gives up width on a short window to keep them in view. */}
        <EventFacts id="details" className="lg:col-span-2 lg:row-start-2" />
        <AlphabetSoup className="mx-auto w-full max-w-80 sm:max-w-96 lg:col-start-2 lg:row-start-1 lg:w-[clamp(18rem,calc(100svh-26rem),26rem)] lg:max-w-none xl:w-[clamp(18rem,calc(100svh-26rem),30rem)]" />
      </Container>
    </Section>
  )
}

export { Hero }
