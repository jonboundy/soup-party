# Soup Party

RSVP website for a soup potluck. Everyone brings soup. Everyone eats soup.

Standalone Next.js app, deployed separately from jonboundy.com at soup.jonboundy.com (planned).

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

## Structure

```
docs/                  Reference documentation
prisma/                Database schema and migrations
src/
  app/                 Routes, layouts and global styles
  components/layout/   Page structure: container, section, site header and footer
  components/ui/       shadcn/ui components (add with `npx shadcn@latest add <name>`)
  generated/prisma/    Prisma client (generated, not committed)
  lib/                 Shared utilities and the database client
tests/                 Tests that need a database
```

Import from `src` with the `@/` alias, e.g. `@/components/ui/button`.

## Database

The app reads `DATABASE_URL`. `compose.yaml` runs PostgreSQL 17 on port 54329 with the credentials in `.env.example`; any other PostgreSQL database works if you point `DATABASE_URL` at it.

Query through the shared client, on the server only:

```ts
import { db } from "@/lib/db";

const event = await db.event.findUniqueOrThrow({ where: { id: 1 } });
```

The Prisma client is generated into `src/generated/prisma` on `npm install` and whenever `npm run db:migrate` runs. Model and enum types come from `@/generated/prisma/client`.

Tables, relations and constraints are documented in [docs/data-model.md](docs/data-model.md).

`npm test` uses a separate database, the one in `DATABASE_URL` with `_test` appended to its name. It is created and migrated automatically, and the tests delete its RSVPs as they go.

## Design system

Warm off-white surfaces, near-black type and one tomato accent. Everything is on show at `/styleguide`.

- **Tokens** live in `src/app/globals.css`. `brand` is the accent and is used sparingly; `accent` is shadcn's hover surface. The site is light-only.
- **Type** uses the `type-display`, `type-title`, `type-heading`, `type-lead` and `type-eyebrow` utilities, which scale with the viewport.
- **Layout** is `Container` (page gutters and max width, `size="narrow"` for forms) inside `Section` (vertical rhythm). The root layout supplies the header, footer and skip link.
- **Controls** are 44px tall by default so they are comfortable to tap. Text and control outlines meet WCAG AA contrast, and `prefers-contrast` and `prefers-reduced-motion` are honored.
