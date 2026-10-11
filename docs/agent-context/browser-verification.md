# Browser verification

Worked on 2026-10-10 while doing SP-13 (no browser MCP tools were available in the Conductor session):

- Playwright's browsers are already cached on Jon's Mac in `~/Library/Caches/ms-playwright` (chromium-1248 matched `playwright@1.64.0`). Install the package in a scratch directory outside the repo (`/tmp/...`, `npx -y npm@11 install playwright`) and script it with Node; do not add it to the project.
- Serve a production build on a spare port, as [dev server css restart](dev-server-css-restart.md) describes, with `DATABASE_URL` set to the `soup_party_test` database (`postgresql://soup:soup@localhost:54329/soup_party_test`) for both `npm run build` and `npx next start -p <port>`. The development database `soup_party` is shared across workspaces, so form submissions made while testing should not go there.
- Inspect rows with `docker exec soup-party-db-1 psql -U soup -d soup_party_test -Atc "<sql>"`, and delete what the run created.
- Playwright's `waitUntil: "networkidle"` can hang on a reload after `context.setOffline(true/false)`; use `"load"`.
- Base UI radio items put the `id` prop on a hidden `<input>`, not the visible `role="radio"` element, so select radios by role or by `label[for=...]`.
