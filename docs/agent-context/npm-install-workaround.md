# Npm install workaround

Observed 2026-10-10 while doing SP-8 on Jon's Mac (Node 22.14, npm 10.9.2):

- `npm install -D vitest` failed with `Cannot read properties of null (reading 'edgesOut')` (an npm resolver crash, not a project problem). Deleting `node_modules` did not help. `npx -y npm@11 install -D <pkg>` worked, and the resulting lockfile installs fine with `npm ci` on npm 10.
- Vitest 5 needs `@types/node` 22+; the project is on `@types/node` 20, so Vitest 4 was installed.
- The `prisma` package's `latest` dist-tag pointed at an 8.0 release candidate while `@prisma/client` latest was 7.10.0. Install both at the same explicit 7.x version rather than `@latest`.

Local database and test setup are in the repo README, not here.
