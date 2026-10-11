import "server-only";

import { db } from "@/lib/db";
import { createEditToken } from "@/lib/edit-token";
import type { RsvpInput } from "@/lib/rsvp-schema";
import { normalizeSoupName } from "@/lib/soup-name";

/**
 * Stores a validated response, and with it the guest's soup if they named
 * one. Returns the raw edit token, which is not kept anywhere else, so the
 * caller decides whether the guest ever sees it.
 */
export async function createRsvp({ attendeeName, status, partySize, soup }: RsvpInput) {
  const { token, hash } = createEditToken();

  const { id } = await db.rsvp.create({
    data: {
      attendeeName,
      status,
      partySize,
      editTokenHash: hash,
      // Created in the same transaction: a soup that cannot be saved leaves
      // no RSVP behind.
      soup: soup
        ? { create: { ...soup, normalizedName: normalizeSoupName(soup.name) } }
        : undefined,
    },
    select: { id: true },
  });

  return { id, editToken: token };
}
