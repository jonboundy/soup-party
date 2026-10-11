import "server-only";

import { db } from "@/lib/db";
import { createEditToken, hashEditToken, isEditToken } from "@/lib/edit-token";
import type { RsvpInput } from "@/lib/rsvp-schema";
import { normalizeSoupName } from "@/lib/soup-name";

/**
 * Stores a validated response, and with it the guest's soup if they named
 * one. Returns the raw edit token, which is not kept anywhere else, so the
 * caller can put it in the guest's private confirmation link.
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

/** Uncached private read. The token is the only guest authorization credential. */
export async function getEditableRsvp(token: unknown) {
  if (!isEditToken(token)) return null;
  return db.rsvp.findUnique({
    where: { editTokenHash: hashEditToken(token) },
    select: {
      attendeeName: true,
      status: true,
      partySize: true,
      soup: { select: { name: true, category: true, description: true } },
    },
  });
}

/** Authorization and both writes share a transaction. No client RSVP id is used. */
export async function updateRsvp(token: unknown, input: RsvpInput) {
  if (!isEditToken(token)) return false;
  return db.$transaction(async (tx) => {
    const rsvp = await tx.rsvp.updateMany({
      where: { editTokenHash: hashEditToken(token) },
      data: { attendeeName: input.attendeeName, status: input.status, partySize: input.partySize },
    });
    if (rsvp.count !== 1) return false;
    const { id } = await tx.rsvp.findUniqueOrThrow({
      where: { editTokenHash: hashEditToken(token) },
      select: { id: true },
    });
    // Declines release the soup publicly but keep its details for a later return.
    if (input.status === "ATTENDING") {
      if (input.soup) {
        const soup = { ...input.soup, normalizedName: normalizeSoupName(input.soup.name) };
        await tx.soup.upsert({ where: { rsvpId: id }, create: { ...soup, rsvpId: id }, update: soup });
      } else {
        await tx.soup.deleteMany({ where: { rsvpId: id } });
      }
    }
    return true;
  });
}

/** Repeat cancellation is safe, and the saved link remains usable. */
export async function cancelRsvp(token: unknown) {
  if (!isEditToken(token)) return false;
  const result = await db.rsvp.updateMany({
    where: { editTokenHash: hashEditToken(token) },
    data: { status: "DECLINED", partySize: null },
  });
  return result.count === 1;
}
