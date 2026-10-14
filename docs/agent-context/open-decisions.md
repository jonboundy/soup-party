# Open decisions

PRD §11 listed these as open on 2026-10-10 (it still lists the settled ones below). Check the PRD ([prd and jira links](prd-and-jira-links.md)) or ask Jon before building anything that depends on one; update or delete this memory as they get settled.

- The event's physical location and serving instructions.
- Whether guests can RSVP without a soup indefinitely.
- Whether the RSVP edit link is only displayed on screen or also emailed. Email delivery is not assumed for v1.0 (so no email field is required by the v1.0 data model).

**Settled:** date and time — on 2026-10-12 Jon gave Saturday, November 21, 2026 at 3:00 PM. He did not name a time zone; `America/New_York`, his Mac's, is assumed and unconfirmed. This is not in the code: it is set on the `events` row of each database, as [the data model](../data-model.md) describes.

**Settled:** public contributor names — Jon chose first names only during SP-15. The RSVP form explains this; the public query derives the first whitespace-delimited part of the RSVP name on the server.

**Settled:** one soup per response — on 2026-10-11 Jon limited a response to one person or a couple, named individually, sharing one soup. Both first names are public beside it (“Brought by Jon and Gigi”).

**Settled:** recipes — on 2026-10-11 Jon chose to show them publicly as soon as they are added, and to store recipe photos in Postgres rather than a file store. On 2026-10-13 he made a recipe one kind, a link or text or photos, added in the RSVP form, with a link recipe linked to directly from the soup list. See [scope and tickets](scope-and-tickets.md).

**Settled:** database hosting — Jon chose Neon (Vercel Marketplace, free plan) on 2026-10-10 during SP-9; deployment details are in the repo README.

**Settled:** host authentication — Jon chose a single host password over GitHub or Google sign-in on 2026-10-11 during SP-20. No provider and no auth dependency; details are in the repo README and [architecture](architecture.md).

**How to apply:** keep these configurable or easy to change rather than hard-coding a guess — e.g. event details as data on the Event record, contributor display name as a derived field. Related constraints are in [architecture](architecture.md).
