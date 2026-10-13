import { Instructions } from "@/components/home/event-details";
import { Hero } from "@/components/home/hero";
import { Rsvp } from "@/components/home/rsvp";
import { SoupCascade } from "@/components/home/soup-cascade";
import { SoupRegistry } from "@/components/home/soup-registry";

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
