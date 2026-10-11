// How the one or two guests behind a response are named. Safe to import in
// the browser.

type Guests = { attendeeName: string; secondName: string | null };

/** Full names, for the guests themselves and the host. */
export function guestNames({ attendeeName, secondName }: Guests) {
  return secondName ? `${attendeeName} and ${secondName}` : attendeeName;
}

/** First names only, which is all the public sees of a guest. */
export function publicGuestNames({ attendeeName, secondName }: Guests) {
  const first = (name: string) => name.trim().split(/\s+/u)[0];
  return secondName ? `${first(attendeeName)} and ${first(secondName)}` : first(attendeeName);
}
