"use server";

import { updateTag } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";

import type { HostRsvpState, HostSignInState } from "@/lib/host-form";
import type { RecipePhotoState } from "@/lib/recipe-photo";
import { isUuid } from "@/lib/uuid";
import { parseRsvp } from "@/lib/rsvp-schema";

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

/**
 * Saves the host's correction to a guest's RSVP. Signed-out callers are sent
 * to the sign-in form before anything submitted is read. The answers pass the
 * validation a guest's do, but not the duplicate-soup warning or the rate
 * limit, which are for guests.
 */
export async function saveHostRsvp(
  _previous: HostRsvpState,
  formData: FormData,
): Promise<HostRsvpState> {
  if (!process.env.DATABASE_URL) return { status: "failed" };
  const { requireHost } = await import("@/lib/host-session");
  await requireHost();
  if (!(formData instanceof FormData)) return { status: "failed" };

  const parsed = parseRsvp({
    name: singleField(formData, "name"),
    secondName: singleField(formData, "secondName"),
    attendance: singleField(formData, "attendance"),
    soupName: singleField(formData, "soupName"),
    recipeKind: singleField(formData, "recipeKind"),
    recipeUrl: singleField(formData, "recipeUrl"),
    recipeText: singleField(formData, "recipeText"),
  });
  if (!parsed.success) return { status: "invalid", errors: parsed.errors };

  try {
    const { updateHostRsvp } = await import("@/lib/host-rsvps");
    if (!(await updateHostRsvp(formData.get("rsvpId"), parsed.data))) return { status: "missing" };
  } catch (error) {
    return failed("corrected", error);
  }
  // The editor has photos to send before it leaves the page, and ends with
  // `finishHostRecipePhotos`. Expiring the registry here would redraw the page
  // under the editor, which is keyed on the answers and would start again.
  if (formData.get("photosFollow") === "yes") return { status: "saved" };
  // The correction may add, rename, unlist or relist a public soup.
  updateTag("soups");
  redirect("/host");
}

/**
 * Ends a correction that sent photos: expires the registry, which the
 * requests before it left alone, and sends the host back to the responses,
 * or back to the editor to be told how many changes to the photos failed.
 */
export async function finishHostRecipePhotos(formData: FormData): Promise<HostRsvpState> {
  if (!process.env.DATABASE_URL) return { status: "failed" };
  const { requireHost } = await import("@/lib/host-session");
  await requireHost();
  updateTag("soups");
  const rsvpId = formData instanceof FormData ? formData.get("rsvpId") : null;
  const unsaved = formData instanceof FormData ? Number(formData.get("unsaved")) : 0;
  if (isUuid(rsvpId) && Number.isInteger(unsaved) && unsaved > 0) {
    redirect(`/host/rsvps/${rsvpId}?unsaved=${unsaved}`);
  }
  redirect("/host");
}

/**
 * Adds one photo to the recipe of a guest's soup, on their behalf. The
 * editor sends these between saving a correction and finishing it.
 */
export async function addHostRecipePhoto(formData: FormData): Promise<RecipePhotoState> {
  return changeHostRecipePhotos(formData, async (rsvpId) => {
    const { uploadedPhoto } = await import("@/lib/recipe-photo-upload");
    const photo = await uploadedPhoto(formData);
    if (!photo) return { status: "invalid" };
    const { addHostRecipePhoto } = await import("@/lib/host-rsvps");
    return addHostRecipePhoto(rsvpId, photo);
  });
}

/** Removes one photo from the recipe of a guest's soup. */
export async function removeHostRecipePhoto(formData: FormData): Promise<RecipePhotoState> {
  return changeHostRecipePhotos(formData, async (rsvpId) => {
    const { removeHostRecipePhoto } = await import("@/lib/host-rsvps");
    await removeHostRecipePhoto(rsvpId, formData.get("photoId"));
    return { status: "removed" };
  });
}

// Signed-out callers are sent to the sign-in form before anything is read.
async function changeHostRecipePhotos(
  formData: FormData,
  change: (rsvpId: unknown) => Promise<RecipePhotoState>,
): Promise<RecipePhotoState> {
  if (!process.env.DATABASE_URL) return { status: "failed" };
  const { requireHost } = await import("@/lib/host-session");
  await requireHost();
  if (!(formData instanceof FormData)) return { status: "failed" };

  let result: RecipePhotoState;
  try {
    result = await change(formData.get("rsvpId"));
  } catch (error) {
    // Preserve the redirect for a session that ended mid-request.
    unstable_rethrow(error);
    console.error("Recipe photo could not be changed:", error instanceof Error ? error.name : typeof error);
    return { status: "failed" };
  }
  return result;
}

/**
 * Deletes a guest's RSVP and soup. The request has to carry the confirmation
 * the form asks the host for.
 */
export async function removeHostRsvp(
  _previous: HostRsvpState,
  formData: FormData,
): Promise<HostRsvpState> {
  if (!process.env.DATABASE_URL) return { status: "failed" };
  const { requireHost } = await import("@/lib/host-session");
  await requireHost();
  if (!(formData instanceof FormData) || formData.get("confirmRemove") !== "yes") {
    return { status: "failed" };
  }

  try {
    const { removeHostRsvp } = await import("@/lib/host-rsvps");
    if (!(await removeHostRsvp(formData.get("rsvpId")))) return { status: "missing" };
  } catch (error) {
    return failed("removed", error);
  }
  updateTag("soups");
  redirect("/host");
}

function failed(verb: string, error: unknown): HostRsvpState {
  // Preserve the redirect for a session that ended mid-request.
  unstable_rethrow(error);
  // Database errors may quote guests' details; log only their kind.
  console.error(`RSVP could not be ${verb}:`, error instanceof Error ? error.name : typeof error);
  return { status: "failed" };
}

function singleField(formData: FormData, field: string) {
  const values = formData.getAll(field);
  // Repeated fields are ambiguous, so send them to schema validation as invalid.
  return values.length > 1 ? values : values[0] ?? null;
}
