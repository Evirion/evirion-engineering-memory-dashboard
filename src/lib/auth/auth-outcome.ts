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

const SENTENCES: Readonly<Record<AuthOutcome, string>> = {
  // The headline lives in the alert's title; this is what to do next. Both are
  // identical for every cause, which is the enumeration property.
  [AUTH_OUTCOMES.verificationFailed]:
    "Each code can only be used once. Enter your address to get a new one.",
  [AUTH_OUTCOMES.sessionNotRegistered]:
    "Your code was accepted, but the session could not be started. Try again; if it keeps happening the problem is ours, not yours.",
}

const isAuthOutcome = (value: string): value is AuthOutcome =>
  Object.hasOwn(SENTENCES, value)

export const describeAuthOutcome = (value: string | undefined): string | undefined =>
  value !== undefined && isAuthOutcome(value) ? SENTENCES[value] : undefined
