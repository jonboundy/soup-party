// What the RSVP form and its server action share. Kept free of the validation
// library so the browser does not have to download it.

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
  /** Valid, but not saved. Submitting again may work. */
  | { status: "failed" }
  /** `soup` is the name of the soup registered, or null if that is undecided. */
  | { status: "attending"; name: string; partySize: number; soup: string | null }
  | { status: "declined"; name: string };
