import { EventDetails } from "@/components/home/event-details";
import { Hero } from "@/components/home/hero";
import { Premise } from "@/components/home/premise";
import { Rsvp } from "@/components/home/rsvp";
import { SoupRegistry } from "@/components/home/soup-registry";

export default function Home() {
  return (
    <>
      <Hero />
      <Premise />
      <EventDetails />
      <SoupRegistry />
      <Rsvp />
    </>
  );
}
