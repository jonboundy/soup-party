import { Container } from "@/components/layout/container"
import {
  Section,
  SectionDescription,
  SectionEyebrow,
  SectionHeader,
  SectionTitle,
} from "@/components/layout/section"

function Rsvp() {
  return (
    <Section id="rsvp" aria-labelledby="rsvp-title" className="border-t">
      <Container>
        <SectionHeader reveal className="mb-0 sm:mb-0">
          <SectionEyebrow>RSVP</SectionEyebrow>
          <SectionTitle id="rsvp-title">Will you be there?</SectionTitle>
          <SectionDescription>RSVPs are not open yet.</SectionDescription>
        </SectionHeader>
      </Container>
    </Section>
  )
}

export { Rsvp }
