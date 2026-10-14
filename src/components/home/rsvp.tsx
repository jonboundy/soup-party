import { Suspense } from "react"
import { connection } from "next/server"
import { createEditToken } from "@/lib/edit-token"
import { getRememberedRsvp } from "@/lib/remembered-rsvp"
import { RsvpForm } from "@/components/home/rsvp-form"
import { Container } from "@/components/layout/container"
import { Reveal } from "@/components/layout/reveal"
import {
  Section,
  SectionHeader,
  SectionTitle,
} from "@/components/layout/section"

function Rsvp() {
  return (
    <Section id="rsvp" aria-labelledby="rsvp-title" className="border-t">
      <Container>
        <SectionHeader reveal>
          <SectionTitle id="rsvp-title">RSVP</SectionTitle>
        </SectionHeader>
        <Reveal>
          <Suspense fallback={<p role="status">Loading your RSVP…</p>}>
            <GuestRsvp />
          </Suspense>
        </Reveal>
      </Container>
    </Section>
  )
}

async function GuestRsvp() {
  // Never prerender or cache a private submission credential across visitors.
  await connection()
  const rsvp = await getRememberedRsvp()
  if (rsvp.status === "unavailable") {
    return <div className="space-y-3" role="alert">
      <h3 className="type-heading">Your RSVP could not be loaded.</h3>
      <p className="text-muted-foreground">Try reloading this page.</p>
    </div>
  }
  return <RsvpForm
    submissionToken={rsvp.status === "new" ? createEditToken().token : undefined}
    remembered={rsvp.status === "remembered" ? rsvp.receipt : undefined}
  />
}

export { Rsvp }
