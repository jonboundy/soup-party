# Dev server css restart

Observed 2026-10-10 while doing SP-12 (Next.js 16.4.0, Turbopack, `@tailwindcss/turbopack` loader configured in `next.config.ts`):

- Editing `src/app/globals.css` while `next dev` is running does not change the served stylesheet. No error is logged and the log still says "Compiled". Restarting the dev server picks the edit up. Reproduced in a scratch copy of the repo with a probe rule.
- New Tailwind utility classes used in `.tsx` files do show up without a restart, so only hand-written CSS in `globals.css` is affected.
- `next build` always compiles the current file, so a production build (`npm run build` then `npx next start -p <port>`) is a reliable way to verify CSS.
- Only one `next dev` can run per checkout ("Another next dev server is already running"). Jon often has one on port 3000 in the workspace; don't kill it — verify against a production build on another port, or ask him to restart.
- The local Postgres container is shared across workspaces. A workspace has no `.env` until `cp .env.example .env`; without it Prisma reports "Connection url is empty" and the app runs in its no-database mode.
