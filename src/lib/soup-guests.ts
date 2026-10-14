// How the RSVP form tells the bowl of soup in the hero who has just
// responded. They are far apart on the page and share no state, and the form
// is also used where there is no bowl, in which case nobody is listening.

const EVENT = "soup-party:guests";

/** The names as the guests gave them. The bowl makes what it can of them. */
export function announceSoupGuests(names: (string | null)[]) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: names }));
}

/** Returns a function that stops listening. */
export function onSoupGuests(listener: (names: (string | null)[]) => void) {
  const hear = (event: Event) => listener((event as CustomEvent<(string | null)[]>).detail);
  window.addEventListener(EVENT, hear);
  return () => window.removeEventListener(EVENT, hear);
}
