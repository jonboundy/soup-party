import type { Metadata } from "next";

import { Instructions } from "@/components/home/event-details";
import { Hero } from "@/components/home/hero";
import { Rsvp } from "@/components/home/rsvp";
import { SoupCascade } from "@/components/home/soup-cascade";
import { SoupRegistry } from "@/components/home/soup-registry";

export const metadata: Metadata = {
  title: "Soup Party 2: Electric Boogaloo",
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
