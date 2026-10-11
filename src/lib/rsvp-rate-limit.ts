import "server-only";

import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { headers } from "next/headers";
import { db } from "@/lib/db";

export const RSVP_RATE_WINDOW_SECONDS = 600;
export const RSVP_RATE_LIMIT = 30;

/** Only Vercel's overwritten header is trusted. Other deployments share a bucket. */
export function rateLimitIdentity(requestHeaders: Pick<Headers, "get">) {
  const address = process.env.VERCEL === "1"
    ? requestHeaders.get("x-vercel-forwarded-for")?.trim()
    : undefined;
  return address && isIP(address) ? `ip:${address}` : "shared";
}

/** Atomic across processes and simultaneous requests; no read/modify/write race. */
export async function consumeRsvpAttempt(identity: string) {
  const key = createHash("sha256").update(`rsvp:${identity}`).digest("hex");
  // Small transient table: inactive buckets expire after a day without a cron job.
  await db.$executeRaw`DELETE FROM rsvp_rate_limits
    WHERE window_start < CURRENT_TIMESTAMP - INTERVAL '1 day'`;
  const [result] = await db.$queryRaw<{ attempts: number; retryAfter: number }[]>`
    INSERT INTO rsvp_rate_limits (key, window_start, attempts)
    VALUES (${key}, CURRENT_TIMESTAMP, 1)
    ON CONFLICT (key) DO UPDATE SET
      attempts = CASE WHEN rsvp_rate_limits.window_start <= CURRENT_TIMESTAMP - ${RSVP_RATE_WINDOW_SECONDS} * INTERVAL '1 second'
        THEN 1 ELSE LEAST(rsvp_rate_limits.attempts + 1, 1000000) END,
      window_start = CASE WHEN rsvp_rate_limits.window_start <= CURRENT_TIMESTAMP - ${RSVP_RATE_WINDOW_SECONDS} * INTERVAL '1 second'
        THEN CURRENT_TIMESTAMP ELSE rsvp_rate_limits.window_start END
    RETURNING attempts,
      GREATEST(1, CEIL(EXTRACT(EPOCH FROM (window_start + ${RSVP_RATE_WINDOW_SECONDS} * INTERVAL '1 second' - CURRENT_TIMESTAMP))))::integer AS "retryAfter"
  `;
  // Without a trusted proxy, use a generous site-wide limit, not spoofable IPs.
  const limit = identity === "shared" ? 100 : RSVP_RATE_LIMIT;
  return result.attempts <= limit ? null : result.retryAfter;
}

export async function checkRsvpRateLimit() {
  return consumeRsvpAttempt(rateLimitIdentity(await headers()));
}
