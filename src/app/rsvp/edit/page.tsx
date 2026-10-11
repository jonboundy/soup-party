import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { RsvpForm } from "@/components/home/rsvp-form";
import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { isEditToken } from "@/lib/edit-token";

export const metadata: Metadata = {
  title: "Edit your RSVP · Soup Party",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

async function PrivateRsvp({ searchParams }: PageProps<"/rsvp/edit">) {
  const { token } = await searchParams;
  if (!isEditToken(token)) return <InvalidLink />;
  if (!process.env.DATABASE_URL) return <Unavailable />;
  let rsvp;
  try {
    const { getEditableRsvp } = await import("@/lib/rsvp");
    rsvp = await getEditableRsvp(token);
  } catch {
    return <Unavailable />;
  }
  if (!rsvp) return <InvalidLink />;
  return <RsvpForm initial={rsvp} editToken={token} />;
}

function InvalidLink() {
  return <div className="space-y-3">
    <h2 className="type-heading">This edit link is not valid.</h2>
    <p className="text-muted-foreground">Open the private link saved from your RSVP confirmation.</p>
    <Link href="/" className="underline underline-offset-4">Back to Soup Party</Link>
  </div>;
}

function Unavailable() {
  return <div className="space-y-3" role="alert">
    <h2 className="type-heading">Your RSVP could not be loaded.</h2>
    <p className="text-muted-foreground">Try reloading this page.</p>
  </div>;
}

export default function EditRsvpPage(props: PageProps<"/rsvp/edit">) {
  return <Section>
    <Container size="narrow">
      <div className="mb-10 space-y-3">
        <p className="type-eyebrow text-muted-foreground">Your RSVP</p>
        <h1 className="type-title">Plans change.</h1>
        <p className="type-lead text-muted-foreground">Update your response, or cancel your RSVP.</p>
      </div>
      <Suspense fallback={<p role="status">Loading your RSVP…</p>}>
        <PrivateRsvp {...props} />
      </Suspense>
    </Container>
  </Section>;
}
