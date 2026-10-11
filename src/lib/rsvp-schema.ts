import { z } from "zod";

import type { RsvpStatus, SoupCategory } from "@/generated/prisma/client";
import {
  MAX_PARTY_SIZE,
  NAME_MAX_LENGTH,
  SOUP_DESCRIPTION_MAX_LENGTH,
  SOUP_NAME_MAX_LENGTH,
  type RsvpErrors,
  type RsvpField,
} from "@/lib/rsvp-form";
import { SOUP_CATEGORIES } from "@/lib/soup-categories";

/** The soup a guest intends to bring. */
export type SoupInput = {
  name: string;
  category: SoupCategory;
  description: string | null;
};

/** A response that is safe to store. */
export type RsvpInput = {
  attendeeName: string;
  status: RsvpStatus;
  /** People attending, including the guest. Null when declined. */
  partySize: number | null;
  /** Null when declined, or when the guest has not decided. */
  soup: SoupInput | null;
};

// Runs of whitespace, including line breaks, become single spaces.
function tidy(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

const name = z
  .string("Enter your name.")
  .transform(tidy)
  .pipe(
    z
      .string()
      .min(1, "Enter your name.")
      .max(NAME_MAX_LENGTH, `Use ${NAME_MAX_LENGTH} characters or fewer.`),
  );

const attendance = z.enum(["attending", "declined"], "Say whether you will be there.");

// Digits only: "2", never "2.5", "1e1" or " 2".
const partySize = z
  .string("Choose a party size.")
  .regex(/^\d{1,3}$/, "Choose a party size.")
  .transform(Number)
  .pipe(
    z
      .number()
      .min(1, "A party is at least 1 person.")
      .max(MAX_PARTY_SIZE, `A party is at most ${MAX_PARTY_SIZE} people.`),
  );

// Both may be blank: a blank name means no soup yet, a blank description none.
const soupName = z
  .string("Enter the name of the soup.")
  .transform(tidy)
  .pipe(z.string().max(SOUP_NAME_MAX_LENGTH, `Use ${SOUP_NAME_MAX_LENGTH} characters or fewer.`));

const soupCategory = z.enum(
  SOUP_CATEGORIES.map(({ value }) => value),
  "Choose a category.",
);

const soupDescription = z
  .string("Describe the soup in words.")
  .transform(tidy)
  .pipe(
    z
      .string()
      .max(
        SOUP_DESCRIPTION_MAX_LENGTH,
        `Use ${SOUP_DESCRIPTION_MAX_LENGTH} characters or fewer.`,
      ),
  );

function check<T>(schema: z.ZodType<T>, value: unknown) {
  const result = schema.safeParse(value);
  return result.success
    ? { value: result.data, error: undefined }
    : { value: undefined, error: result.error.issues[0].message };
}

/**
 * Validates a submitted response. Each field is checked on its own so every
 * problem is reported at once.
 *
 * A party size or soup sent with a decline is ignored. So are a category and
 * description sent without a soup name: an attending guest who leaves the name
 * blank is deciding later. A field that was not sent at all counts as blank.
 */
export function parseRsvp(
  input: Record<RsvpField, unknown>,
): { success: true; data: RsvpInput } | { success: false; errors: RsvpErrors } {
  const parsedName = check(name, input.name);
  const parsedAttendance = check(attendance, input.attendance);
  const attending = parsedAttendance.value === "attending";
  const parsedPartySize = attending ? check(partySize, input.partySize) : undefined;
  const parsedSoupName = attending ? check(soupName, input.soupName ?? "") : undefined;
  // Blank means deciding later. A name that is wrong in some other way is
  // still a soup, so its category and description are checked too.
  const hasSoup = !!parsedSoupName && parsedSoupName.value !== "";
  const parsedSoupCategory = hasSoup ? check(soupCategory, input.soupCategory) : undefined;
  const parsedSoupDescription = hasSoup
    ? check(soupDescription, input.soupDescription ?? "")
    : undefined;

  const errors: RsvpErrors = {};
  if (parsedName.error) errors.name = parsedName.error;
  if (parsedAttendance.error) errors.attendance = parsedAttendance.error;
  if (parsedPartySize?.error) errors.partySize = parsedPartySize.error;
  if (parsedSoupName?.error) errors.soupName = parsedSoupName.error;
  if (parsedSoupCategory?.error) errors.soupCategory = parsedSoupCategory.error;
  if (parsedSoupDescription?.error) errors.soupDescription = parsedSoupDescription.error;

  if (
    parsedName.value === undefined ||
    parsedAttendance.value === undefined ||
    Object.keys(errors).length > 0
  ) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      attendeeName: parsedName.value,
      status: attending ? "ATTENDING" : "DECLINED",
      partySize: parsedPartySize?.value ?? null,
      soup:
        parsedSoupName?.value && parsedSoupCategory?.value
          ? {
              name: parsedSoupName.value,
              category: parsedSoupCategory.value,
              description: parsedSoupDescription?.value || null,
            }
          : null,
    },
  };
}
