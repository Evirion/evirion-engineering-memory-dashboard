import type { VerifiedUser } from "./auth-provider"

/**
 * Which verified identities the frozen Alpha contract permits.
 *
 * The provider allowlist is email OTP plus TOTP MFA and nothing else. An
 * anonymous, password, phone, social, SSO, recovery or manually linked
 * identity denies at bootstrap and at every protected request, and so does
 * configuration drift that introduces a provider nobody approved.
 */

export const ALLOWED_PROVIDERS = ["email"] as const
export const ALLOWED_AMR_METHODS = ["otp", "email", "mfa", "totp"] as const

export type AdmissionRejection =
  | "anonymous-identity"
  | "unverified-email"
  | "unsupported-provider"
  | "unsupported-amr"
  | "linked-identity"
  | "missing-session-id"

export type AdmissionResult =
  | { readonly admitted: true }
  | { readonly admitted: false; readonly reason: AdmissionRejection }

const denied = (reason: AdmissionRejection): AdmissionResult => ({
  admitted: false,
  reason,
})

export const admitVerifiedIdentity = (user: VerifiedUser): AdmissionResult => {
  if (user.isAnonymous) return denied("anonymous-identity")
  if (!user.emailVerified || user.email.length === 0) return denied("unverified-email")
  if (user.sessionId.length === 0) return denied("missing-session-id")

  const providers = [...new Set(user.providers)]
  if (providers.length === 0) return denied("unsupported-provider")
  // More than one provider on one principal is a linked identity, which the
  // frozen contract refuses without an explicit relinking flow.
  if (providers.length > 1) return denied("linked-identity")
  if (
    !providers.every((provider) =>
      (ALLOWED_PROVIDERS as readonly string[]).includes(provider),
    )
  ) {
    return denied("unsupported-provider")
  }

  const methods = user.amr.filter((method) => method.length > 0)
  if (
    !methods.every((method) =>
      (ALLOWED_AMR_METHODS as readonly string[]).includes(method),
    )
  ) {
    return denied("unsupported-amr")
  }

  return { admitted: true }
}

/**
 * A privileged mutation needs `aal2` from fresh evidence. A stale token that
 * still claims `aal2` after a factor change is refused, because the provider's
 * next AAL is the authority on what the principal must now satisfy.
 */
export const satisfiesPrivilegedAal = (user: VerifiedUser): boolean =>
  user.currentAal === "aal2" && user.nextAal === "aal2"

export const requiresReauthentication = (user: VerifiedUser): boolean =>
  user.nextAal === "aal2" && user.currentAal !== "aal2"
