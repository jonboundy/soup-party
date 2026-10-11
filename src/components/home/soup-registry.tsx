import { Container } from "@/components/layout/container"
import {
  Section,
  SectionDescription,
  SectionEyebrow,
  SectionHeader,
  SectionTitle,
} from "@/components/layout/section"

function SoupRegistry() {
  return (
    <Section id="soups" aria-labelledby="soups-title" className="border-t">
      <Container>
        <SectionHeader className="mb-0 sm:mb-0">
          <SectionEyebrow>Registry</SectionEyebrow>
          <SectionTitle id="soups-title">The soups.</SectionTitle>
          <SectionDescription>No soups yet.</SectionDescription>
        </SectionHeader>
      </Container>
    </Section>
  )
}

export { SoupRegistry }
