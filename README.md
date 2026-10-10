# Soup Party

RSVP website for a soup potluck. Everyone brings soup. Everyone eats soup.

Standalone Next.js app, deployed separately from jonboundy.com at soup.jonboundy.com (planned).

## Stack

- Next.js (App Router) and TypeScript
- Tailwind CSS v4
- shadcn/ui (`base-nova` style, Base UI primitives)
- ESLint

## Development

Requires Node.js 20 or later.

```bash
npm install
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

## Structure

```
src/
  app/             Routes, layouts and global styles
  components/ui/   shadcn/ui components (add with `npx shadcn@latest add <name>`)
  lib/             Shared utilities
```

Import from `src` with the `@/` alias, e.g. `@/components/ui/button`.
