// What the host sign-in form and its server action share.

/** The result of the last sign-in attempt, if there has been one. */
export type HostSignInState =
  | { status: "idle" }
  | { status: "incorrect" }
  | { status: "rate-limited"; retryAfter: number }
  /** This deployment has no host password, or no database to keep sessions in. */
  | { status: "unavailable" }
  /** Not checked. Submitting again may work. */
  | { status: "failed" };
