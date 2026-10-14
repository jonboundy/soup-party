import { z } from "zod";

import type { RsvpStatus } from "@/generated/prisma/client";
import {
  NAME_MAX_LENGTH,
  RECIPE_TEXT_MAX_LENGTH,
  RECIPE_URL_MAX_LENGTH,
  SOUP_NAME_MAX_LENGTH,
  type GuestSoup,
  type RsvpErrors,
  type RsvpField,
} from "@/lib/rsvp-form";

/** The soup a guest intends to bring, with its recipe if they gave one. */
export type SoupInput = GuestSoup;

/** A response that is safe to store. */
export type RsvpInput = {
  attendeeName: string;
  /** The other half of a couple responding together. Null for one guest. */
  secondName: string | null;
  status: RsvpStatus;
  /** Null when declined, or when the guest has not decided. */
  soup: SoupInput | null;
  /**
   * The soup's recipe is its photos, which are sent apart and so are not
   * here. A recipe is one kind of thing: saved without this, a soup keeps none.
   */
  recipePhotos?: boolean;
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

// May be blank: no recipe.
const recipeKind = z.enum(["none", "link", "text", "photos"], "Choose what the recipe is.");

const RECIPE_URL_REQUEST = "Enter a web address, such as https://example.com/soup.";

// Null when it is not a link the recipe page can safely show. A pasted
// address often has no scheme, so one is assumed.
function webAddress(value: string) {
  const address = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
  if (!URL.canParse(address)) return null;
  const url = new URL(address);
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  // A single word is a soup typed into the wrong field, not a site.
  if (!url.hostname.includes(".") || url.username || url.password) return null;
  return url.href;
}

// May be blank: no link. Stored as the browser would resolve it.
const recipeUrl = z
  .string(RECIPE_URL_REQUEST)
  .refine((value) => !value.includes("\0"), RECIPE_URL_REQUEST)
  .transform((value) => value.trim())
  .pipe(z.string().max(RECIPE_URL_MAX_LENGTH, `Use ${RECIPE_URL_MAX_LENGTH} characters or fewer.`))
  .transform((value) => (value ? webAddress(value) : ""))
  .pipe(z.string(RECIPE_URL_REQUEST).max(RECIPE_URL_MAX_LENGTH, RECIPE_URL_REQUEST));

// Line breaks are the recipe's structure, so they are kept: one per line,
// and at most one blank line between paragraphs.
function tidyLines(value: string) {
  return value
    .split(/\r\n?|\n/)
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\n+|\n+$/g, "");
}

// May be blank: no written recipe.
const recipeText = z
  .string("Enter the recipe.")
  .refine((value) => !value.includes("\0"), "Enter the recipe without control characters.")
  .transform(tidyLines)
  .pipe(
    z.string().max(
      RECIPE_TEXT_MAX_LENGTH,
      `Use ${RECIPE_TEXT_MAX_LENGTH.toLocaleString("en-US")} characters or fewer.`,
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
 * A soup sent with a decline is ignored, and its recipe with it. An attending
 * guest who leaves the soup's name blank is deciding later, and cannot give a
 * recipe yet. A field that was not sent at all counts as blank.
 *
 * A recipe is the one kind named by `recipeKind`, and only that kind's field
 * is read. Left blank, it is no recipe.
 */
export function parseRsvp(
  input: Record<RsvpField, unknown>,
): { success: true; data: RsvpInput } | { success: false; errors: RsvpErrors } {
  const parsedName = check(name, input.name);
  const parsedSecondName = check(secondName, input.secondName ?? "");
  const parsedAttendance = check(attendance, input.attendance);
  const attending = parsedAttendance.value === "attending";
  const parsedSoupName = attending ? check(soupName, input.soupName ?? "") : undefined;
  const parsedRecipeKind = attending ? check(recipeKind, input.recipeKind || "none") : undefined;
  const kind = parsedRecipeKind?.value;
  const parsedRecipeUrl = kind === "link" ? check(recipeUrl, input.recipeUrl ?? "") : undefined;
  const parsedRecipeText = kind === "text" ? check(recipeText, input.recipeText ?? "") : undefined;

  const errors: RsvpErrors = {};
  if (parsedName.error) errors.name = parsedName.error;
  if (parsedSecondName.error) errors.secondName = parsedSecondName.error;
  if (parsedAttendance.error) errors.attendance = parsedAttendance.error;
  if (parsedSoupName?.error) errors.soupName = parsedSoupName.error;
  if (parsedRecipeKind?.error) errors.recipeKind = parsedRecipeKind.error;
  if (parsedRecipeUrl?.error) errors.recipeUrl = parsedRecipeUrl.error;
  if (parsedRecipeText?.error) errors.recipeText = parsedRecipeText.error;
  // Dropping the recipe unsaid would lose what the guest typed.
  if (parsedSoupName?.value === "" && (parsedRecipeUrl?.value || parsedRecipeText?.value)) {
    errors.soupName = "Name the soup this recipe is for.";
  }

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
      soup: parsedSoupName?.value
        ? {
            name: parsedSoupName.value,
            recipeUrl: parsedRecipeUrl?.value || null,
            recipeText: parsedRecipeText?.value || null,
          }
        : null,
      recipePhotos: !!parsedSoupName?.value && kind === "photos",
    },
  };
}
