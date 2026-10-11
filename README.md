# Soup Party

RSVP website for a soup potluck. Everyone brings soup. Everyone eats soup.

Standalone Next.js app, deployed separately from jonboundy.com at https://soup.jonboundy.com.

## Stack

- Next.js (App Router) and TypeScript
- Tailwind CSS v4
- shadcn/ui (`base-nova` style, Base UI primitives)
- PostgreSQL with Prisma
- ESLint and Vitest

## Development

Requires Node.js 20.19 or later, and Docker for the local database.

```bash
npm install
cp .env.example .env
npm run db:up
npm run db:migrate
npm run dev
```

The app runs at http://localhost:3000.

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Generate route types and run the TypeScript compiler |
| `npm test` | Run the tests |
| `npm run db:up` | Start the local PostgreSQL container |
| `npm run db:migrate` | Apply migrations in development, creating one if the schema changed |
| `npm run db:deploy` | Apply pending migrations without creating any (production) |
| `npm run db:studio` | Browse and edit data in Prisma Studio |
| `npm run host:password` | Print the `HOST_PASSWORD_HASH` value for a host password |
| `npm run vercel-build` | Build on Vercel, applying migrations first in production |

## Structure

```
docs/                  Reference documentation
prisma/                Database schema and migrations
scripts/               Command-line helpers
src/
  app/                 Routes, layouts and global styles
  components/home/     Homepage sections, in page order, and the hero's bowl of soup
  components/host/     The host's sign-in form, RSVP overview and correction form
  components/layout/   Page structure: container, section, reveal, site header, nav and footer
  components/ui/       shadcn/ui components (add with `npx shadcn@latest add <name>`)
  generated/prisma/    Prisma client (generated, not committed)
  lib/                 Shared utilities, validation and the database client
tests/                 Tests, most of which need a database
```

Import from `src` with the `@/` alias, e.g. `@/components/ui/button`.

## Database

The app reads `DATABASE_URL`. `compose.yaml` runs PostgreSQL 17 on port 54329 with the credentials in `.env.example`; any other PostgreSQL database works if you point `DATABASE_URL` at it.

Query through the shared client, on the server only:

```ts
import { db } from "@/lib/db";

const event = await db.event.findUniqueOrThrow({ where: { id: 1 } });
```

The Prisma client is generated into `src/generated/prisma` on `npm install`. After changing the schema, run `npx prisma generate` to update it. Model and enum types come from `@/generated/prisma/client`.

Tables, relations and constraints are documented in [docs/data-model.md](docs/data-model.md), along with how to set the event's date, time, location and instructions.

`npm test` uses a separate database, the one in `DATABASE_URL` with `_test` appended to its name. It is created and migrated automatically, and the tests delete its RSVPs as they go.

## RSVPs

The form on the homepage (`src/components/home/rsvp-form.tsx`) posts to the `submitRsvp` server action in `src/app/actions.ts`. The form leaves validation to the action, which is the only gate.

- **Validation.** `parseRsvp` in `src/lib/rsvp-schema.ts` holds the rules: a name of up to 80 characters, an optional second guest's name of the same length, and one of the two answers. The limits themselves are in `src/lib/rsvp-form.ts`, which the form shares.
- **Retries.** Each new form gets a fresh 256-bit submission token at request time, outside the cached page shell. This becomes its private edit credential; only the hash is stored. Repeated submissions of the same validated answers return the original confirmation and link, including concurrent requests and retries after a lost response. The unique token hash prevents duplicate rows. An immutable `submission_hash` fingerprint rejects different answers submitted with an already-used token; guests should use their edit link instead. Validation failures and duplicate-soup warnings do not consume the token. Replaying creation never overwrites later edits/cancellation. Reloading starts a new form, so two intentionally separate forms can register separately.
- **Abuse controls.** All create/edit/cancel attempts that reach database handling share an atomic PostgreSQL rate limiter (`src/lib/rsvp-rate-limit.ts`): 30 attempts per 10-minute window per Vercel-provided client IP. Addresses are hashed before storage. Without Vercel's trusted header, a shared 100-attempt window applies; client-provided forwarded headers are ignored. Inactive buckets are removed after a day on the next attempt. A hidden honeypot rejects automated submissions. Invalid requests count toward the budget; a throttled response preserves answers and shows a retry time. Database/limiter failures stop writes and show a retry message. Other deployment platforms need a trusted-proxy identity adapter before enabling per-client limits.
- **Guests.** A response is from one person or from two responding together: the form's optional “Second guest” field takes the other name. Nobody is asked for a party size. `rsvps.party_size` is set from the names, 1 or 2, whenever an attending response is written, and a database constraint keeps the two in step. Both names are kept on a decline. `src/lib/guest-names.ts` joins them: in full for the receipt and the host, first names only for anything public.
- **Soup.** An attending guest may name the soup they are bringing, up to 80 characters, or leave the name blank and decide later. The name is all a soup has. Any soup sent with a decline is ignored.
- **Storage.** `createRsvp` in `src/lib/rsvp.ts` writes the RSVP and its soup, if there is one, in a single transaction. A declined RSVP has no party size, so the headcount is the sum of `party_size` over attending RSVPs. An attending RSVP with no soup row is a guest who has not decided.
- **Duplicate warnings.** Before saving a named soup, the action reads the current active registry and compares names with `src/lib/soup-matches.ts`. Case, accents, punctuation, whitespace and trailing “soup” wording produce exact matches. Ingredient order, common preparation qualifiers and shared multi-word names produce similar matches; sharing a single ingredient alone does not. This is a naming heuristic, not a recipe classifier. The warning shows matching soups and their contributors' first names; nothing is saved until the guest chooses another name or selects “Register this soup anyway.” An acknowledgment applies only to the displayed name, and all fields are validated again. Blank soups and declines skip matching. `normalizeSoupName` remains unchanged, so existing stored names need no migration.
- **Confirmation.** A saved response replaces the form with a receipt (`src/components/rsvp-confirmation.tsx`), built from the validated values the action stored: the name or names, the response, and the soup's name or “To be decided.” A registered soup adds “Your soup has been registered.” Declines and cancellations show the same receipt; a soup they still hold is named as no longer listed. Cancellation reads it from the saved RSVP, since it is sent without the guest's answers. Focus moves to the receipt's heading. The receipt lasts until the page is reloaded, so a new RSVP's receipt says its link will not be shown again.
- **Private editing.** Confirmation displays a saveable private URL at `/rsvp/edit?token=…`, with a copy button and a selectable full URL. Every RSVP gets a 256-bit random token (`src/lib/edit-token.ts`); only its SHA-256 hash is stored. The uncached edit page and every edit/cancel action verify that credential on the server. Unknown, malformed, and removed links reveal no RSVP details. The edit page is excluded from indexing, sends no referrer, and uses private/no-store response caching.
- **Changes and cancellation.** The edit form starts with the saved response and shares creation validation and duplicate warnings, excluding its own soup. It can change either name, add or remove the second guest, change attendance and the soup, add a soup later, or remove one by clearing its name. RSVP and soup edits share a transaction. Cancellation needs an explicit confirmation, marks the response declined, clears its party size, and releases its soup from the active registry. Declines/cancellations retain the soup details privately and the link stays usable if plans change again. Successful edits and cancellation expire the `soups` tag and refresh the current page. No email delivery is implemented.

Concurrent edits serialize on the RSVP row: the last completed write wins, with RSVP and soup fields from one whole transaction. Cancellation uses the same row lock and retains soup details. The test suite covers these races, simultaneous creation retries, altered-token payloads, schema failures, honeypots, and concurrent rate-limit requests.

## Public soup registry

The homepage's “The soups.” section lists active soups alphabetically, each with the first name of whoever is bringing it: “Brought by Ada”, or “Brought by Ada and Charles” for two. The RSVP form explains that only first names are public.

`getPublicSoups` in `src/lib/public-soups.ts` selects only approved display fields and filters to attending RSVPs. Private RSVP fields, identifiers, edit tokens, and surnames are excluded from its result. The query uses a cache tagged `soups`, with a 1-second revalidation interval, 5-minute client stale time, and 5-minute expiry; a successful soup registration immediately expires that tag and refreshes the submitting guest's page. Other visits revalidate shortly afterward; an already-open page updates on a new visit or reload. Guest edit/cancel actions and the host's corrections and removals invalidate the same tag.

The list is included in the initial HTML, with a “Loading…” label on the Soups navigation link while navigation is pending. The registry shows “No soups yet.” when empty (including previews without a database), and reports an unavailable state on database errors.

## Alphabet soup

The hero's bowl (`src/components/home/alphabet-soup.tsx`) is tomato alphabet soup seen from above, and it can be stirred.

- **Stirring.** A cursor moving through the broth stirs it; no button is held. On a touch screen a drag stirs. A swipe that starts vertically scrolls the page as it would anywhere else (`touch-action: pan-y`), so the bowl never traps a scroll; a stir that starts sideways can then go in any direction.
- **Motion.** `src/lib/alphabet-soup.ts` treats the broth as an incompressible fluid on a 28-cell grid across the bowl. A stroke drags the broth near it along, the rest circulates round the bowl, and it all slows to a stop in about ten seconds. Each letter travels with the broth under it and turns with its eddies; letters that drift onto each other ease apart, and none leaves the bowl. Nothing in the module touches the DOM.
- **When it runs.** Only while the bowl is on screen and something in it is still moving. The soup is turning slightly when first seen, as if just served, and settles. Once still, no animation frames are requested until the next stir. Scrolled out of view it pauses where it is, and carries on when it returns.
- **Without motion.** The server renders the bowl complete, with its 40 letters in a fixed arrangement, so it is there before JavaScript loads and without it. With `prefers-reduced-motion` it stays exactly like that and does not respond to stirring.
- **Markup.** Two stacked SVGs: the bowl, and the letters as text in the site's typeface on a layer of their own, so moving them does not repaint the bowl. Together they are one image named “A bowl of alphabet soup.” The letters spell nothing and are not read out.
- **Letters.** The whole alphabet, a second set of the letters in SOUP PARTY, and a few more vowels. `layoutSoupLetters` scatters them from a seed with integer arithmetic only, so the server and every browser agree on where they start.

The bowl sits beside the hero text from the `lg` breakpoint and below the call to action on smaller screens. Its colours are the `--soup-*` tokens in `src/app/globals.css`.

## Soup cascade

Behind the home page, small steaming bowls of soup fall slowly past (`src/components/home/soup-cascade.tsx`). The other pages do not have it.

- **Bowls.** Line drawings seen from the side, each with one of six soups in it: tomato, pea, squash, chowder, borscht and chicken. Their colours are the `--soup-*` tokens.
- **Motion.** Each bowl falls from just above the window to just below it, wandering a little sideways and rocking a few degrees either way, then starts again. There are three depths: nearer bowls are larger, less faint and faster, taking about 40 seconds to cross the window against about 75 for the furthest. The layer is fixed to the window, so the fall is the same wherever the page is scrolled, and it fades out towards the top and bottom edges.
- **Cost.** A server component and two CSS animations (`soup-cascade` and `soup-cascade-rock` in `src/app/globals.css`), with no script. Only `translate` and `rotate` change, so nothing is laid out or painted again while it runs.
- **Layout.** `layoutSoupCascade` in `src/lib/soup-cascade.ts` gives 15 bowls their column, speed and soup from a seed. Positions come from a low-discrepancy sequence, so any first few are evenly spread; below the `sm` breakpoint only the first 7 are shown, slightly smaller.
- **Without motion.** A bowl's own position is where it is when the page loads, and the animation starts from there. With `prefers-reduced-motion` both animations are off and the bowls stay scattered, upright and still.
- **Out of the way.** The layer is `aria-hidden`, takes no pointer events and sits under all content, so bowls pass behind text and behind the RSVP form's fields. It is removed for `prefers-contrast: more`, forced colours and print.

## Host sign-in

`/host` is the host's area. Guests have no accounts and nothing links there. Signed out, it shows a password form; signed in, the RSVP overview and a sign-out button.

- **Password.** There is one host and no account table. `npm run host:password` asks for a password of at least 12 characters and prints its scrypt hash, which goes in `HOST_PASSWORD_HASH`. The password itself is stored nowhere. `verifyHostPassword` in `src/lib/host-password.ts` compares in constant time. While the variable is empty or unreadable nobody can sign in, and the form says sign-in is not available.
- **Sessions.** A correct password creates a 256-bit random token (`src/lib/host-session.ts`). The browser keeps it for seven days in an `HttpOnly`, `Secure`, `SameSite=Lax` cookie named `__Host-soup-host`, or `soup-host` in development, where there is no HTTPS. The `host_sessions` table keeps only an HMAC of the token, keyed with the password hash. Signing out deletes that row, so a copied cookie stops working too. Changing `HOST_PASSWORD_HASH` ends every session. Expired rows are removed at the next sign-in.
- **Authorization.** `isHostSignedIn()` looks the cookie up in the database on every request, and `requireHost()` redirects anyone else to `/host`. Every host page, server action and data read has to call one of them itself: a check in a layout, or on the page a form is rendered on, does not cover the action behind it. Host actions that change RSVPs should also expire the `soups` tag.
- **Abuse controls.** Sign-in attempts are counted before the password is looked at: 10 per 10-minute window per client, through the RSVP limiter but with a budget of their own. Without Vercel's trusted header every client shares that budget. Next.js refuses a server action posted from another origin. `/host` is excluded from indexing and sent with `no-store`.

A production build served locally with `npm run start` sets the `Secure` cookie over HTTP. Chrome and Firefox accept that on `localhost`; Safari does not, so sign in with `npm run dev` there.

## Host overview

Signed in, `/host` shows every response (`src/components/host/dashboard.tsx`):

- **Figures.** Guests expected is the sum of party sizes across attending RSVPs, so two guests responding together count as two. Attending, declined, soups and undecided count responses. A soup counts only while its RSVP is attending, as in the public registry; undecided is attending RSVPs with no soup.
- **Lists.** Attending RSVPs in the order received, with full names, party size and soup name; active soups alphabetically with the contributors' full names; attending guests without a soup; and declines, including a soup kept on file by a guest who cancelled, marked as not listed.
- **Times.** When each response was received and last changed, shown in the event's `time_zone`, or UTC until one is set.

`getHostOverview` in `src/lib/host-rsvps.ts` calls `requireHost()` itself, reads the database on every request with no cache, and derives the figures from the same rows as the lists. It selects no edit-token or submission hashes. The page does not update itself: reloading it shows the latest.

## Host corrections

Each response in the attending and declined lists has an Edit link to `/host/rsvps/<id>` (`src/components/host/rsvp-editor.tsx`), where the host can correct it or remove it.

- **Corrections.** The form starts with the guest's saved answers and can change either name, the response and the soup. `saveHostRsvp` in `src/app/host/actions.ts` validates them with `parseRsvp`, as a guest's are, and `updateHostRsvp` in `src/lib/host-rsvps.ts` writes them through the same transaction a guest's edit uses, so the same rules hold: clearing the soup name removes the soup, and a decline keeps the soup on file, unlisted. The guest's private link is untouched and keeps working. Duplicate-soup warnings and the RSVP rate limit are for guests and do not apply.
- **Removal.** “Remove response” asks for confirmation before anything is sent, and `removeHostRsvp` refuses a request that does not carry it. Removal deletes the RSVP row and, by cascade, its soup. Nothing is kept, and the guest's private link stops working. It cannot be undone.
- **Authorization.** The page, both actions and all three functions in `src/lib/host-rsvps.ts` call `requireHost()` themselves. A signed-out request is redirected to `/host` before any submitted field is read. The RSVP id in the URL identifies a row and authorizes nothing.
- **Afterwards.** A saved correction or a removal expires the `soups` tag and returns the host to the overview. A response removed in another tab is reported as no longer there, and nothing is changed.

## Deployment

The app is the `soup-party` project on Vercel, separate from the project that serves jonboundy.com. Merging to `main` deploys to production at https://soup.jonboundy.com; every other branch gets a preview deployment.

- **Domain.** DNS for jonboundy.com is hosted at Porkbun. `soup` is a CNAME to the target Vercel shows under the project's Domains settings, and Vercel issues the certificate. No other record is involved.
- **Database.** Production uses a Neon PostgreSQL database (`soup-party-db`), installed through the Vercel Marketplace, which manages its environment variables. The app connects with the pooled `DATABASE_URL`; migrations use the direct `DATABASE_URL_UNPOOLED`.
- **Migrations.** `vercel.json` builds with `npm run vercel-build`, which runs `prisma migrate deploy` before `next build` on production deployments only, so a failed migration stops the release.
- **Previews.** The database is connected to the production environment only. Preview deployments have no `DATABASE_URL` and never touch production data. Host sign-in is not available on them.
- **Secrets.** Environment variables live in Vercel, never in the repository. `vercel env ls` lists them and `vercel env add` adds one.
- **Host password.** Run `npm run host:password`, add its output with `vercel env add HOST_PASSWORD_HASH production`, and redeploy. To change the password, replace the value the same way; this signs the host out everywhere.

## Design system

Warm off-white surfaces, near-black type and one tomato accent. Everything is on show at `/styleguide`.

- **Tokens** live in `src/app/globals.css`. `brand` is the accent and is used sparingly; `accent` is shadcn's hover surface. The site is light-only.
- **Type** uses the `type-display`, `type-title`, `type-heading`, `type-lead` and `type-eyebrow` utilities, which scale with the viewport.
- **Layout** is `Container` (page gutters and max width, `size="narrow"` for forms) inside `Section` (vertical rhythm). The root layout supplies the header, footer and skip link.
- **Motion** is brief and quiet. In-page links scroll smoothly. `Reveal`, or `<SectionHeader reveal>`, fades its children up one after another the first time it scrolls into view. They are only hidden once the browser has confirmed they are below the fold, so they stay visible without JavaScript, with reduced motion and in print.
- **Controls** are 44px tall by default so they are comfortable to tap. Text and control outlines meet WCAG AA contrast, and `prefers-contrast` and `prefers-reduced-motion` are honored.
