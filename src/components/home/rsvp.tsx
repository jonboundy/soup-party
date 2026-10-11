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
          <RsvpForm />
        </Reveal>
      </Container>
    </Section>
  )
}

export { Rsvp }
