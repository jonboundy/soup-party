import { Suspense } from "react"
import { connection } from "next/server"
import { createEditToken } from "@/lib/edit-token"
import { RsvpForm } from "@/components/home/rsvp-form"
import { Container } from "@/components/layout/container"
import { Reveal } from "@/components/layout/reveal"
import {
  Section,
  SectionEyebrow,
  SectionHeader,
  SectionTitle,
} from "@/components/layout/section"

function Rsvp() {
  return (
    <Section id="rsvp" aria-labelledby="rsvp-title" className="border-t">
      <Container>
        <SectionHeader reveal>
          <SectionEyebrow>RSVP</SectionEyebrow>
          <SectionTitle id="rsvp-title">Will you be there?</SectionTitle>
        </SectionHeader>
        <Reveal>
          <Suspense fallback={<p role="status">Loading RSVP form…</p>}>
            <NewRsvpForm />
          </Suspense>
        </Reveal>
      </Container>
    </Section>
  )
}

async function NewRsvpForm() {
  // Never prerender or cache a private submission credential across visitors.
  await connection()
  return <RsvpForm submissionToken={createEditToken().token} />
}

export { Rsvp }
