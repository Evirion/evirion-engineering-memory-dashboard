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
   * Every failed verification, whatever caused it. A second code here would
   * have to argue why the distinction it draws is not an oracle.
   */
  verificationFailed: "verification-failed",
} as const

export type AuthOutcome = (typeof AUTH_OUTCOMES)[keyof typeof AUTH_OUTCOMES]

const SENTENCES: Readonly<Record<AuthOutcome, string>> = {
  [AUTH_OUTCOMES.verificationFailed]:
    "That code did not work, and each code can only be used once. Enter your address to get a new one.",
}

const isAuthOutcome = (value: string): value is AuthOutcome =>
  Object.hasOwn(SENTENCES, value)

export const describeAuthOutcome = (value: string | undefined): string | undefined =>
  value !== undefined && isAuthOutcome(value) ? SENTENCES[value] : undefined
