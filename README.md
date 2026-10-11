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
  components/home/     Homepage sections, in page order
  components/host/     The host's sign-in form
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

- **Validation.** `parseRsvp` in `src/lib/rsvp-schema.ts` holds the rules: a name of up to 80 characters, one of the two answers, and a party of 1 to 10 when attending. The limits themselves are in `src/lib/rsvp-form.ts`, which the form shares.
- **Retries.** Each new form gets a fresh 256-bit submission token at request time, outside the cached page shell. This becomes its private edit credential; only the hash is stored. Repeated submissions of the same validated answers return the original confirmation and link, including concurrent requests and retries after a lost response. The unique token hash prevents duplicate rows. An immutable `submission_hash` fingerprint rejects different answers submitted with an already-used token; guests should use their edit link instead. Validation failures and duplicate-soup warnings do not consume the token. Replaying creation never overwrites later edits/cancellation. Reloading starts a new form, so two intentionally separate forms can register separately.
- **Abuse controls.** All create/edit/cancel attempts that reach database handling share an atomic PostgreSQL rate limiter (`src/lib/rsvp-rate-limit.ts`): 30 attempts per 10-minute window per Vercel-provided client IP. Addresses are hashed before storage. Without Vercel's trusted header, a shared 100-attempt window applies; client-provided forwarded headers are ignored. Inactive buckets are removed after a day on the next attempt. A hidden honeypot rejects automated submissions. Invalid requests count toward the budget; a throttled response preserves answers and shows a retry time. Database/limiter failures stop writes and show a retry message. Other deployment platforms need a trusted-proxy identity adapter before enabling per-client limits.
- **Soup.** An attending guest may name the soup they are bringing, or leave the name blank and decide later. A named soup needs a category from `src/lib/soup-categories.ts` and may have a description of up to 280 characters. A category or description without a name is ignored, as is any soup sent with a decline.
- **Storage.** `createRsvp` in `src/lib/rsvp.ts` writes the RSVP and its soup, if there is one, in a single transaction. A declined RSVP has no party size, so the headcount is the sum of `party_size` over attending RSVPs. An attending RSVP with no soup row is a guest who has not decided.
- **Duplicate warnings.** Before saving a named soup, the action reads the current active registry and compares names with `src/lib/soup-matches.ts`. Case, accents, punctuation, whitespace and trailing “soup” wording produce exact matches. Ingredient order, common preparation qualifiers and shared multi-word names produce similar matches; sharing a single ingredient alone does not. This is a naming heuristic, not a recipe classifier. The warning shows matching soups and their contributors' first names; nothing is saved until the guest chooses another name or selects “Register this soup anyway.” An acknowledgment applies only to the displayed name, and all fields are validated again. Blank soups and declines skip matching. `normalizeSoupName` remains unchanged, so existing stored names need no migration.
- **Confirmation.** A saved response replaces the form with a receipt (`src/components/rsvp-confirmation.tsx`), built from the validated values the action stored: name, response, party size, and the soup's name, category and description, or “To be decided.” A registered soup adds “Your soup has been registered.” Declines and cancellations show the same receipt; a soup they still hold is named as no longer listed. Cancellation reads it from the saved RSVP, since it is sent without the guest's answers. Focus moves to the receipt's heading. The receipt lasts until the page is reloaded, so a new RSVP's receipt says its link will not be shown again.
- **Private editing.** Confirmation displays a saveable private URL at `/rsvp/edit?token=…`, with a copy button and a selectable full URL. Every RSVP gets a 256-bit random token (`src/lib/edit-token.ts`); only its SHA-256 hash is stored. The uncached edit page and every edit/cancel action verify that credential on the server. Unknown, malformed, and removed links reveal no RSVP details. The edit page is excluded from indexing, sends no referrer, and uses private/no-store response caching.
- **Changes and cancellation.** The edit form starts with the saved response and shares creation validation and duplicate warnings, excluding its own soup. It can change name, attendance, party size, and soup details, add a soup later, or remove one by clearing the name. RSVP and soup edits share a transaction. Cancellation needs an explicit confirmation, marks the response declined, clears its party size, and releases its soup from the active registry. Declines/cancellations retain the soup details privately and the link stays usable if plans change again. Successful edits and cancellation expire the `soups` tag and refresh the current page. No email delivery is implemented.

Concurrent edits serialize on the RSVP row: the last completed write wins, with RSVP and soup fields from one whole transaction. Cancellation uses the same row lock and retains soup details. The test suite covers these races, simultaneous creation retries, altered-token payloads, schema failures, honeypots, and concurrent rate-limit requests.

## Public soup registry

The homepage's “The soups.” section lists active soups alphabetically, with their category, optional description, and contributor's first name. The RSVP form explains that only the first name is public.

`getPublicSoups` in `src/lib/public-soups.ts` selects only approved display fields and filters to attending RSVPs. Private RSVP fields, identifiers, edit tokens, and surnames are excluded from its result. The query uses a cache tagged `soups`, with a 1-second revalidation interval, 5-minute client stale time, and 5-minute expiry; a successful soup registration immediately expires that tag and refreshes the submitting guest's page. Other visits revalidate shortly afterward; an already-open page updates on a new visit or reload. Guest edit/cancel actions invalidate the same tag; future host actions should too.

The list is included in the initial HTML, with a “Loading…” label on the Soups navigation link while navigation is pending. The registry shows “No soups yet.” when empty (including previews without a database), and reports an unavailable state on database errors.

## Host sign-in

`/host` is the host's area. Guests have no accounts and nothing links there. Signed out, it shows a password form; signed in, a sign-out button and, for now, a placeholder where the RSVP overview will go.

- **Password.** There is one host and no account table. `npm run host:password` asks for a password of at least 12 characters and prints its scrypt hash, which goes in `HOST_PASSWORD_HASH`. The password itself is stored nowhere. `verifyHostPassword` in `src/lib/host-password.ts` compares in constant time. While the variable is empty or unreadable nobody can sign in, and the form says sign-in is not available.
- **Sessions.** A correct password creates a 256-bit random token (`src/lib/host-session.ts`). The browser keeps it for seven days in an `HttpOnly`, `Secure`, `SameSite=Lax` cookie named `__Host-soup-host`, or `soup-host` in development, where there is no HTTPS. The `host_sessions` table keeps only an HMAC of the token, keyed with the password hash. Signing out deletes that row, so a copied cookie stops working too. Changing `HOST_PASSWORD_HASH` ends every session. Expired rows are removed at the next sign-in.
- **Authorization.** `isHostSignedIn()` looks the cookie up in the database on every request, and `requireHost()` redirects anyone else to `/host`. Every host page, server action and data read has to call one of them itself: a check in a layout, or on the page a form is rendered on, does not cover the action behind it. Host actions that change RSVPs should also expire the `soups` tag.
- **Abuse controls.** Sign-in attempts are counted before the password is looked at: 10 per 10-minute window per client, through the RSVP limiter but with a budget of their own. Without Vercel's trusted header every client shares that budget. Next.js refuses a server action posted from another origin. `/host` is excluded from indexing and sent with `no-store`.

A production build served locally with `npm run start` sets the `Secure` cookie over HTTP. Chrome and Firefox accept that on `localhost`; Safari does not, so sign in with `npm run dev` there.

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
