# Scope and tickets

Snapshot of the PRD and Jira board as of 2026-10-10 (all 28 tickets were To Do then; check Jira for live status — see [prd and jira links](prd-and-jira-links.md)). Product framing is in [product vision](product-vision.md).

## Changed by Jon on 2026-10-11, after the PRD snapshot

These supersede the PRD wording summarized below wherever the two disagree. The PRD and Jira had not been updated to match when this was written, and none of it has a ticket yet.

- **A response is one person or a couple.** No party size is asked for. An optional second name makes a party of two, both names reach the host, and both first names appear beside the soup. Implemented.
- **A soup is only its name.** Category and description are removed. Implemented. SP-25's bowls can no longer vary by category and need another source of variation, such as the soup's name.
- **Recipes, so guests can make the soups after the party.** Optional on a soup, in any combination of a link, typed text, and up to three photos of a cookbook page or a handwritten card. Guests add them at RSVP or later through the private edit link, and the host can add one on a guest's behalf. Public as soon as added, through a “Recipe” link in the registry to a noindex page per soup. Photos are shrunk in the browser and stored in Postgres, not in a file store. Implemented on 2026-10-11, link and text first and photos after. One change from what was first agreed: photos are sent when the form is saved, like its other fields, not the moment they are chosen.

## Changed by Jon on 2026-10-13

- **A recipe is one kind of thing.** This supersedes “in any combination” in the recipes note above. A recipe is a link, or the recipe written out, or up to three photos, and never two together. The form offers a row of None, Link, Text and Photos under the soup's name, in place of the “Add a recipe” button and its three stacked fields, and shows only the chosen kind's field. Saving a recipe as another kind removes the one it was, and the form says so first. A recipe that is a link is linked to directly from the registry; text and photos keep the soup's recipe page. Jon chose to keep the recipe in the RSVP form and the edit link, over a separate page reached from the receipt. Nothing was live, so existing recipes of more than one kind were reduced by the migration to their text, then their photos, then their link. Implemented.

## Changed by Jon on 2026-10-12

- **Guests are not asked whether they are coming.** Jon shares the site with friends and does not need to hear from those who are not. The RSVP form has no attendance question: sending it means coming. A guest who cannot come after all cancels from the private edit link, and saving from that link again returns them. `DECLINED` remains in the data model as the cancelled state; the host's dashboard and editor call it “Cancelled,” and the editor can still set either. Implemented. This supersedes “attending/declining” in the v1.0 list, journeys B and C, and the launch checklist below.
- **The date, time and location are in the hero.** They sit in a row under the headline and the bowl, and between the call to action and the bowl on a small screen, so nobody scrolls for them. The “premise” band is removed, and the details section is reduced to a short band for the instructions. Jon chose this over the five stacked sections the page had. Implemented.

## Changed by Jon on 2026-10-13

- **The registry's rows are tighter, and the page stays one scroll.** Jon expects about ten soups. He considered making the three sections tabs or pages of their own, and a registry that scrolls in place, and chose shorter rows instead: from the `sm` breakpoint a soup, who is bringing it and its recipe link share one line in aligned columns, and on a phone the contributor stays under the soup with less padding. Every soup remains visible without a click. Implemented.
- **Two sponsors, named in the footer.** GoochBuddy (https://goochbuddy.netlify.app/) and Opossum Catcher (https://www.jonboundy.com/opossum) are joke sites of Jon's that his friends like. The footer of every page reads “Sponsored by GoochBuddy and Opossum Catcher” opposite the copyright, each name a link that opens in a new tab. Jon chose this over a line above the hero's headline, a band after the RSVP form, and a section of its own with a tile for each. No ticket. Implemented in `src/components/layout/site-footer.tsx`.
- **This is the second annual party, titled “Soup Party 2: Electric Boogaloo.”** The title is the home page's browser and link-preview title, and sits once above the hero's headline in uppercase. The wordmark, the other pages' titles and the footer still say “Soup Party.” Jon chose these two places over the supporting line, the wordmark, the footer and letters for it in the alphabet soup. He then asked for more on the page: “Electric Boogaloo” is a neon sign in the tomato accent with a soft glow, which sputters on with four quick flashes as the page loads, then flickers briefly every six or eight seconds like an old sign on a business (two flickers, then later three, on a 14-second cycle; Jon asked for both on 2026-10-14); it is lit and still under reduced motion, and has no glow for more contrast or print. He chose this from mockups over a sequel title card with a large “2,” a second-annual seal on the rim of the bowl, and a tomato line whose letters wave on hover. This is a deliberate exception to “no blinking” in [product vision](product-vision.md): about two seconds on load, then a fraction of a second every few seconds. No ticket. Implemented in `src/app/page.tsx`, `src/components/home/hero.tsx` and the `event-title` rules in `src/app/globals.css`.

- **SP-24's messages.** The ticket only suggested. From the options put to him, Jon chose a few flat phrases and the guest's name appearing in the soup after they RSVP. Built with SOUP PARTY, MORE SOUP, BRING SOUP and STILL SOUP, and first names after an RSVP. Jon then chose BRING SPOON, GOOD SOUP, GOOD STIR and GOOD JOB after many stirs. The rotation is now SOUP PARTY, GOOD SOUP, GOOD STIR, BRING SPOON, MORE SOUP, STILL SOUP, BRING SOUP. GOOD JOB appears once per visit at the next message after fifteen stirs (an implementation choice), without advancing the rotation; RSVP names take priority. Left out because he did not pick them: a count of the registry's soups (NINE SOUPS), TODAY on the day, and a registered soup's name. Originally built on Claude's recommendation with messages on the third stir, then every fourth. Jon superseded that and lowered the minimum: one brief stir is enough, with no minimum speed, and formation begins after 200 milliseconds of no movement, without waiting for the broth to slow. Each completed stir now starts forming the next phrase as soon as input pauses. Word letters cannot be stirred while forming or for three seconds after fully forming; loose letters can still move around their perimeter. Once the hold ends, stirring releases the word letters again, including an ongoing movement. Without input, the word stays in place. Reduced-motion visitors see the bowl as before, with no message; asked about that, Jon said “We don't need to worry about reduced-motion for this site,” so it is not a decision to bring to him again. The existing static fallbacks stay. Jon later reported that stirring did not reveal words: the counter originally waited for the broth to slow between gestures. Fixed so a pause of more than 200 milliseconds separates stirs while the broth can keep spinning; the animation also waits for a pending message after tiny movements.

- **Browser and link-preview images.** On 2026-10-13 Jon chose to copy the existing cascading soup bowls for the favicon and chose the dark neon “Electric Boogaloo” sequel design (option 2) for the full-size link preview. Implemented with a tomato bowl SVG, ICO fallback and Apple icon, plus one static 1200 × 630 Open Graph image also used for the large Twitter card. Sources and export notes are in [preview assets](../brand/README.md). No ticket.

## Changed by Jon on 2026-10-13

- **Remember an RSVP after reload.** Successful guest creation, edits and cancellation set a private cookie for 180 days. Returning in that browser shows the current saved receipt and edit link instead of another RSVP form; the header and hero say “Your RSVP.” Cancellations remain remembered and can be restored with their original link. Guests still save that link for other devices. Implemented without a ticket or database migration.

## Changed by Jon on 2026-10-14

- **Bird night.** Games are played at the party, which Jon and his friends call “bird night.” He wanted it known without standing out. From four placements he chose two: the hero's supporting line ends “Also bird night.”, and the Details band has a second paragraph under the instructions, in the same colour as they are (Jon first had it muted, then asked for the match), “It is also bird night. Bring your games.” Both are in the code, not the `events` row. Left out: a fourth fact beside the date, time and location, and the RSVP confirmation. Lowercase “bird night” as Jon wrote it; he was asked about capitals and did not say. No ticket. Implemented in `src/components/home/hero.tsx` and `src/components/home/event-details.tsx`.

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
