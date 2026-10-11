"use server";

import { redirect } from "next/navigation";

import type { HostSignInState } from "@/lib/host-form";

/**
 * Starts a host session for the right password. Anyone can post to this, so
 * every attempt is counted before the password is looked at.
 */
export async function signInHost(
  _previous: HostSignInState,
  formData: FormData,
): Promise<HostSignInState> {
  if (!(formData instanceof FormData)) return { status: "failed" };
  // Sessions live in the database and are keyed with the password hash.
  if (!process.env.DATABASE_URL || !process.env.HOST_PASSWORD_HASH) {
    return { status: "unavailable" };
  }
  try {
    const { checkHostSignInRateLimit } = await import("@/lib/rsvp-rate-limit");
    const retryAfter = await checkHostSignInRateLimit();
    if (retryAfter) return { status: "rate-limited", retryAfter };
    const { verifyHostPassword } = await import("@/lib/host-password");
    if (!(await verifyHostPassword(formData.get("password")))) return { status: "incorrect" };
    const { startHostSession } = await import("@/lib/host-session");
    await startHostSession();
  } catch (error) {
    // Only the kind of error is logged, never what was typed.
    console.error("Host sign-in failed:", error instanceof Error ? error.name : typeof error);
    return { status: "failed" };
  }
  redirect("/host");
}

/** Ends the caller's own session, so it needs no authorization of its own. */
export async function signOutHost() {
  if (process.env.DATABASE_URL) {
    try {
      const { endHostSession } = await import("@/lib/host-session");
      await endHostSession();
    } catch (error) {
      console.error("Host sign-out failed:", error instanceof Error ? error.name : typeof error);
    }
  }
  redirect("/host");
}
