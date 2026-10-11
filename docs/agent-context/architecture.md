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

## Public/private boundaries
- Public reads expose only active soups and approved fields: name, category, description, contributor display name. No edit tokens, raw email, admin metadata, or full RSVP records.
- Writes validate server-side, enforce limits/rate limiting, and prevent mass assignment.
- Guest edits require a valid secret link; host actions require authenticated authorization.
- Use idempotency / double-submit protection.

## Duplicate soup handling
- Normalize whitespace, casing, punctuation, and common trailing "soup" wording.
- Compare exact normalized names and obvious naming variants, with an extensible similarity heuristic for near matches.
- Show the matching existing soup(s) and contributor names.
- Warn, never block: guests may override (chicken noodle varieties and personal versions can coexist). So no database uniqueness constraint on normalized names.
- Never promise mathematically perfect classification.
