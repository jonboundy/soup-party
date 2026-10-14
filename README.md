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

- **Validation.** `parseRsvp` in `src/lib/rsvp-schema.ts` holds the rules: a name of up to 80 characters, an optional second guest's name of the same length, one of the two answers, and the soup and recipe rules below. The limits themselves are in `src/lib/rsvp-form.ts`, which the form shares.
- **Retries.** Each new form gets a fresh 256-bit submission token at request time, outside the cached page shell. This becomes its private edit credential; only the hash is stored. Repeated submissions of the same validated answers return the original confirmation and link, including concurrent requests and retries after a lost response. The unique token hash prevents duplicate rows. An immutable `submission_hash` fingerprint, which covers the recipe when there is one, rejects different answers submitted with an already-used token; guests should use their edit link instead. Validation failures and duplicate-soup warnings do not consume the token. Replaying creation never overwrites later edits/cancellation. Reloading starts a new form, so two intentionally separate forms can register separately.
- **Abuse controls.** All create/edit/cancel attempts that reach database handling share an atomic PostgreSQL rate limiter (`src/lib/rsvp-rate-limit.ts`): 30 attempts per 10-minute window per Vercel-provided client IP. Addresses are hashed before storage. Without Vercel's trusted header, a shared 100-attempt window applies; client-provided forwarded headers are ignored. Inactive buckets are removed after a day on the next attempt. Recipe photos are counted apart, 60 requests per window per client, so that a few recipes sent from one address, as at the party, do not stop anyone there from changing an RSVP. A hidden honeypot rejects automated submissions. Invalid requests count toward the budget; a throttled response preserves answers and shows a retry time. Database/limiter failures stop writes and show a retry message. Other deployment platforms need a trusted-proxy identity adapter before enabling per-client limits.
- **Guests.** A response is from one person or from two responding together: the form's optional “Second guest” field takes the other name. Nobody is asked whether they are coming: a response is from someone who is, and a guest who is not simply does not send one. Nobody is asked for a party size either. `rsvps.party_size` is set from the names, 1 or 2, whenever an attending response is written, and a database constraint keeps the two in step. Both names are kept on a cancellation. `src/lib/guest-names.ts` joins them: in full for the receipt and the host, first names only for anything public.
- **Soup.** A guest may name the soup they are bringing, up to 80 characters, or leave the name blank and decide later. A soup is its name and, optionally, a recipe.
- **Recipe.** Once the soup has a name, a row offers what its recipe is: None, Link, Text or Photos. A recipe is one of them and never two together. Only the chosen kind's field is shown: a link, the recipe written out, up to 10,000 characters, or up to three photos, which “Recipe photos” below describes. It may be given at RSVP or later through the private edit link. The form sends the kind as `recipeKind`, and `parseRsvp` reads only that kind's field; a kind left blank, or no kind at all, is no recipe. What was typed for another kind stays in the form in case the guest switches back, and is not saved. Choosing a kind with a tap or a click moves focus to its field; the arrow keys move along the row. A link pasted without a scheme is taken as `https://`; anything but an `http(s)` address on a named site is refused, as is one carrying a username or password. The written recipe keeps its line breaks, with trailing spaces and runs of blank lines tidied. Neither field has a `maxLength`, which would cut a pasted recipe short silently; the action reports one that is too long. A recipe with no soup named is an error rather than dropped. The fields are shared by the guest's form and the host's (`src/components/recipe-fields.tsx`).
- **Storage.** `createRsvp` in `src/lib/rsvp.ts` writes the RSVP and its soup, if there is one, in a single transaction. A cancelled RSVP is stored as `DECLINED` and has no party size, so the headcount is the sum of `party_size` over attending RSVPs. An attending RSVP with no soup row is a guest who has not decided.
- **Duplicate warnings.** Before saving a named soup, the action reads the current active registry and compares names with `src/lib/soup-matches.ts`. Case, accents, punctuation, whitespace and trailing “soup” wording produce exact matches. Ingredient order, common preparation qualifiers and shared multi-word names produce similar matches; sharing a single ingredient alone does not. This is a naming heuristic, not a recipe classifier. The warning shows matching soups and their contributors' first names; nothing is saved until the guest chooses another name or selects “Register this soup anyway.” An acknowledgment applies only to the displayed name, and all fields are validated again. Blank soups skip matching. `normalizeSoupName` remains unchanged, so existing stored names need no migration.
- **Confirmation.** A saved response replaces the form with a receipt (`src/components/rsvp-confirmation.tsx`), built from the validated values the action stored: the name or names, the soup's name or “To be decided,” and whether a recipe was provided. A registered soup adds “Your soup has been registered.” A cancellation shows the same receipt; a soup it still holds is named as no longer listed. Cancellation reads it from the saved RSVP, since it is sent without the guest's answers. Focus moves to the receipt's heading. The receipt lasts until the page is reloaded, so a new RSVP's receipt says its link will not be shown again.
- **Private editing.** Confirmation displays a saveable private URL at `/rsvp/edit?token=…`, with a copy button and a selectable full URL. Every RSVP gets a 256-bit random token (`src/lib/edit-token.ts`); only its SHA-256 hash is stored. The uncached edit page and every edit/cancel action verify that credential on the server. Unknown, malformed, and removed links reveal no RSVP details. The edit page is excluded from indexing, sends no referrer, and uses private/no-store response caching.
- **Changes and cancellation.** The edit form starts with the saved response and shares creation validation and duplicate warnings, excluding its own soup. It can change either name, add or remove the second guest, change the soup, add a soup later, or remove one by clearing its name. It can add, change or remove the recipe the same way. A save replaces the recipe with the one kind the form sent, in the same transaction: saved as a link, text or none, the soup's photos are deleted, and saved as photos, its link and text are cleared. The form says what a change of kind will remove before it is saved (“Saving removes the 2 photos.”). Clearing the soup's name removes the soup and its recipe together, and the form says so when there is one to lose. RSVP and soup edits share a transaction. Cancellation needs an explicit confirmation, marks the response declined, clears its party size, and releases its soup from the active registry. A cancellation retains the soup and its recipe privately and the link stays usable if plans change again: the edit form then says the RSVP is cancelled, and saving it returns the guest and their soup to the list. The host can cancel a response for a guest, or restore one, from their editor. Successful edits and cancellation expire the `soups` tag and refresh the current page. No email delivery is implemented.

Concurrent edits serialize on the RSVP row: the last completed write wins, with RSVP and soup fields from one whole transaction. Cancellation uses the same row lock and retains soup details. The test suite covers these races, simultaneous creation retries, altered-token payloads, schema failures, honeypots, and concurrent rate-limit requests.

## Public soup registry

The homepage's “The soups.” section lists active soups alphabetically, each with the first name of whoever is bringing it: “Brought by Ada”, or “Brought by Ada and Charles” for two. The RSVP form explains that only first names are public.

`getPublicSoups` in `src/lib/public-soups.ts` selects only approved display fields and filters to attending RSVPs. Private RSVP fields, RSVP identifiers, edit tokens, and surnames are excluded from its result. A soup's own id is public only when its recipe is text or photos, as the address of its recipe page. The query uses a cache tagged `soups`, with a 1-second revalidation interval, 5-minute client stale time, and 5-minute expiry; a successful soup registration immediately expires that tag and refreshes the submitting guest's page. Other visits revalidate shortly afterward; an already-open page updates on a new visit or reload. Guest edit/cancel actions and the host's corrections and removals invalidate the same tag.

### Recipes

A soup with a recipe has a “Recipe” link in the registry (`src/components/recipe-link.tsx`). A recipe is one kind of thing: a link, the recipe written out, or photos of it.

- **A link** is linked to directly, so the registry's “Recipe” leaves the site for the address the guest gave, with no page of ours in between.
- **Text or photos** are read at `/soups/<soup id>` (`src/app/soups/[id]/page.tsx`): the soup's name, who is bringing it, and the written recipe or its photos.

`recipeLinks` in `src/lib/recipe-link.ts` decides between the two, for the registry and the host's overview alike. Recipes are public as soon as they are saved, and nothing reviews them first.

- **One kind.** The writes enforce it: `writeRsvp` in `src/lib/rsvp.ts` and `addRecipePhoto` in `src/lib/recipe-photos.ts`, which refuses a photo to a soup whose recipe is a link or text. The database holds a soup to a link or text, not both (`soups_recipe_kind_check`), but cannot see photos from there. Should a link and photos ever meet, the registry links to the page, which shows both.

- **What is public.** `getPublicRecipe` returns a page only for an active soup that has a recipe. A declined or cancelled guest's recipe is kept but has no page, like their soup; it returns if they do. Anything else at that address, including an RSVP's id, shows “This recipe is not here.” The response is still a 200, since the page has started streaming by then.
- **Guests' content.** The written recipe is rendered as plain text, never as HTML or Markdown: a blank line starts a paragraph and other line breaks are kept. The link carries `rel="noopener noreferrer nofollow ugc"` wherever it appears, and is named to a screen reader by the site it leads to (“Recipe for Minestrone, at example.com”).
- **Search engines.** Recipe pages are excluded from indexing by a `robots` meta tag and an `X-Robots-Tag` header (`next.config.ts`). They are not private: anyone with the address can read one.
- **Caching.** The page shares the registry's `soups` tag and timings, so every write that expires the registry expires recipes too. Only well-formed ids reach the cache.
- **Host.** The host's editor has the same row and fields, photos included, to add a recipe on a guest's behalf or correct one, and the overview links each soup's recipe as the registry does. A correction replaces the recipe with the one kind the editor sent, as a guest's edit does.

### Recipe photos

A recipe that is photos may have up to three, of a cookbook page or a handwritten card (`src/components/recipe-photos.tsx`). They are stored in PostgreSQL, in `recipe_photos`, not in a file store.

- **Choosing.** “Add photos” opens the device's picker or camera. It is a label around the file input itself, styled as a button, so the browser opens its picker natively for a click, a tap or the keyboard, with no script in between. Each chosen image is redrawn in the browser (`src/lib/shrink-photo.ts`) as a JPEG of at most 1,600 pixels a side and 600 KB, lowering quality and then size until it fits; a phone's photo of several megabytes comes out at a few hundred kilobytes and still reads as a page. A file the browser cannot read as an image is reported and left out. This needs JavaScript, as choosing a kind of recipe does. A saved link or text survives an edit made without it: the form is served with its kind already chosen.
- **Saving.** Chosen and removed photos wait in the form like its other answers, and nothing is sent until it is saved. The response is saved first, as a recipe of photos, which clears any link or text. Then come the removals and the new photos, each in a request of its own (`syncRecipePhotos` in `src/lib/recipe-photo.ts`). A response saved as any other kind sends none: saving it removed the photos it had. One photo to a request keeps every request under Next.js's default 1 MB limit for a Server Action, which is therefore not raised, and means a photo can never hold up or lose an RSVP. A new RSVP's photos are sent with the token the form already holds, which by then is the edit link's.
- **When one fails.** The response is saved all the same. The receipt says how many changes to the photos could not be made, to be made again from the edit link. A recipe changed from a link or text to photos has by then lost the link or text, so if every photo fails it is left with no recipe until they are sent again.
- **What the server accepts.** `addRecipePhoto` and `removeRecipePhoto` in `src/app/actions.ts` check the edit token as an edit does. The file is judged by its bytes, not its name or declared type: `cleanJpeg` in `src/lib/jpeg.ts` accepts only a complete greyscale or colour JPEG within the size limits, reading its structure without decoding it. It copies the image data unchanged and drops every metadata segment (Exif, with its location and device; XMP; comments; thumbnails) and anything after the end of the image, keeping only the JFIF header, an ICC colour profile and Adobe's colour marker. No image library is involved.
- **Three at most.** A photo takes the first free of three positions, and a unique index on soup and position makes the limit a database rule: uploads racing for a place cannot both have it.
- **Serving.** `/soups/<soup id>/photos/<photo id>` (`src/app/soups/[id]/photos/[photoId]/route.ts`) returns a photo only while its soup is active, always as `image/jpeg`, with `nosniff` and `Cache-Control: private, max-age=86400`: a browser may keep it for a day and a shared cache not at all, so a removed photo or a withdrawn soup's stops being served at once. Each first view reads the bytes from the database. The recipe page shows photos at their stored size with plain `<img>` elements; the image optimizer is not used.
- **Declines and removal.** A declined or cancelled guest's photos are kept and not served, like the rest of their recipe; the edit form shows them as numbered placeholders until the soup is listed again. Removing the soup or the RSVP deletes its photos.
- **Host.** The host's editor saves photos the same way: the correction first, with a `photosFollow` field that keeps the action from redirecting or expiring the registry, then the photos, then `finishHostRecipePhotos`, which expires the registry and returns to the responses, or to the editor with a count of the changes that failed. Expiring the registry earlier would redraw the page under the editor, which is keyed on the saved answers and would start again mid-save.
- **Size.** Three photos of 600 KB is at most 1.8 MB a soup.

The list is included in the initial HTML, with a “Loading…” label on the Soups navigation link while navigation is pending. The registry shows “No soups yet.” when empty (including previews without a database), and reports an unavailable state on database errors.

## Alphabet soup

The hero's bowl (`src/components/home/alphabet-soup.tsx`) is tomato alphabet soup seen from above, and it can be stirred.

- **Stirring.** A cursor moving through the broth stirs it; no button is held. On a touch screen a drag stirs. A swipe that starts vertically scrolls the page as it would anywhere else (`touch-action: pan-y`), so the bowl never traps a scroll; a stir that starts sideways can then go in any direction.
- **Motion.** `src/lib/alphabet-soup.ts` treats the broth as an incompressible fluid on a 28-cell grid across the bowl. A stroke drags the broth near it along, the rest circulates round the bowl, and it all slows to a stop in about ten seconds. Each letter travels with the broth under it and turns with its eddies; letters that drift onto each other ease apart, and none leaves the bowl. Nothing in the module touches the DOM.
- **When it runs.** Only while the bowl is on screen and something in it is still moving. The soup is turning slightly when first seen, as if just served, and settles. Once still, no animation frames are requested until the next stir. Scrolled out of view it pauses where it is, and carries on when it returns.
- **Without motion.** The server renders the bowl complete, with its 40 letters in a fixed arrangement, so it is there before JavaScript loads and without it. With `prefers-reduced-motion` it stays exactly like that and does not respond to stirring.
- **Markup.** Two stacked SVGs: the bowl, and the letters as text in the site's typeface on a layer of their own, so moving them does not repaint the bowl. Together they are one image named “A bowl of alphabet soup.” The letters spell nothing and are not read out.
- **Letters.** The whole alphabet, a second set of the letters in SOUP PARTY, and a few more vowels. `layoutSoupLetters` scatters them from a seed with integer arithmetic only, so the server and every browser agree on where they start.

The bowl sits beside the hero text from the `lg` breakpoint, above the date, time and location, and below them on smaller screens. From `lg` it narrows on a short window so that those stay in view. Its colours are the `--soup-*` tokens in `src/app/globals.css`.

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

- **Figures.** Guests expected is the sum of party sizes across attending RSVPs, so two guests responding together count as two. Attending, cancelled, soups and undecided count responses. A soup counts only while its RSVP is attending, as in the public registry; undecided is attending RSVPs with no soup.
- **Lists.** Attending RSVPs in the order received, with full names, party size, soup name and a link to its recipe if it has one; active soups alphabetically with the contributors' full names; attending guests without a soup; and cancellations, including a soup kept on file by a guest who cancelled, marked as not listed.
- **Times.** When each response was received and last changed, shown in the event's `time_zone`, or UTC until one is set.

`getHostOverview` in `src/lib/host-rsvps.ts` calls `requireHost()` itself, reads the database on every request with no cache, and derives the figures from the same rows as the lists. It selects no edit-token or submission hashes. The page does not update itself: reloading it shows the latest.

## Host corrections

Each response in the attending and cancelled lists has an Edit link to `/host/rsvps/<id>` (`src/components/host/rsvp-editor.tsx`), where the host can correct it or remove it.

- **Corrections.** The form starts with the guest's saved answers and can change either name, the response and the soup. `saveHostRsvp` in `src/app/host/actions.ts` validates them with `parseRsvp`, as a guest's are, and `updateHostRsvp` in `src/lib/host-rsvps.ts` writes them through the same transaction a guest's edit uses, so the same rules hold: clearing the soup name removes the soup, and a cancellation keeps the soup on file, unlisted. The guest's private link is untouched and keeps working. Duplicate-soup warnings and the RSVP rate limit are for guests and do not apply.
- **Removal.** “Remove response” asks for confirmation before anything is sent, and `removeHostRsvp` refuses a request that does not carry it. Removal deletes the RSVP row and, by cascade, its soup. Nothing is kept, and the guest's private link stops working. It cannot be undone.
- **Authorization.** The page, both actions and all three functions in `src/lib/host-rsvps.ts` call `requireHost()` themselves. A signed-out request is redirected to `/host` before any submitted field is read. The RSVP id in the URL identifies a row and authorizes nothing.
- **Afterwards.** A saved correction or a removal expires the `soups` tag and returns the host to the overview. A response removed in another tab is reported as no longer there, and nothing is changed.

## Deployment

The app is the `soup-party` project on Vercel, separate from the project that serves jonboundy.com. Merging to `main` deploys to production at https://soup.jonboundy.com; every other branch gets a preview deployment.

- **Domain.** DNS for jonboundy.com is hosted at Porkbun. `soup` is a CNAME to the target Vercel shows under the project's Domains settings, and Vercel issues the certificate. No other record is involved.
- **Database.** Production uses a Neon PostgreSQL database (`soup-party-db`), installed through the Vercel Marketplace, which manages its environment variables. The app connects with the pooled `DATABASE_URL`; migrations use the direct `DATABASE_URL_UNPOOLED`.
- **Migrations.** `vercel.json` builds with `npm run vercel-build`, which runs `prisma migrate deploy` before `next build` on production deployments only, so a failed migration stops the release.
- **Previews.** The database is connected to the production environment only. Preview deployments have no `DATABASE_URL` and never touch production data. Host sign-in is not available on them. The build loads every route, so a route must reach `src/lib/db.ts` only through an `import()` behind a `DATABASE_URL` check; `tests/no-database.test.ts` loads each one without a database.
- **Secrets.** Environment variables live in Vercel, never in the repository. `vercel env ls` lists them and `vercel env add` adds one.
- **Host password.** Run `npm run host:password`, add its output with `vercel env add HOST_PASSWORD_HASH production`, and redeploy. To change the password, replace the value the same way; this signs the host out everywhere.

## Design system

Warm off-white surfaces, near-black type and one tomato accent. Everything is on show at `/styleguide`.

- **Tokens** live in `src/app/globals.css`. `brand` is the accent and is used sparingly; `accent` is shadcn's hover surface. The site is light-only.
- **Type** uses the `type-display`, `type-title`, `type-heading`, `type-lead` and `type-eyebrow` utilities, which scale with the viewport.
- **Layout** is `Container` (page gutters and max width, `size="narrow"` for forms) inside `Section` (vertical rhythm). The root layout supplies the header, footer and skip link.
- **Motion** is brief and quiet. In-page links scroll smoothly. `Reveal`, or `<SectionHeader reveal>`, fades its children up one after another the first time it scrolls into view. They are only hidden once the browser has confirmed they are below the fold, so they stay visible without JavaScript, with reduced motion and in print.
- **Controls** are 44px tall by default so they are comfortable to tap. Text and control outlines meet WCAG AA contrast, and `prefers-contrast` and `prefers-reduced-motion` are honored.
