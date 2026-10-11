"use server";

import { refresh, updateTag } from "next/cache";

import type { RsvpFormState } from "@/lib/rsvp-form";
import { parseRsvp } from "@/lib/rsvp-schema";

/**
 * Records a guest's response. Anyone can post to this, with anything, so only
 * the expected fields are read and nothing is stored unvalidated.
 */
export async function submitRsvp(
  _previous: RsvpFormState,
  formData: FormData,
): Promise<RsvpFormState> {
  if (!(formData instanceof FormData)) {
    return { status: "failed" };
  }

  const parsed = parseRsvp({
    name: formData.get("name"),
    attendance: formData.get("attendance"),
    partySize: formData.get("partySize"),
    soupName: formData.get("soupName"),
    soupCategory: formData.get("soupCategory"),
    soupDescription: formData.get("soupDescription"),
  });
  if (!parsed.success) {
    return { status: "invalid", errors: parsed.errors };
  }

  // Preview deployments have no database.
  if (!process.env.DATABASE_URL) {
    return { status: "failed" };
  }

  try {
    // Imported here because the client cannot be constructed without a database.
    const { createRsvp } = await import("@/lib/rsvp");
    await createRsvp(parsed.data);
  } catch (error) {
    // Only the kind of error is logged: its message can quote what the guest typed.
    console.error(
      "RSVP could not be saved:",
      error instanceof Error ? error.name : typeof error,
      (error as { code?: unknown } | null)?.code ?? "",
    );
    return { status: "failed" };
  }

  const { attendeeName, partySize, soup } = parsed.data;
  if (soup) {
    updateTag("soups");
    refresh();
  }
  return partySize === null
    ? { status: "declined", name: attendeeName }
    : { status: "attending", name: attendeeName, partySize, soup: soup?.name ?? null };
}
