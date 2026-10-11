"use server";

import { refresh, updateTag } from "next/cache";

import { hashEditToken, isEditToken } from "@/lib/edit-token";
import { readPublicSoups } from "@/lib/public-soups";
import type { RsvpFormState } from "@/lib/rsvp-form";
import { parseRsvp } from "@/lib/rsvp-schema";
import { findSoupMatches } from "@/lib/soup-matches";

/**
 * Records a guest's response. Anyone can post to this, with anything, so only
 * the expected fields are read and nothing is stored unvalidated.
 */
export async function submitRsvp(
  _previous: RsvpFormState,
  formData: FormData,
): Promise<RsvpFormState> {
  return saveRsvp(formData);
}

export async function editRsvp(
  _previous: RsvpFormState,
  formData: FormData,
): Promise<RsvpFormState> {
  if (!(formData instanceof FormData) || !isEditToken(formData.get("editToken"))) {
    return { status: "unauthorized" };
  }
  return saveRsvp(formData, formData.get("editToken") as string);
}

async function saveRsvp(formData: FormData, editToken?: string): Promise<RsvpFormState> {
  const editing = !!editToken;
  if (!(formData instanceof FormData)) {
    return { status: "failed" };
  }

  if (editToken) {
    if (!process.env.DATABASE_URL) return { status: "failed" };
    try {
      const { getEditableRsvp } = await import("@/lib/rsvp");
      if (!(await getEditableRsvp(editToken))) return { status: "unauthorized" };
    } catch {
      return { status: "failed" };
    }
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
    const soup = parsed.data.soup;
    // Acknowledgment applies only to the name the guest was shown. This is an
    // advisory check, not an authorization boundary; all fields still validate.
    if (soup && formData.get("acknowledgedSoupName") !== soup.name) {
      const matches = findSoupMatches(soup.name, await readPublicSoups(
        editToken ? hashEditToken(editToken) : undefined,
      ));
      if (matches.length) {
        return { status: "duplicate", soupName: soup.name, matches };
      }
    }
    // Imported here because the client cannot be constructed without a database.
    const { createRsvp, updateRsvp } = await import("@/lib/rsvp");
    if (editToken) {
      if (!(await updateRsvp(editToken, parsed.data))) return { status: "unauthorized" };
    } else {
      const created = await createRsvp(parsed.data);
      editToken = created.editToken;
    }
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
  // Edits may remove a soup or change its public contributor name.
  if (soup || editing) {
    updateTag("soups");
    refresh();
  }
  const editPath = `/rsvp/edit?token=${editToken}`;
  return partySize === null
    ? { status: "declined", name: attendeeName, editPath }
    : { status: "attending", name: attendeeName, partySize, soup: soup?.name ?? null, editPath };
}

export async function cancelGuestRsvp(
  _previous: RsvpFormState,
  formData: FormData,
): Promise<RsvpFormState> {
  if (!(formData instanceof FormData) || !isEditToken(formData.get("editToken"))) {
    return { status: "unauthorized" };
  }
  if (formData.get("confirmCancel") !== "yes") return { status: "failed" };
  if (!process.env.DATABASE_URL) return { status: "failed" };
  try {
    const { cancelRsvp } = await import("@/lib/rsvp");
    if (!(await cancelRsvp(formData.get("editToken")))) return { status: "unauthorized" };
  } catch {
    return { status: "failed" };
  }
  updateTag("soups");
  refresh();
  return { status: "cancelled" };
}
