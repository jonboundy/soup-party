import "server-only";

import { scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";
import { promisify } from "node:util";

const deriveKey = promisify<string, Buffer, number, ScryptOptions, Buffer>(scrypt);

/** Nobody's password is longer; refuse before spending work on it. */
const PASSWORD_MAX_LENGTH = 256;

/**
 * Whether `password` is the host's. There is no host account and no stored
 * password: the only credential is the hash in HOST_PASSWORD_HASH, written by
 * `npm run host:password` as `scrypt:N:r:p:salt:key`. While that is unset or
 * unreadable, nothing matches.
 */
export async function verifyHostPassword(password: unknown) {
  const [scheme, N, r, p, salt, key] = (process.env.HOST_PASSWORD_HASH ?? "").split(":");
  if (scheme !== "scrypt" || !salt || !key) return false;
  if (typeof password !== "string" || !password || password.length > PASSWORD_MAX_LENGTH) {
    return false;
  }
  try {
    const expected = Buffer.from(key, "base64url");
    const cost = { N: Number(N), r: Number(r), p: Number(p) };
    const actual = await deriveKey(
      // The same characters typed on another keyboard are the same password.
      password.normalize("NFKC"),
      Buffer.from(salt, "base64url"),
      expected.length,
      { ...cost, maxmem: 256 * cost.N * cost.r },
    );
    return timingSafeEqual(actual, expected);
  } catch {
    // Parameters scrypt rejects are a misconfiguration, not a match.
    return false;
  }
}
