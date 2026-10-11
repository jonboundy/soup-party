// What the RSVP form and its server action share. Kept free of the validation
// library so the browser does not have to download it.

import type { SoupMatch } from "@/lib/soup-matches";

export const NAME_MAX_LENGTH = 80;
export const MAX_PARTY_SIZE = 10;
export const SOUP_NAME_MAX_LENGTH = 80;
export const SOUP_DESCRIPTION_MAX_LENGTH = 280;

/** The form's field names, as submitted. */
export type RsvpField =
  | "name"
  | "attendance"
  | "partySize"
  | "soupName"
  | "soupCategory"
  | "soupDescription";

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
  | { status: "unauthorized" }
  | { status: "cancelled" }
  /** `soup` is the name of the soup registered, or null if that is undecided. */
  | { status: "attending"; name: string; partySize: number; soup: string | null; editPath: string }
  | { status: "declined"; name: string; editPath: string };

/** Fields available only after the guest's private token has been verified. */
export type EditableRsvp = {
  attendeeName: string;
  status: "ATTENDING" | "DECLINED";
  partySize: number | null;
  soup: { name: string; category: string; description: string | null } | null;
};
