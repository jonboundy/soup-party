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
| `npm run vercel-build` | Build on Vercel, applying migrations first in production |

## Structure

```
docs/                  Reference documentation
prisma/                Database schema and migrations
src/
  app/                 Routes, layouts and global styles
  components/home/     Homepage sections, in page order
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
- **Storage.** `createRsvp` in `src/lib/rsvp.ts` writes the row. A declined RSVP has no party size, so the headcount is the sum of `party_size` over attending RSVPs.
- **Edit tokens.** Every RSVP gets a random token (`src/lib/edit-token.ts`) and only its SHA-256 hash is stored. Nothing shows the token to the guest yet.

## Deployment

The app is the `soup-party` project on Vercel, separate from the project that serves jonboundy.com. Merging to `main` deploys to production at https://soup.jonboundy.com; every other branch gets a preview deployment.

- **Domain.** DNS for jonboundy.com is hosted at Porkbun. `soup` is a CNAME to the target Vercel shows under the project's Domains settings, and Vercel issues the certificate. No other record is involved.
- **Database.** Production uses a Neon PostgreSQL database (`soup-party-db`), installed through the Vercel Marketplace, which manages its environment variables. The app connects with the pooled `DATABASE_URL`; migrations use the direct `DATABASE_URL_UNPOOLED`.
- **Migrations.** `vercel.json` builds with `npm run vercel-build`, which runs `prisma migrate deploy` before `next build` on production deployments only, so a failed migration stops the release.
- **Previews.** The database is connected to the production environment only. Preview deployments have no `DATABASE_URL` and never touch production data.
- **Secrets.** Environment variables live in Vercel, never in the repository. `vercel env ls` lists them and `vercel env add` adds one.

## Design system

Warm off-white surfaces, near-black type and one tomato accent. Everything is on show at `/styleguide`.

- **Tokens** live in `src/app/globals.css`. `brand` is the accent and is used sparingly; `accent` is shadcn's hover surface. The site is light-only.
- **Type** uses the `type-display`, `type-title`, `type-heading`, `type-lead` and `type-eyebrow` utilities, which scale with the viewport.
- **Layout** is `Container` (page gutters and max width, `size="narrow"` for forms) inside `Section` (vertical rhythm). The root layout supplies the header, footer and skip link.
- **Motion** is brief and quiet. In-page links scroll smoothly. `Reveal`, or `<SectionHeader reveal>`, fades its children up one after another the first time it scrolls into view. They are only hidden once the browser has confirmed they are below the fold, so they stay visible without JavaScript, with reduced motion and in print.
- **Controls** are 44px tall by default so they are comfortable to tap. Text and control outlines meet WCAG AA contrast, and `prefers-contrast` and `prefers-reduced-motion` are honored.
