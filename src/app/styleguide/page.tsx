import type { Metadata } from "next";
import { Container } from "@/components/layout/container";
import {
  Section,
  SectionDescription,
  SectionEyebrow,
  SectionHeader,
  SectionTitle,
} from "@/components/layout/section";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

export const metadata: Metadata = {
  title: "Styleguide · Soup Party",
  robots: { index: false },
};

const colors = [
  { name: "background", swatch: "bg-background", use: "The page." },
  { name: "card", swatch: "bg-card", use: "Raised surfaces and fields." },
  { name: "muted", swatch: "bg-muted", use: "Quiet fills." },
  { name: "border", swatch: "bg-border", use: "Dividers and outlines." },
  { name: "input", swatch: "bg-input", use: "Control outlines." },
  {
    name: "muted-foreground",
    swatch: "bg-muted-foreground",
    use: "Secondary text.",
  },
  {
    name: "foreground",
    swatch: "bg-foreground",
    use: "Text and primary actions.",
  },
  { name: "brand", swatch: "bg-brand", use: "The accent. Used sparingly." },
  { name: "destructive", swatch: "bg-destructive", use: "Errors and removal." },
];

const type = [
  { name: "type-display", sample: "Soup is happening." },
  { name: "type-title", sample: "The soups" },
  { name: "type-heading", sample: "You're on the list." },
  { name: "type-lead", sample: "Everyone brings soup. Everyone eats soup." },
  {
    name: "text-base",
    sample: "Your soup has been registered.",
  },
  {
    name: "text-sm text-muted-foreground",
    sample: "This soup has already been registered.",
  },
  { name: "type-eyebrow", sample: "No soups yet." },
];

const partySizes = [1, 2, 3, 4].map((size) => ({
  label: size === 1 ? "1 person" : `${size} people`,
  value: String(size),
}));

export default function Styleguide() {
  return (
    <>
      <Section className="pb-0 sm:pb-0 lg:pb-0">
        <Container>
          <SectionHeader className="mb-0 sm:mb-0">
            <SectionEyebrow>Styleguide</SectionEyebrow>
            <h1 className="type-title">The components.</h1>
            <SectionDescription>
              Tokens, type and primitives used across Soup Party.
            </SectionDescription>
          </SectionHeader>
        </Container>
      </Section>

      <Section>
        <Container>
          <SectionHeader>
            <SectionEyebrow>Color</SectionEyebrow>
            <SectionTitle>Off-white, ink, one tomato.</SectionTitle>
          </SectionHeader>
          <ul className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
            {colors.map((color) => (
              <li key={color.name} className="flex flex-col gap-3">
                <div
                  className={`aspect-[4/3] rounded-lg border ${color.swatch}`}
                />
                <div className="flex flex-col gap-0.5">
                  <p className="font-mono text-xs">{color.name}</p>
                  <p className="text-sm text-muted-foreground">{color.use}</p>
                </div>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      <Section className="border-t">
        <Container>
          <SectionHeader>
            <SectionEyebrow>Type</SectionEyebrow>
            <SectionTitle>One family, seven sizes.</SectionTitle>
          </SectionHeader>
          <dl className="flex flex-col gap-8 sm:gap-10">
            {type.map((style) => (
              <div
                key={style.name}
                className="grid gap-2 md:grid-cols-[14rem_1fr] md:items-baseline md:gap-8"
              >
                <dt className="font-mono text-xs text-muted-foreground">
                  {style.name}
                </dt>
                <dd className={style.name}>{style.sample}</dd>
              </div>
            ))}
          </dl>
        </Container>
      </Section>

      <Section className="border-t">
        <Container>
          <SectionHeader>
            <SectionEyebrow>Actions</SectionEyebrow>
            <SectionTitle>Buttons.</SectionTitle>
          </SectionHeader>
          <div className="flex flex-col gap-8">
            <div className="flex flex-wrap items-center gap-3">
              <Button>RSVP</Button>
              <Button variant="outline">Edit RSVP</Button>
              <Button variant="secondary">Decide later</Button>
              <Button variant="ghost">Cancel</Button>
              <Button variant="destructive">Remove</Button>
              <Button variant="link">View the soups</Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="lg">I&apos;ll be there</Button>
              <Button>I&apos;ll be there</Button>
              <Button size="sm">I&apos;ll be there</Button>
              <Button disabled>I&apos;ll be there</Button>
            </div>
          </div>
        </Container>
      </Section>

      <Section className="border-t">
        <Container>
          <SectionHeader>
            <SectionEyebrow>Forms</SectionEyebrow>
            <SectionTitle>Fields.</SectionTitle>
          </SectionHeader>
          <div className="grid gap-x-12 gap-y-10 md:grid-cols-2">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="sg-name">Name</FieldLabel>
                <Input id="sg-name" autoComplete="off" />
                <FieldDescription>
                  As it should appear beside your soup.
                </FieldDescription>
              </Field>
              <FieldSet>
                <FieldLegend variant="label">Attendance</FieldLegend>
                <RadioGroup defaultValue="attending">
                  <Field orientation="horizontal">
                    <RadioGroupItem value="attending" id="sg-attending" />
                    <FieldLabel htmlFor="sg-attending" className="font-normal">
                      I&apos;ll be there
                    </FieldLabel>
                  </Field>
                  <Field orientation="horizontal">
                    <RadioGroupItem value="declined" id="sg-declined" />
                    <FieldLabel htmlFor="sg-declined" className="font-normal">
                      I can&apos;t make it
                    </FieldLabel>
                  </Field>
                </RadioGroup>
              </FieldSet>
              <Field>
                <FieldLabel htmlFor="sg-party-size">Party size</FieldLabel>
                <Select items={partySizes} defaultValue="2">
                  <SelectTrigger id="sg-party-size" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {partySizes.map((size) => (
                      <SelectItem key={size.value} value={size.value}>
                        {size.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </FieldGroup>
            <FieldGroup>
              <Field data-invalid={true}>
                <FieldLabel htmlFor="sg-soup">Soup</FieldLabel>
                <Input
                  id="sg-soup"
                  autoComplete="off"
                  aria-invalid={true}
                  aria-describedby="sg-soup-error"
                />
                <FieldError id="sg-soup-error">Enter a soup name.</FieldError>
              </Field>
              <Field>
                <FieldLabel htmlFor="sg-description">Description</FieldLabel>
                <Textarea id="sg-description" />
                <FieldDescription>Optional.</FieldDescription>
              </Field>
              <Field data-disabled={true}>
                <FieldLabel htmlFor="sg-disabled">Disabled</FieldLabel>
                <Input id="sg-disabled" disabled defaultValue="Tomato" />
              </Field>
            </FieldGroup>
          </div>
        </Container>
      </Section>

      <Section className="border-t">
        <Container>
          <SectionHeader>
            <SectionEyebrow>Surfaces</SectionEyebrow>
            <SectionTitle>Cards, badges, notices.</SectionTitle>
          </SectionHeader>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Tomato</CardTitle>
                <CardDescription>Brought by Jon</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <p className="text-muted-foreground">
                  Smooth. Served with bread.
                </p>
                <Badge variant="outline">Vegetable</Badge>
              </CardContent>
            </Card>
            <div className="flex flex-col gap-6">
              <Alert>
                <AlertTitle>This soup has already been registered.</AlertTitle>
                <AlertDescription>
                  Tomato, brought by Jon. You may register it anyway.
                </AlertDescription>
              </Alert>
              <Alert variant="destructive">
                <AlertTitle>The RSVP could not be saved.</AlertTitle>
                <AlertDescription>Try again.</AlertDescription>
              </Alert>
            </div>
            <div className="flex flex-col gap-6">
              <div className="flex flex-wrap gap-2">
                <Badge>Attending</Badge>
                <Badge variant="secondary">Undecided</Badge>
                <Badge variant="outline">Declined</Badge>
                <Badge variant="destructive">Removed</Badge>
              </div>
              <Separator />
              <p className="text-muted-foreground">No soups yet.</p>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
