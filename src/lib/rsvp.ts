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
    input.attendeeName, input.secondName, input.status, input.soup?.name ?? null,
  ])).digest("hex");
}

/** The guests named, while attending. A declined RSVP has no party. */
function partySize({ status, secondName }: RsvpInput) {
  return status === "ATTENDING" ? (secondName ? 2 : 1) : null;
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
  const { attendeeName, secondName, status, soup } = input;
  const token = submissionToken ?? createEditToken().token;
  if (!isEditToken(token)) throw new SubmissionConflict();
  const hash = hashEditToken(token);

  try {
    const { id } = await db.rsvp.create({
      data: {
        attendeeName,
        secondName,
        status,
        partySize: partySize(input),
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
      secondName: true,
      status: true,
      soup: { select: { name: true } },
    },
  });
}

/** Authorization and both writes share a transaction. No client RSVP id is used. */
export async function updateRsvp(token: unknown, input: RsvpInput) {
  if (!isEditToken(token)) return false;
  return writeRsvp({ editTokenHash: hashEditToken(token) }, input);
}

/**
 * Replaces an RSVP's answers and its soup in one transaction. False when no
 * such RSVP exists. The caller has already authorized the write: a guest by
 * the token behind the hash, the host by their session.
 */
export async function writeRsvp(where: { editTokenHash: string } | { id: string }, input: RsvpInput) {
  return db.$transaction(async (tx) => {
    const rsvp = await tx.rsvp.updateMany({
      where,
      data: {
        attendeeName: input.attendeeName,
        secondName: input.secondName,
        status: input.status,
        partySize: partySize(input),
      },
    });
    if (rsvp.count !== 1) return false;
    const { id } = await tx.rsvp.findUniqueOrThrow({ where, select: { id: true } });
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
