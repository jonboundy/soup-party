# Scope and tickets

Snapshot of the PRD and Jira board as of 2026-10-10 (all 28 tickets were To Do then; check Jira for live status — see [prd and jira links](prd-and-jira-links.md)). Product framing is in [product vision](product-vision.md).

## Changed by Jon on 2026-10-11, after the PRD snapshot

These supersede the PRD wording summarized below wherever the two disagree. The PRD and Jira had not been updated to match when this was written, and none of it has a ticket yet.

- **A response is one person or a couple.** No party size is asked for. An optional second name makes a party of two, both names reach the host, and both first names appear beside the soup. Implemented.
- **A soup is only its name.** Category and description are removed. Implemented. SP-25's bowls can no longer vary by category and need another source of variation, such as the soup's name.
- **Recipes, so guests can make the soups after the party.** Optional on a soup, in any combination of a link, typed text, and up to three photos of a cookbook page or a handwritten card. Guests add them at RSVP or later through the private edit link, and the host can add one on a guest's behalf. Public as soon as added, through a “Recipe” link in the registry to a noindex page per soup. Photos are shrunk in the browser and stored in Postgres, not in a file store. Link and text are implemented (2026-10-11); photos are not, and are the next piece of work.

## v1.0 — Invitation-ready launch (label `v1-0`, SP-6..SP-22)
- Responsive public landing page: minimalist hero, event info, RSVP call-to-action, soup registry.
- RSVP attending/declining, party size, name, optional soup registration.
- Soup name, category, optional description; guest may decide the soup later.
- Public soup list with contributor names; duplicate/similar soup warnings.
- Secure private edit link per RSVP; changes and cancellation.
- Host-only login, RSVP overview, editing/removal.
- Server validation, basic spam protection, reliability checks, deployment, accessibility.

## v1.1 — Interactive Soup (label `v1-1`, SP-23..SP-28)
- Alphabet soup hero: top-down bowl that responds to cursor/touch stirring; pasta letters with inertia and constrained motion; occasionally resolves into words such as SOUP PARTY. Not canvas-only text — provide accessible alternatives. Pauses when out of view; reduced-motion fallback is static.
- Soup registry visualization: each active soup as a miniature bowl with subtle color/category differences; tap/hover/keyboard reveals details; conventional list remains the primary accessible fallback; no competitive layout or rank.
- Optional stirring counter and restrained Easter eggs — never required to complete a task. Prefer two or three polished moments over many features.
- Performance, mobile, keyboard accessibility, reduced-motion fallbacks. Must not block or slow RSVP flows.

## Out of scope
Payment, guest accounts, voting, leaderboards, awards, social feeds, soup ratings, scheduling features.

## Journeys
- **A. View:** visit on phone/desktop → event title, explanation, date/time, location, practical instructions → browse registered soups and who is bringing them → choose to RSVP.
- **B. RSVP + soup:** name, attending/declining, party size (if attending) → optional soup name/category/description → exact/near-duplicate candidates surfaced while typing or before submit → guest picks another soup or proceeds knowingly → confirmation plus a secure private edit URL.
- **C. Update/cancel:** return via private edit link → change status, party size, soup fields, or cancel → public registry updates; a cancelled/declined RSVP's soup is not shown as active.
- **D. Host:** authenticate → review total headcount, RSVP details, soups, undecided soups, declines → edit/remove entries; destructive actions require confirmation.

## Jira map (epic → tasks, priority)
- **SP-1 Project Foundation:** SP-6 Initialize standalone Next.js application (High) · SP-7 Design system and responsive layouts (High) · SP-8 Database and application models (High) · SP-9 Vercel deployment and soup.jonboundy.com (High)
- **SP-2 Event Website:** SP-10 Homepage (High) · SP-11 Event details section (High) · SP-12 Subtle page motion and interaction polish (Low)
- **SP-3 RSVP & Soup Registry:** SP-13 RSVP submission flow (Highest) · SP-14 Soup registration (Highest) · SP-15 Public soup registry (Highest) · SP-16 Duplicate soup detection (High) · SP-17 Guest edit/cancel RSVP (High) · SP-18 RSVP and soup form validation (High) · SP-19 RSVP confirmation experience (Medium)
- **SP-4 Host Administration:** SP-20 Host authentication (High) · SP-21 Host RSVP dashboard (High) · SP-22 Host manages registrations (Medium)
- **SP-5 Interactive Soup Experiences (v1.1):** SP-23 Interactive alphabet soup bowl (High) · SP-24 Hidden alphabet soup messages (Medium) · SP-25 Interactive soup registry visualization (Medium) · SP-26 Soup stirring Easter egg (Low) · SP-27 Accessibility and performance of interactive effects (Medium) · SP-28 Subtle site-wide Easter eggs (Low)

Only ticket summaries/fields were captured here, not ticket descriptions — read the ticket before starting work on it.

## Launch checklist (PRD §10)
- Subdomain HTTPS works independently of jonboundy.com.
- Correct event date/time/timezone/address and practical instructions configured.
- RSVP attending and declining work; party size validated.
- Optional soup registration and public soup listing work.
- Similar soups yield understandable warnings; overrides work.
- Secure guest edit/cancel works; no token leakage.
- Host authentication and management are server-protected.
- Functional on mobile; keyboard and screen-reader basics verified.
- Rate limiting, server validation, errors, and duplicate-submit defenses in place.
- Interactive v1.1 functionality does not block or slow RSVP flows.
