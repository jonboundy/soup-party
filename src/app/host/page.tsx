import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { signOutHost } from "@/app/host/actions";
import { HostDashboard } from "@/components/host/dashboard";
import { HostSignInForm } from "@/components/host/sign-in-form";
import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Host · Soup Party",
  robots: { index: false, follow: false },
};

async function HostArea() {
  let signedIn = false;
  // Without a database there are no sessions; the form explains when submitted.
  if (process.env.DATABASE_URL) {
    try {
      const { isHostSignedIn } = await import("@/lib/host-session");
      signedIn = await isHostSignedIn();
    } catch {
      return <Frame><Unavailable /></Frame>;
    }
  }
  if (!signedIn) return <Frame><SignIn /></Frame>;
  return <Frame wide>
    <div className="space-y-14 sm:space-y-20">
      <HostDashboard />
      <form action={signOutHost}>
        <Button type="submit" variant="outline">Sign out</Button>
      </form>
    </div>
  </Frame>;
}

/** The sign-in form keeps to a narrow column; the overview uses the page's width. */
function Frame({ wide = false, children }: { wide?: boolean; children: React.ReactNode }) {
  return <Container size={wide ? "default" : "narrow"}>
    <div className="mb-10 space-y-3">
      <p className="type-eyebrow text-muted-foreground">Host</p>
      <h1 className="type-title">{wide ? "The responses." : "Administration."}</h1>
    </div>
    {children}
  </Container>;
}

function SignIn() {
  return <div className="space-y-10">
    <p className="type-lead text-muted-foreground">
      This page is for the host. Guests do not need to sign in.
    </p>
    <HostSignInForm />
    <Link href="/" className="inline-block underline underline-offset-4">Back to Soup Party</Link>
  </div>;
}

function Unavailable() {
  return <div className="space-y-3" role="alert">
    <h2 className="type-heading">This page could not be loaded.</h2>
    <p className="text-muted-foreground">Try reloading it.</p>
  </div>;
}

export default function HostPage() {
  return <Section>
    <Suspense fallback={<Container size="narrow"><p role="status">Loading…</p></Container>}>
      <HostArea />
    </Suspense>
  </Section>;
}
