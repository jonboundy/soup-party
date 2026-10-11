import "server-only";

import { createHmac, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

export const HOST_SESSION_SECONDS = 7 * 24 * 60 * 60;

const secure = process.env.NODE_ENV === "production";
// Browsers accept a `__Host-` cookie only when it is Secure, site-wide and
// set by this exact host, so no other jonboundy.com subdomain can plant one.
// Development runs over plain HTTP, where that prefix cannot be set.
export const HOST_SESSION_COOKIE = secure ? "__Host-soup-host" : "soup-host";
const cookieOptions = { httpOnly: true, secure, sameSite: "lax", path: "/" } as const;

/**
 * What is stored for a session token. It is keyed with the password hash, so
 * a leaked table yields no usable cookie, changing the password ends every
 * session, and without a password there are no sessions at all.
 */
function hashSessionToken(token: unknown) {
  const key = process.env.HOST_PASSWORD_HASH;
  if (!key || typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  return createHmac("sha256", key).update(token).digest("hex");
}

/** Call only once the password has been verified. Replaces this browser's session. */
export async function startHostSession() {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashSessionToken(token);
  if (!tokenHash) throw new Error("HOST_PASSWORD_HASH is not set.");
  const jar = await cookies();
  const expiresAt = new Date(Date.now() + HOST_SESSION_SECONDS * 1000);
  const replaced = hashSessionToken(jar.get(HOST_SESSION_COOKIE)?.value);
  // Expired sessions are removed here rather than by a cron job.
  await db.hostSession.deleteMany({
    where: { OR: [{ expiresAt: { lte: new Date() } }, ...(replaced ? [{ tokenHash: replaced }] : [])] },
  });
  await db.hostSession.create({ data: { tokenHash, expiresAt } });
  jar.set(HOST_SESSION_COOKIE, token, { ...cookieOptions, expires: expiresAt });
}

/**
 * Whether this request comes from the signed-in host. The cookie proves
 * nothing by itself: its hash has to be found, unexpired, in the database.
 */
export const isHostSignedIn = cache(async () => {
  const tokenHash = hashSessionToken((await cookies()).get(HOST_SESSION_COOKIE)?.value);
  if (!tokenHash) return false;
  const session = await db.hostSession.findUnique({
    where: { tokenHash },
    select: { expiresAt: true },
  });
  return !!session && session.expiresAt > new Date();
});

/**
 * Sends anyone but the signed-in host to the sign-in form. Every host page,
 * server action and data read calls this itself: a check made by a layout or
 * by the page an action is rendered on does not cover them.
 */
export async function requireHost() {
  if (!(await isHostSignedIn())) redirect("/host");
}

/** Revokes the session on the server, so a copied cookie stops working too. */
export async function endHostSession() {
  const jar = await cookies();
  const tokenHash = hashSessionToken(jar.get(HOST_SESSION_COOKIE)?.value);
  // Not `delete`: a `__Host-` cookie can only be overwritten with its own attributes.
  jar.set(HOST_SESSION_COOKIE, "", { ...cookieOptions, maxAge: 0 });
  if (tokenHash) await db.hostSession.deleteMany({ where: { tokenHash } });
}
