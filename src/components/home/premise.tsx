import { Container } from "@/components/layout/container"
import {
  Section,
  SectionDescription,
  SectionEyebrow,
  SectionHeader,
  SectionTitle,
} from "@/components/layout/section"

function Premise() {
  return (
    <Section aria-labelledby="premise-title" className="border-t">
      <Container>
        <SectionHeader reveal className="mb-0 sm:mb-0">
          <SectionEyebrow>The premise</SectionEyebrow>
          <SectionTitle id="premise-title">
            A potluck, limited to soup.
          </SectionTitle>
          <SectionDescription>
            Guests bring a soup and try the others. Registering yours in
            advance lets everyone see which soups are already coming.
          </SectionDescription>
        </SectionHeader>
      </Container>
    </Section>
  )
}

export { Premise }
