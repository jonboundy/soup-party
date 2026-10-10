import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";

export default function Home() {
  return (
    <Section className="flex flex-1 items-center">
      <Container>
        <h1 className="type-display">Soup is happening.</h1>
        <p className="type-lead mt-5 text-muted-foreground sm:mt-8">
          Everyone brings soup. Everyone eats soup.
        </p>
      </Container>
    </Section>
  );
}
