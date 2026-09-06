/**
 * The one thing an Auth failure is allowed to say.
 *
 * Every refusal in the sign-in flow used to be a bare redirect: a wrong code,
 * an expired code, a failed CSRF check and a refused admission all produced the
 * same silent bounce to sign-in. The uniformity was deliberate and is kept —
 * a distinguishable reply is an account-enumeration oracle — but OWASP A07 asks
 * for *the same message* for every outcome, not for no message. Silence was
 * paying for a property the single sentence below already provides.
 *
 * The parameter travels in a URL, so it is attacker-controlled. Only an exact
 * published code renders; anything else renders nothing, because a crafted link
 * must not be able to put text on the page.
 */

export const AUTH_OUTCOME_PARAMETER = "status"

export const AUTH_OUTCOMES = {
  /**
   * Every failed verification, whatever caused it. A third code here would have
   * to argue why the distinction it draws is not an oracle.
   */
  verificationFailed: "verification-failed",
  /**
   * The code was accepted and the session could not be registered afterwards.
   *
   * This is a separate sentence because the first one lies about it. A reader
   * whose code worked was told "that code did not work" and went hunting for a
   * typo that did not exist — which is exactly what happened on staging on
   * 2026-09-06. Distinguishing it leaks nothing: by the time it can occur the
   * address has already been proven, so there is no identity left to enumerate.
   */
  sessionNotRegistered: "session-not-registered",
} as const

export type AuthOutcome = (typeof AUTH_OUTCOMES)[keyof typeof AUTH_OUTCOMES]

export type AuthOutcomePresentation = {
  readonly title: string
  readonly description: string
}

const PRESENTATIONS: Readonly<Record<AuthOutcome, AuthOutcomePresentation>> = {
  // The headline lives in the alert's title; description is what to do next.
  // Both stay identical for every cause of a failed verification, which is the
  // enumeration property.
  [AUTH_OUTCOMES.verificationFailed]: {
    title: "That code did not work",
    description:
      "Each code can only be used once. Enter your address to get a new one.",
  },
  [AUTH_OUTCOMES.sessionNotRegistered]: {
    title: "The session could not be started",
    description:
      "Your code was accepted, but the session could not be started. Try again; if it keeps happening the problem is ours, not yours.",
  },
}

const isAuthOutcome = (value: string): value is AuthOutcome =>
  Object.hasOwn(PRESENTATIONS, value)

export const describeAuthOutcome = (
  value: string | undefined,
): AuthOutcomePresentation | undefined =>
  value !== undefined && isAuthOutcome(value) ? PRESENTATIONS[value] : undefined
