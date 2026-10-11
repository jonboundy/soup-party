import { execFileSync } from "node:child_process";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { signInHost, signOutHost } from "@/app/host/actions";
import { db } from "@/lib/db";
import { verifyHostPassword } from "@/lib/host-password";
import {
  endHostSession, HOST_SESSION_COOKIE, HOST_SESSION_SECONDS, isHostSignedIn, requireHost, startHostSession,
} from "@/lib/host-session";
import { HOST_SIGN_IN_RATE_LIMIT } from "@/lib/rsvp-rate-limit";
import { clearRsvps } from "./database";

type Cookie = { value: string; maxAge?: number; [option: string]: unknown };
// The browser's side of the conversation: one cookie jar and one client address.
const browser = vi.hoisted(() => ({ jar: new Map<string, Cookie>(), address: "192.0.2.1" }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-vercel-forwarded-for": browser.address }),
  cookies: async () => ({
    get: (name: string) => browser.jar.get(name),
    set: (name: string, value: string, options: object) => {
      browser.jar.set(name, { value, ...options });
    },
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => { throw new Error(`redirect:${path}`); },
}));

const password = "correct horse battery soup";
function hashPassword(value: string) {
  return execFileSync("node", ["scripts/hash-host-password.mjs"], { input: value, stdio: "pipe" }).toString().trim();
}
function signIn(fields: Record<string, string | Blob> = { password }) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return signInHost({ status: "idle" }, data);
}
const sessionCookie = () => browser.jar.get(HOST_SESSION_COOKIE);

let passwordHash: string;
beforeAll(() => { passwordHash = hashPassword(password); });
beforeEach(async () => {
  browser.jar.clear();
  browser.address = "192.0.2.1";
  vi.stubEnv("HOST_PASSWORD_HASH", passwordHash);
  vi.stubEnv("VERCEL", "1");
  await clearRsvps();
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
afterAll(async () => db.$disconnect());

describe("host password", () => {
  it("matches only the password the stored hash was made from", async () => {
    expect(passwordHash).toMatch(/^scrypt:32768:8:3:[\w-]{22}:[\w-]{43}$/);
    expect(passwordHash).not.toContain(password);
    expect(hashPassword(password)).not.toBe(passwordHash);
    expect(await verifyHostPassword(password)).toBe(true);
    for (const guess of [
      "", " ", "correct horse battery sou", `${password} `, password.toUpperCase(), passwordHash,
      undefined, null, 1, [password], new Blob([password]), "x".repeat(100_000),
    ]) {
      expect(await verifyHostPassword(guess)).toBe(false);
    }
  });

  it("treats the same characters in another Unicode form as the same password", async () => {
    vi.stubEnv("HOST_PASSWORD_HASH", hashPassword("soupe à l’oignon"));
    expect(await verifyHostPassword("soupe à l’oignon")).toBe(true);
    expect(await verifyHostPassword("soupe a l’oignon")).toBe(false);
  });

  it("refuses passwords too short to resist guessing", () => {
    expect(() => hashPassword("minestrone")).toThrow(/at least 12 characters/);
  });

  it("matches nothing while the hash is missing or unreadable", async () => {
    const [, , , , salt, key] = passwordHash.split(":");
    for (const hash of [
      "", password, "scrypt", `scrypt:32768:8:3:${salt}:`, `bcrypt:32768:8:3:${salt}:${key}`,
      `scrypt:3:8:3:${salt}:${key}`, `scrypt:x:y:z:${salt}:${key}`, `scrypt:32768:8:3::${key}`,
    ]) {
      vi.stubEnv("HOST_PASSWORD_HASH", hash);
      expect(await verifyHostPassword(password)).toBe(false);
      expect(await verifyHostPassword("")).toBe(false);
    }
  });
});

describe("host sign-in", () => {
  it("signs the host in with a session only the server can read back", async () => {
    await expect(signIn()).rejects.toThrow("redirect:/host");
    const cookie = sessionCookie()!;
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
    expect(cookie.value).toMatch(/^[\w-]{43}$/);
    const lifetime = (cookie.expires as Date).getTime() - Date.now();
    expect(lifetime).toBeGreaterThan((HOST_SESSION_SECONDS - 60) * 1000);
    expect(lifetime).toBeLessThanOrEqual(HOST_SESSION_SECONDS * 1000);
    const [session] = await db.hostSession.findMany();
    expect(session.expiresAt).toEqual(cookie.expires);
    expect(JSON.stringify(session)).not.toContain(cookie.value);
    expect(await isHostSignedIn()).toBe(true);
    await expect(requireHost()).resolves.toBeUndefined();
  });

  it("starts no session for a wrong, missing or malformed password", async () => {
    for (const guess of ["", "minestrone", `${password}!`, new Blob([password])]) {
      expect(await signIn({ password: guess })).toEqual({ status: "incorrect" });
    }
    expect(await signIn({})).toEqual({ status: "incorrect" });
    expect(await signIn({ username: "host", passwordHash, token: password })).toEqual({ status: "incorrect" });
    expect(await signInHost({ status: "idle" }, {} as FormData)).toEqual({ status: "failed" });
    expect(sessionCookie()).toBeUndefined();
    expect(await db.hostSession.count()).toBe(0);
    expect(await isHostSignedIn()).toBe(false);
    await expect(requireHost()).rejects.toThrow("redirect:/host");
  });

  it("is unavailable without a password hash or a database", async () => {
    vi.stubEnv("HOST_PASSWORD_HASH", "");
    expect(await signIn()).toEqual({ status: "unavailable" });
    expect(await signIn({ password: "" })).toEqual({ status: "unavailable" });
    vi.stubEnv("HOST_PASSWORD_HASH", passwordHash);
    vi.stubEnv("DATABASE_URL", "");
    expect(await signIn()).toEqual({ status: "unavailable" });
    expect(sessionCookie()).toBeUndefined();
  });

  it("limits guesses per client, including the right one once the budget is spent", async () => {
    for (let i = 0; i < HOST_SIGN_IN_RATE_LIMIT; i++) {
      expect(await signIn({ password: "minestrone" })).toEqual({ status: "incorrect" });
    }
    expect(await signIn()).toEqual({ status: "rate-limited", retryAfter: expect.any(Number) });
    expect(await db.hostSession.count()).toBe(0);
    browser.address = "192.0.2.2";
    await expect(signIn()).rejects.toThrow("redirect:/host");
  });

  it("does not check the password when the limiter is unavailable", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(db, "$executeRaw").mockRejectedValue(new Error("Unavailable"));
    expect(await signIn()).toEqual({ status: "failed" });
    expect(sessionCookie()).toBeUndefined();
    expect(console.error).toHaveBeenCalledExactlyOnceWith("Host sign-in failed:", "Error");
  });
});

describe("host session", () => {
  it("rejects absent, forged and stored-hash credentials", async () => {
    await startHostSession();
    const { value } = sessionCookie()!;
    const [{ tokenHash }] = await db.hostSession.findMany();
    for (const forged of [undefined, "", "1", tokenHash, value.slice(1), `${value}a`, value.replace(/.$/, (c) => (c === "A" ? "B" : "A"))]) {
      browser.jar.clear();
      if (forged !== undefined) browser.jar.set(HOST_SESSION_COOKIE, { value: forged });
      expect(await isHostSignedIn()).toBe(false);
      await expect(requireHost()).rejects.toThrow("redirect:/host");
    }
    browser.jar.set(HOST_SESSION_COOKIE, { value });
    expect(await isHostSignedIn()).toBe(true);
  });

  it("expires, and clears expired sessions at the next sign-in", async () => {
    await startHostSession();
    await db.hostSession.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await isHostSignedIn()).toBe(false);
    browser.jar.clear();
    await startHostSession();
    expect(await db.hostSession.count()).toBe(1);
    expect(await isHostSignedIn()).toBe(true);
  });

  it("revokes the session on sign-out, so a copied cookie stops working", async () => {
    await startHostSession();
    const copied = sessionCookie()!;
    browser.jar.clear();
    await startHostSession();
    const other = sessionCookie()!;
    browser.jar.set(HOST_SESSION_COOKIE, copied);

    await expect(signOutHost()).rejects.toThrow("redirect:/host");
    expect(sessionCookie()).toMatchObject({ value: "", maxAge: 0, httpOnly: true, path: "/" });
    expect(await db.hostSession.count()).toBe(1);
    browser.jar.set(HOST_SESSION_COOKIE, copied);
    expect(await isHostSignedIn()).toBe(false);
    // Another browser's session is its own.
    browser.jar.set(HOST_SESSION_COOKIE, other);
    expect(await isHostSignedIn()).toBe(true);
  });

  it("replaces this browser's session when signing in again", async () => {
    await startHostSession();
    const first = sessionCookie()!;
    await startHostSession();
    expect(sessionCookie()!.value).not.toBe(first.value);
    expect(await db.hostSession.count()).toBe(1);
    browser.jar.set(HOST_SESSION_COOKIE, first);
    expect(await isHostSignedIn()).toBe(false);
  });

  it("ends every session when the password changes or is removed", async () => {
    await startHostSession();
    vi.stubEnv("HOST_PASSWORD_HASH", hashPassword("a different password"));
    expect(await isHostSignedIn()).toBe(false);
    vi.stubEnv("HOST_PASSWORD_HASH", "");
    expect(await isHostSignedIn()).toBe(false);
    await expect(startHostSession()).rejects.toThrow();
    await expect(endHostSession()).resolves.toBeUndefined();
    vi.stubEnv("HOST_PASSWORD_HASH", passwordHash);
    expect(await db.hostSession.count()).toBe(1);
  });

  it("signs out without a session, and without a database", async () => {
    await expect(signOutHost()).rejects.toThrow("redirect:/host");
    vi.stubEnv("DATABASE_URL", "");
    await expect(signOutHost()).rejects.toThrow("redirect:/host");
    expect(await db.hostSession.count()).toBe(0);
  });
});
