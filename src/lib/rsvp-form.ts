// What the RSVP form and its server action share. Kept free of the validation
// library so the browser does not have to download it.

import type { SoupMatch } from "@/lib/soup-matches";

export const NAME_MAX_LENGTH = 80;
export const SOUP_NAME_MAX_LENGTH = 80;
export const RECIPE_URL_MAX_LENGTH = 2000;
export const RECIPE_TEXT_MAX_LENGTH = 10000;

/** What a soup's recipe is. It is one of these, never two together. */
export type RecipeKind = "none" | "link" | "text" | "photos";

/** The form's field names, as submitted. Only the host is asked for attendance. */
export type RsvpField =
  | "name"
  | "secondName"
  | "attendance"
  | "soupName"
  | "recipeKind"
  | "recipeUrl"
  | "recipeText";

/** One message per field that needs correcting. */
export type RsvpErrors = Partial<Record<RsvpField, string>>;

/** The result of the last submission, if there has been one. */
export type RsvpFormState =
  | { status: "idle" }
  | { status: "invalid"; errors: RsvpErrors }
  /** Nothing saved yet. The guest may change the name or acknowledge this one. */
  | { status: "duplicate"; soupName: string; matches: SoupMatch[] }
  /** Valid, but not saved. Submitting again may work. */
  | { status: "failed" }
  | { status: "rate-limited"; retryAfter: number }
  | { status: "conflict" }
  | { status: "unauthorized" }
  /**
   * Saved. `soup` is the soup registered, or null if that is undecided.
   * `photos` is added by the form once it has sent the recipe's photos, which
   * the action that saves a response knows nothing of: how many the recipe
   * has now, and how many changes to them could not be made.
   */
  | {
      status: "attending";
      name: string;
      secondName: string | null;
      soup: GuestSoup | null;
      editPath: string;
      photos?: { saved: number; unsaved: number };
    }
  /**
   * Cancelled. `unlistedSoup` names a soup the response still holds, which
   * the registry no longer shows.
   */
  | {
      status: "cancelled";
      name: string;
      secondName: string | null;
      unlistedSoup: string | null;
      editPath: string;
    };

/**
 * A soup as the guest bringing it entered it. The recipe is optional: a link,
 * or the recipe written out, or neither. Its photos are kept apart.
 */
export type GuestSoup = { name: string; recipeUrl: string | null; recipeText: string | null };

/** Fields available only after the guest's private token has been verified. */
export type EditableRsvp = {
  attendeeName: string;
  secondName: string | null;
  status: "ATTENDING" | "DECLINED";
  soup: GuestSoup | null;
};
