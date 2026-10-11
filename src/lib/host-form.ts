// What the host's forms and their server actions share.

import type { RsvpErrors } from "@/lib/rsvp-form";

/** The result of the last sign-in attempt, if there has been one. */
export type HostSignInState =
  | { status: "idle" }
  | { status: "incorrect" }
  | { status: "rate-limited"; retryAfter: number }
  /** This deployment has no host password, or no database to keep sessions in. */
  | { status: "unavailable" }
  /** Not checked. Submitting again may work. */
  | { status: "failed" };

/** The result of the host's last attempt to correct or remove an RSVP. */
export type HostRsvpState =
  | { status: "idle" }
  | { status: "invalid"; errors: RsvpErrors }
  /** The RSVP has been removed since the page was loaded. */
  | { status: "missing" }
  /** Not saved. Submitting again may work. */
  | { status: "failed" };
