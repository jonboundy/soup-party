import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { isEditToken } from "@/lib/edit-token";
import type { RsvpFormState } from "@/lib/rsvp-form";

const secure = process.env.NODE_ENV === "production";
export const RSVP_COOKIE = secure ? "__Host-soup-rsvp" : "soup-rsvp";
export const RSVP_COOKIE_SECONDS = 180 * 24 * 60 * 60;

/** Set only after a successful save. The existing private token authorizes reads. */
export async function rememberRsvp(token: string) {
  (await cookies()).set(RSVP_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: RSVP_COOKIE_SECONDS,
  });
}

type RememberedRsvp =
  | { status: "new" }
  | { status: "unavailable" }
  | { status: "remembered"; receipt: Extract<RsvpFormState, { editPath: string }> };

/** Request-local only: never cache a guest's credential or receipt across visitors. */
export const getRememberedRsvp = cache(async (): Promise<RememberedRsvp> => {
  const token = (await cookies()).get(RSVP_COOKIE)?.value;
  if (!isEditToken(token)) return { status: "new" };
  if (!process.env.DATABASE_URL) return { status: "unavailable" };
  try {
    const { getEditableRsvp, getEditablePhotos } = await import("@/lib/rsvp");
    const saved = await getEditableRsvp(token);
    // A removed response or an unknown token must not hide the new form forever.
    if (!saved) return { status: "new" };
    const common = {
      name: saved.attendeeName,
      secondName: saved.secondName,
      editPath: `/rsvp/edit?token=${token}`,
    };
    if (saved.status === "DECLINED") {
      return { status: "remembered", receipt: {
        ...common, status: "cancelled", unlistedSoup: saved.soup?.name ?? null,
      } };
    }
    const photos = saved.soup ? await getEditablePhotos(token) : [];
    return { status: "remembered", receipt: {
      ...common, status: "attending", soup: saved.soup,
      photos: { saved: photos.length, unsaved: 0 },
    } };
  } catch {
    // An outage is not evidence that this guest needs to submit another RSVP.
    return { status: "unavailable" };
  }
});
