import type { Metadata } from "next";
import Link from "next/link";
import { redirect, unstable_rethrow } from "next/navigation";
import { Suspense } from "react";
import { HostRsvpEditor } from "@/components/host/rsvp-editor";
import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";

export const metadata: Metadata = {
  title: "Correct a response · Soup Party",
  robots: { index: false, follow: false },
};

async function Response({ params, searchParams }: PageProps<"/host/rsvps/[id]">) {
  const { id } = await params;
  // Set by the save that brought the host back here, when it could not make
  // every change to the photos. Only a small count is believed.
  const unsaved = Number((await searchParams).unsaved);
  // Without a database there are no sessions, so nobody is the host.
  if (!process.env.DATABASE_URL) redirect("/host");
  let rsvp, photos;
  try {
    // Sends anyone but the signed-in host to the sign-in form.
    const { getHostRsvp, listHostRecipePhotos } = await import("@/lib/host-rsvps");
    [rsvp, photos] = await Promise.all([getHostRsvp(id), listHostRecipePhotos(id)]);
  } catch (error) {
    unstable_rethrow(error);
    // Database errors may quote guests' details; log only their kind.
    console.error("RSVP could not be loaded:", error instanceof Error ? error.name : typeof error);
    return <div className="space-y-3" role="alert">
      <h2 className="type-heading">This response could not be loaded.</h2>
      <p className="text-muted-foreground">Try reloading the page.</p>
    </div>;
  }
  if (!rsvp) {
    return <div className="space-y-3">
      <h2 className="type-heading">This response is no longer here.</h2>
      <p className="text-muted-foreground">It may have been removed.</p>
      <Link href="/host" className="underline underline-offset-4">Back to the responses</Link>
    </div>;
  }
  // Keyed on the answers: a page the browser kept from an earlier visit must
  // not put what it held then back into the form.
  return <HostRsvpEditor
    key={JSON.stringify([rsvp, photos])}
    id={id}
    initial={rsvp}
    savedPhotos={photos}
    unsavedPhotos={Number.isInteger(unsaved) && unsaved > 0 && unsaved < 10 ? unsaved : 0}
  />;
}

export default function HostRsvpPage(props: PageProps<"/host/rsvps/[id]">) {
  return <Section>
    <Container size="narrow">
      <div className="mb-10 space-y-3">
        <p className="type-eyebrow text-muted-foreground">Host</p>
        <h1 className="type-title">A correction.</h1>
        <p className="type-lead text-muted-foreground">Change this response, or remove it.</p>
      </div>
      <Suspense fallback={<p role="status">Loading…</p>}>
        <Response {...props} />
      </Suspense>
    </Container>
  </Section>;
}
