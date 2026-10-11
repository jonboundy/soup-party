import "server-only";

import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { createEditToken, hashEditToken, isEditToken } from "@/lib/edit-token";
import type { RsvpInput } from "@/lib/rsvp-schema";
import { normalizeSoupName } from "@/lib/soup-name";

export class SubmissionConflict extends Error {
  name = "SubmissionConflict";
}

function submissionHash(input: RsvpInput) {
  return createHash("sha256").update(JSON.stringify([
    input.attendeeName, input.status, input.partySize,
    input.soup ? [input.soup.name, input.soup.category, input.soup.description] : null,
  ])).digest("hex");
}

/** A retry never changes a saved RSVP, even if it has since been edited. */
export async function findSubmittedRsvp(token: string, input: RsvpInput) {
  if (!isEditToken(token)) throw new SubmissionConflict();
  const saved = await db.rsvp.findUnique({
    where: { editTokenHash: hashEditToken(token) },
    select: { id: true, submissionHash: true },
  });
  if (!saved) return null;
  if (saved.submissionHash !== submissionHash(input)) throw new SubmissionConflict();
  return { id: saved.id, editToken: token };
}

/** Stores RSVP and soup atomically; duplicate tokens recover the original result. */
export async function createRsvp(input: RsvpInput, submissionToken?: string) {
  const { attendeeName, status, partySize, soup } = input;
  const token = submissionToken ?? createEditToken().token;
  if (!isEditToken(token)) throw new SubmissionConflict();
  const hash = hashEditToken(token);

  try {
    const { id } = await db.rsvp.create({
      data: {
        attendeeName,
        status,
        partySize,
        editTokenHash: hash,
        submissionHash: submissionHash(input),
        // Created in the same transaction: a soup that cannot be saved leaves
        // no RSVP behind.
        soup: soup
          ? { create: { ...soup, normalizedName: normalizeSoupName(soup.name) } }
          : undefined,
      },
      select: { id: true },
    });
    return { id, editToken: token };
  } catch (error) {
    // PostgreSQL's unique constraint waits for a competing insert to finish.
    // Recover its confirmation after a lost response or simultaneous click.
    if ((error as { code?: string })?.code === "P2002") {
      const saved = await findSubmittedRsvp(token, input);
      if (saved) return saved;
    }
    throw error;
  }
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
