import { z } from "zod";

import type { RsvpStatus } from "@/generated/prisma/client";
import {
  NAME_MAX_LENGTH,
  SOUP_NAME_MAX_LENGTH,
  type RsvpErrors,
  type RsvpField,
} from "@/lib/rsvp-form";

/** The soup a guest intends to bring. */
export type SoupInput = {
  name: string;
};

/** A response that is safe to store. */
export type RsvpInput = {
  attendeeName: string;
  /** The other half of a couple responding together. Null for one guest. */
  secondName: string | null;
  status: RsvpStatus;
  /** Null when declined, or when the guest has not decided. */
  soup: SoupInput | null;
};

// Runs of whitespace, including line breaks, become single spaces.
function tidy(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

// `request` is the instruction without its full stop: "Enter your name".
function guestName(request: string) {
  return z
    .string(`${request}.`)
    .refine((value) => !value.includes("\0"), `${request} without control characters.`)
    .transform(tidy)
    .pipe(z.string().max(NAME_MAX_LENGTH, `Use ${NAME_MAX_LENGTH} characters or fewer.`));
}

const name = guestName("Enter your name").pipe(z.string().min(1, "Enter your name."));

// May be blank: a guest responding alone.
const secondName = guestName("Enter their name");

const attendance = z.enum(["attending", "declined"], "Say whether you will be there.");

// May be blank: no soup yet.
const soupName = z
  .string("Enter the name of the soup.")
  .refine((value) => !value.includes("\0"), "Enter the soup name without control characters.")
  .transform(tidy)
  .pipe(z.string().max(SOUP_NAME_MAX_LENGTH, `Use ${SOUP_NAME_MAX_LENGTH} characters or fewer.`));

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
 * A soup sent with a decline is ignored. An attending guest who leaves the
 * soup's name blank is deciding later. A field that was not sent at all
 * counts as blank.
 */
export function parseRsvp(
  input: Record<RsvpField, unknown>,
): { success: true; data: RsvpInput } | { success: false; errors: RsvpErrors } {
  const parsedName = check(name, input.name);
  const parsedSecondName = check(secondName, input.secondName ?? "");
  const parsedAttendance = check(attendance, input.attendance);
  const attending = parsedAttendance.value === "attending";
  const parsedSoupName = attending ? check(soupName, input.soupName ?? "") : undefined;

  const errors: RsvpErrors = {};
  if (parsedName.error) errors.name = parsedName.error;
  if (parsedSecondName.error) errors.secondName = parsedSecondName.error;
  if (parsedAttendance.error) errors.attendance = parsedAttendance.error;
  if (parsedSoupName?.error) errors.soupName = parsedSoupName.error;

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
      secondName: parsedSecondName.value || null,
      status: attending ? "ATTENDING" : "DECLINED",
      soup: parsedSoupName?.value ? { name: parsedSoupName.value } : null,
    },
  };
}
