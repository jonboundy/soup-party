"use server";

import { refresh, updateTag } from "next/cache";

import { hashEditToken, isEditToken } from "@/lib/edit-token";
import { readPublicSoups } from "@/lib/public-soups";
import { rememberRsvp } from "@/lib/remembered-rsvp";
import type { RecipePhotoState } from "@/lib/recipe-photo";
import type { RsvpFormState } from "@/lib/rsvp-form";
import { parseRsvp } from "@/lib/rsvp-schema";
import { findSoupMatches } from "@/lib/soup-matches";

async function checkSubmission(formData: FormData): Promise<RsvpFormState | null> {
  if (!process.env.DATABASE_URL) return { status: "failed" };
  try {
    const { checkRsvpRateLimit } = await import("@/lib/rsvp-rate-limit");
    const retryAfter = await checkRsvpRateLimit();
    if (retryAfter) return { status: "rate-limited", retryAfter };
  } catch {
    return { status: "failed" };
  }
  // A quiet honeypot, excluded from keyboard navigation and autofill.
  if (formData.getAll("website").some((value) => value !== "")) return { status: "failed" };
  for (const field of ["submissionToken", "editToken", "acknowledgedSoupName", "confirmCancel"]) {
    if (formData.getAll(field).length > 1) return { status: "failed" };
  }
  return null;
}

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
  const blocked = await checkSubmission(formData);
  if (blocked) return blocked;

  if (editToken) {
    try {
      const { getEditableRsvp } = await import("@/lib/rsvp");
      if (!(await getEditableRsvp(editToken))) return { status: "unauthorized" };
    } catch {
      return { status: "failed" };
    }
  }

  const parsed = parseRsvp({
    name: singleField(formData, "name"),
    secondName: singleField(formData, "secondName"),
    // Guests are not asked: a response is from someone coming. One who cannot
    // come after all cancels, and saving again from the edit link returns them.
    attendance: "attending",
    soupName: singleField(formData, "soupName"),
    recipeKind: singleField(formData, "recipeKind"),
    recipeUrl: singleField(formData, "recipeUrl"),
    recipeText: singleField(formData, "recipeText"),
  });
  if (!parsed.success) {
    return { status: "invalid", errors: parsed.errors };
  }
  const submissionToken = formData.get("submissionToken");
  if (!editing && !isEditToken(submissionToken)) return { status: "failed" };

  try {
    // The client cannot be constructed without a database.
    const { createRsvp, updateRsvp, findSubmittedRsvp } = await import("@/lib/rsvp");
    // Replay before matching: the guest's own newly saved soup is no new warning.
    const replay = !editing && await findSubmittedRsvp(submissionToken as string, parsed.data);
    const soup = parsed.data.soup;
    // Acknowledgment applies only to the name the guest was shown. This is an
    // advisory check, not an authorization boundary; all fields still validate.
    if (!replay && soup && formData.get("acknowledgedSoupName") !== soup.name) {
      const matches = findSoupMatches(soup.name, await readPublicSoups(
        hashEditToken(editToken ?? (submissionToken as string)),
      ));
      if (matches.length) {
        return { status: "duplicate", soupName: soup.name, matches };
      }
    }
    if (editToken) {
      if (!(await updateRsvp(editToken, parsed.data))) return { status: "unauthorized" };
    } else {
      const created = replay || await createRsvp(parsed.data, submissionToken as string);
      editToken = created.editToken;
    }
  } catch (error) {
    if (error instanceof Error && error.name === "SubmissionConflict") return { status: "conflict" };
    // Only the kind of error is logged: its message can quote what the guest typed.
    console.error(
      "RSVP could not be saved:",
      error instanceof Error ? error.name : typeof error,
      (error as { code?: unknown } | null)?.code ?? "",
    );
    return { status: "failed" };
  }

  const { attendeeName: name, secondName, soup } = parsed.data;
  await rememberRsvp(editToken!);
  // Edits may remove a soup or change its public contributor name.
  if (soup || editing) {
    updateTag("soups");
    refresh();
  }
  const editPath = `/rsvp/edit?token=${editToken}`;
  return { status: "attending", name, secondName, soup, editPath };
}

function singleField(formData: FormData, field: string) {
  const values = formData.getAll(field);
  // Repeated fields are ambiguous, so send them to schema validation as invalid.
  return values.length > 1 ? values : values[0] ?? null;
}

export async function cancelGuestRsvp(
  _previous: RsvpFormState,
  formData: FormData,
): Promise<RsvpFormState> {
  const editToken = formData instanceof FormData ? formData.get("editToken") : null;
  if (!isEditToken(editToken)) return { status: "unauthorized" };
  if (formData.get("confirmCancel") !== "yes") return { status: "failed" };
  const blocked = await checkSubmission(formData);
  if (blocked) return blocked;
  let saved;
  try {
    const { cancelRsvp, getEditableRsvp } = await import("@/lib/rsvp");
    // Cancellation arrives without the guest's answers, so the confirmation
    // is read from what was saved.
    saved = await getEditableRsvp(editToken);
    if (!saved || !(await cancelRsvp(editToken))) return { status: "unauthorized" };
  } catch {
    return { status: "failed" };
  }
  await rememberRsvp(editToken);
  updateTag("soups");
  refresh();
  return {
    status: "cancelled",
    name: saved.attendeeName,
    secondName: saved.secondName,
    unlistedSoup: saved.soup?.name ?? null,
    editPath: `/rsvp/edit?token=${editToken}`,
  };
}

/**
 * Adds one photo to the recipe of the soup behind a private edit link. The
 * form sends each photo on its own, after the response is saved: a photo is
 * most of what one request may carry, and a response is never held up by one.
 */
export async function addRecipePhoto(formData: FormData): Promise<RecipePhotoState> {
  return changeRecipePhotos(formData, async (owner) => {
    const { uploadedPhoto } = await import("@/lib/recipe-photo-upload");
    const photo = await uploadedPhoto(formData);
    if (!photo) return { status: "invalid" };
    const { addRecipePhoto } = await import("@/lib/recipe-photos");
    return addRecipePhoto(owner, photo);
  });
}

/** Removes one photo from that recipe. Removing it twice is not an error. */
export async function removeRecipePhoto(formData: FormData): Promise<RecipePhotoState> {
  return changeRecipePhotos(formData, async (owner) => {
    const { removeRecipePhoto } = await import("@/lib/recipe-photos");
    await removeRecipePhoto(owner, formData.get("photoId"));
    return { status: "removed" };
  });
}

// The token is checked as an edit's is. Attempts are counted apart from them.
async function changeRecipePhotos(
  formData: FormData,
  change: (owner: { editTokenHash: string }) => Promise<RecipePhotoState>,
): Promise<RecipePhotoState> {
  const editToken = formData instanceof FormData ? formData.get("editToken") : null;
  if (!isEditToken(editToken)) return { status: "unauthorized" };
  if (!process.env.DATABASE_URL) return { status: "failed" };

  let result: RecipePhotoState;
  try {
    const { checkRecipePhotoRateLimit } = await import("@/lib/rsvp-rate-limit");
    if (await checkRecipePhotoRateLimit()) return { status: "rate-limited" };
    const { getEditableRsvp } = await import("@/lib/rsvp");
    if (!(await getEditableRsvp(editToken))) return { status: "unauthorized" };
    result = await change({ editTokenHash: hashEditToken(editToken) });
  } catch (error) {
    // Only the kind of error is logged, as for a response.
    console.error("Recipe photo could not be changed:", error instanceof Error ? error.name : typeof error);
    return { status: "failed" };
  }
  // A photo can be the whole recipe, so it can add or remove the registry's link.
  if (result.status === "saved" || result.status === "removed") {
    updateTag("soups");
    refresh();
  }
  return result;
}
