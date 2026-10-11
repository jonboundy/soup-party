# Architecture

Snapshot of PRD §7–8 as of 2026-10-10; see [prd and jira links](prd-and-jira-links.md). Some choices are still open — see [open decisions](open-decisions.md).

## Stack
- **App:** Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui.
- **Storage:** PostgreSQL with Prisma and migrations.
- **Mutations:** Server Actions or Route Handlers with server-side schema validation (e.g. Zod).
- **Host auth:** secure, server-enforced. Never rely on obscured URLs as access control. Avoid custom password storage unless necessary.
- **Deployment:** dedicated Vercel project and environment; add DNS for soup.jonboundy.com without changing the existing jonboundy.com site's routing. HTTPS required.
- **Observability:** basic error monitoring/logging; do not log edit tokens or unnecessary personally identifying information.
- **Testing:** unit tests for duplicate normalization and schema validation; integration tests for create/edit/cancel permissions; smoke test of the critical mobile flow.

## Suggested data model
- **Event:** id, title, startsAt (timezone-aware), locationLabel, address, instructions, updatedAt. One active event initially; exact November date/time and address to be configured once known.
- **RSVP:** id (UUID), attendeeName, status (ATTENDING / DECLINED), partySize (positive integer when attending), createdAt, updatedAt, editTokenHash (unique).
- **Soup:** id (UUID), rsvpId (unique in v1.0), name, normalizedName, category (includes OTHER), description (nullable), createdAt, updatedAt. One optional soup per RSVP in v1.0; schema may later be relaxed for multiple soups.
- **Admin:** auth data via the chosen auth provider or a secure host-only implementation.

## Edit tokens
Store only a hash (`editTokenHash`); never store the raw token. The private edit URL carries a high-entropy raw token that is validated against the hash server-side. Tokens must never appear in public endpoints or logs.

Implemented during SP-17 (2026-10-10): confirmations display a copyable private link. Cancellation uses `DECLINED` with a null party size, retaining soup details privately and keeping the link usable for a later return. Clearing the soup name while attending removes the soup row. Guest edits and cancellation invalidate the public registry cache. See the README and data-model documentation for current behavior.

Implemented during SP-19 (2026-10-11): create, edit and cancel actions all return one receipt shape to the submitting guest only — name, response, party size, the soup's name/category/description, and the edit path. A decline or cancellation names the soup it retains as no longer listed. The receipt is not persisted in the browser; it is gone after a reload, and the copy says so.

## Public/private boundaries
- Public reads expose only active soups and approved fields: name, category, description, contributor display name. No edit tokens, raw email, admin metadata, or full RSVP records.
- Writes validate server-side, enforce limits/rate limiting, and prevent mass assignment.
- Guest edits require a valid secret link; host actions require authenticated authorization.
- Use idempotency / double-submit protection.

Implemented during SP-18 (2026-10-10): fresh request-time form tokens reuse the unique edit-token hash for database-enforced creation idempotency; an immutable original-payload fingerprint rejects conflicting retries. PostgreSQL rate-limit buckets enforce limits across instances, with a hidden honeypot and accessible retry messages. Concurrent edits/cancellation serialize on the RSVP row; last completed write wins atomically. See the README for budgets, trusted-client identity and deployment limitations.

Implemented during SP-20 (2026-10-11): the host signs in at `/host` with one password. Only its scrypt hash exists, in the `HOST_PASSWORD_HASH` environment variable; there is no account table and no auth library. Sessions are random tokens in an `HttpOnly` `__Host-` cookie, stored in `host_sessions` as an HMAC keyed with the password hash, valid seven days, revoked on sign-out and by a password change. Sign-in attempts have their own rate-limit budget. `requireHost()` / `isHostSignedIn()` in `src/lib/host-session.ts` are the server-side check, and each host page, action and data read must call one itself.

Implemented during SP-21 (2026-10-11): signed in, `/host` shows the RSVP overview — guests expected (sum of attending party sizes), counts of attending, declined, soups and undecided responses, and lists of each with full submissions, including a declined guest's retained soup. `getHostOverview()` in `src/lib/host-rsvps.ts` calls `requireHost()`, is uncached, counts from the same rows it lists, and never selects token or submission hashes. The overview refreshes on reload.

Implemented during SP-22 (2026-10-11): each response links to `/host/rsvps/<id>`, where the host corrects or removes it. Corrections reuse guest validation (`parseRsvp`) and the guest edit transaction (`writeRsvp` in `src/lib/rsvp.ts`), so a decline still retains the soup unlisted and the guest's edit link is unchanged; duplicate warnings and rate limits do not apply to the host. Removal hard-deletes the RSVP and its soup after an on-page confirmation that the action also requires, and kills the guest's link. `saveHostRsvp` / `removeHostRsvp` call `requireHost()` before reading any field, expire the `soups` tag and redirect to `/host`. The editor is keyed on the saved answers because Next.js can restore a previously visited page's form state.

## Interactive soup (v1.1)

Implemented during SP-23 (2026-10-11): the hero has a top-down bowl of alphabet soup (`src/components/home/alphabet-soup.tsx`), server-rendered as SVG with real text letters and named as one image. `src/lib/alphabet-soup.ts` is a DOM-free fluid simulation: stirring with a cursor (hover, no button) or a touch drag moves the broth, which carries and turns the letters. Touch uses `touch-action: pan-y`, so vertical swipes still scroll the page. The animation loop runs only while the bowl is on screen and unsettled; it turns slightly when first seen, then requests no frames until stirred. Reduced motion and no-JavaScript show the served arrangement, static. The letter set already includes a spare set of the letters in SOUP PARTY, for SP-24. Not done here: hidden messages (SP-24), the stir counter (SP-26), keyboard stirring (SP-27). No new dependencies. See the README's “Alphabet soup” section.

Added 2026-10-11 at Jon's request, outside the Jira tickets: a cascade of small line-drawn bowls of soup, steaming and seen from the side, falls slowly behind the home page only (`src/components/home/soup-cascade.tsx`, layout in `src/lib/soup-cascade.ts`, animation in `globals.css`). Jon chose this over falling pasta letters, full-colour or faint top-down bowls, bowls kept to the margins, and a repeating pattern. Server-rendered markup and CSS with no script; fixed under all content, `aria-hidden`, no pointer events; still under reduced motion and removed for more contrast, forced colours and print. See the README's “Soup cascade” section.

## Duplicate soup handling
- Normalize whitespace, casing, punctuation, and common trailing "soup" wording.
- Compare exact normalized names and obvious naming variants, with an extensible similarity heuristic for near matches.
- Show the matching existing soup(s) and contributor names.
- Warn, never block: guests may override (chicken noodle varieties and personal versions can coexist). So no database uniqueness constraint on normalized names.
- Never promise mathematically perfect classification.
