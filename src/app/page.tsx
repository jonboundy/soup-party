import type { Metadata } from "next";

import { Instructions } from "@/components/home/event-details";
import { Hero } from "@/components/home/hero";
import { Rsvp } from "@/components/home/rsvp";
import { SoupCascade } from "@/components/home/soup-cascade";
import { SoupRegistry } from "@/components/home/soup-registry";

export const metadata: Metadata = {
  title: "Soup Party 2: Electric Boogaloo",
  openGraph: {
    title: "Soup Party 2: Electric Boogaloo",
    description: "Everyone brings soup. Everyone eats soup.",
    siteName: "Soup Party",
    type: "website",
    url: "/",
  },
};

export default function Home() {
  return (
    <>
      <SoupCascade />
      <Hero />
      <Instructions />
      <SoupRegistry />
      <Rsvp />
    </>
  );
}
