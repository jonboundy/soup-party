import { z } from "zod";

import type { RsvpStatus } from "@/generated/prisma/client";
import {
  MAX_PARTY_SIZE,
  NAME_MAX_LENGTH,
  type RsvpErrors,
  type RsvpField,
} from "@/lib/rsvp-form";

/** A response that is safe to store. */
export type RsvpInput = {
  attendeeName: string;
  status: RsvpStatus;
  /** People attending, including the guest. Null when declined. */
  partySize: number | null;
};

const name = z
  .string("Enter your name.")
  // Runs of whitespace, including line breaks, become single spaces.
  .transform((value) => value.trim().replace(/\s+/g, " "))
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

function check<T>(schema: z.ZodType<T>, value: unknown) {
  const result = schema.safeParse(value);
  return result.success
    ? { value: result.data, error: undefined }
    : { value: undefined, error: result.error.issues[0].message };
}

/**
 * Validates a submitted response. Each field is checked on its own so every
 * problem is reported at once. A party size sent with a decline is ignored.
 */
export function parseRsvp(
  input: Record<RsvpField, unknown>,
): { success: true; data: RsvpInput } | { success: false; errors: RsvpErrors } {
  const parsedName = check(name, input.name);
  const parsedAttendance = check(attendance, input.attendance);
  const parsedPartySize =
    parsedAttendance.value === "attending" ? check(partySize, input.partySize) : undefined;

  const errors: RsvpErrors = {};
  if (parsedName.error) errors.name = parsedName.error;
  if (parsedAttendance.error) errors.attendance = parsedAttendance.error;
  if (parsedPartySize?.error) errors.partySize = parsedPartySize.error;

  if (
    parsedName.value === undefined ||
    parsedAttendance.value === undefined ||
    (parsedPartySize && parsedPartySize.value === undefined)
  ) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      attendeeName: parsedName.value,
      status: parsedAttendance.value === "attending" ? "ATTENDING" : "DECLINED",
      partySize: parsedPartySize?.value ?? null,
    },
  };
}
