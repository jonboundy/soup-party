import { Container } from "@/components/layout/container"
import {
  Section,
  SectionDescription,
  SectionEyebrow,
  SectionHeader,
  SectionTitle,
} from "@/components/layout/section"

function EventDetails() {
  return (
    <Section id="details" aria-labelledby="details-title" className="border-t">
      <Container>
        <SectionHeader className="mb-0 sm:mb-0">
          <SectionEyebrow>Details</SectionEyebrow>
          <SectionTitle id="details-title">November 2026.</SectionTitle>
          <SectionDescription>
            The date, time and address will be posted here.
          </SectionDescription>
        </SectionHeader>
      </Container>
    </Section>
  )
}

export { EventDetails }
