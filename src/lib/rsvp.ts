import "server-only";

import { db } from "@/lib/db";
import { createEditToken } from "@/lib/edit-token";
import type { RsvpInput } from "@/lib/rsvp-schema";

/**
 * Stores a validated response. Returns the raw edit token, which is not kept
 * anywhere else, so the caller decides whether the guest ever sees it.
 */
export async function createRsvp({ attendeeName, status, partySize }: RsvpInput) {
  const { token, hash } = createEditToken();

  const { id } = await db.rsvp.create({
    data: { attendeeName, status, partySize, editTokenHash: hash },
    select: { id: true },
  });

  return { id, editToken: token };
}
