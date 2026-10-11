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

Implemented during SP-17 (2026-10-10): confirmations display a copyable private link. Cancellation uses `DECLINED` with a null party size, retaining soup details privately and keeping the link usable for a later return. Clearing the soup name while attending removes the soup row. Guest edits and cancellation invalidate the public registry cache. See the README and data-model documentation for current behavior.

Implemented during SP-19 (2026-10-11): create, edit and cancel actions all return one receipt shape to the submitting guest only — name, response, party size, the soup's name/category/description, and the edit path. A decline or cancellation names the soup it retains as no longer listed. The receipt is not persisted in the browser; it is gone after a reload, and the copy says so.

## Public/private boundaries
- Public reads expose only active soups and approved fields: name, category, description, contributor display name. No edit tokens, raw email, admin metadata, or full RSVP records.
- Writes validate server-side, enforce limits/rate limiting, and prevent mass assignment.
- Guest edits require a valid secret link; host actions require authenticated authorization.
- Use idempotency / double-submit protection.

Implemented during SP-18 (2026-10-10): fresh request-time form tokens reuse the unique edit-token hash for database-enforced creation idempotency; an immutable original-payload fingerprint rejects conflicting retries. PostgreSQL rate-limit buckets enforce limits across instances, with a hidden honeypot and accessible retry messages. Concurrent edits/cancellation serialize on the RSVP row; last completed write wins atomically. See the README for budgets, trusted-client identity and deployment limitations.

Implemented during SP-20 (2026-10-11): the host signs in at `/host` with one password. Only its scrypt hash exists, in the `HOST_PASSWORD_HASH` environment variable; there is no account table and no auth library. Sessions are random tokens in an `HttpOnly` `__Host-` cookie, stored in `host_sessions` as an HMAC keyed with the password hash, valid seven days, revoked on sign-out and by a password change. Sign-in attempts have their own rate-limit budget. `requireHost()` / `isHostSignedIn()` in `src/lib/host-session.ts` are the server-side check, and each host page, action and data read must call one itself. SP-20 shipped the sign-in and a placeholder page only; the dashboard and host edits are SP-21 and SP-22.

## Duplicate soup handling
- Normalize whitespace, casing, punctuation, and common trailing "soup" wording.
- Compare exact normalized names and obvious naming variants, with an extensible similarity heuristic for near matches.
- Show the matching existing soup(s) and contributor names.
- Warn, never block: guests may override (chicken noodle varieties and personal versions can coexist). So no database uniqueness constraint on normalized names.
- Never promise mathematically perfect classification.
