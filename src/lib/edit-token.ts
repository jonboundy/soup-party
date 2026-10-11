import "server-only";

import { createHash, randomBytes } from "node:crypto";

/**
 * The hash stored for an edit token. The tokens are random and long, so a
 * fast, unsalted hash is enough to keep a leaked database from yielding them.
 */
export function hashEditToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function isEditToken(token: unknown): token is string {
  return typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);
}

/**
 * A new private edit token (256 random bits) and the hash to store for it.
 * The raw token belongs in the guest's edit link and nowhere else: never in
 * the database, a log or a public response.
 */
export function createEditToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashEditToken(token) };
}
