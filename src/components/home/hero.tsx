import Link from "next/link"
import { cn } from "cn"

import { Container } from "@/components/layout/container"
import { Section } from "@/components/layout/section"
import { buttonVariants } from "@/components/ui/button"

function Hero() {
  return (
    <Section className="flex min-h-[calc(92svh-var(--header-height))] items-center">
      <Container>
        <h1 className="type-display">Soup is happening.</h1>
        <p className="type-lead mt-5 text-muted-foreground sm:mt-8">
          Everyone brings soup. Everyone eats soup.
        </p>
        <div className="mt-9 flex flex-wrap items-center gap-x-7 gap-y-2 sm:mt-12">
          <Link href="/#rsvp" className={buttonVariants({ size: "lg" })}>
            I&apos;ll be there
          </Link>
          <Link
            href="/#soups"
            className={cn(buttonVariants({ variant: "link" }), "px-0")}
          >
            View the soups
          </Link>
        </div>
      </Container>
    </Section>
  )
}

export { Hero }
