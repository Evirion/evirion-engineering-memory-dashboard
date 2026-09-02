import { describe, expect, it } from "vitest"

import type { VerifiedUser } from "@/lib/auth/auth-provider"
import {
  admitVerifiedIdentity,
  requiresReauthentication,
  satisfiesPrivilegedAal,
} from "@/lib/auth/identity-admission"

const user = (overrides: Partial<VerifiedUser> = {}): VerifiedUser => ({
  id: "00000000-0000-4000-8000-000000000001",
  email: "partner@example.test",
  emailVerified: true,
  isAnonymous: false,
  amr: ["otp"],
  providers: ["email"],
  sessionId: "00000000-0000-4000-8000-000000000002",
  currentAal: "aal1",
  nextAal: "aal1",
  ...overrides,
})

describe("identity admission", () => {
  it("admits a verified email-OTP identity", () => {
    expect(admitVerifiedIdentity(user())).toEqual({ admitted: true })
  })

  it("admits an email-OTP identity that has completed TOTP", () => {
    expect(
      admitVerifiedIdentity(
        user({ amr: ["otp", "totp"], currentAal: "aal2", nextAal: "aal2" }),
      ),
    ).toEqual({ admitted: true })
  })

  it("denies an anonymous identity", () => {
    expect(admitVerifiedIdentity(user({ isAnonymous: true }))).toEqual({
      admitted: false,
      reason: "anonymous-identity",
    })
  })

  it("denies an unverified or absent email", () => {
    expect(admitVerifiedIdentity(user({ emailVerified: false }))).toEqual({
      admitted: false,
      reason: "unverified-email",
    })
    expect(admitVerifiedIdentity(user({ email: "" }))).toEqual({
      admitted: false,
      reason: "unverified-email",
    })
  })

  it.each(["phone", "google", "github", "saml", "password", "apple"])(
    "denies the %s provider, which the allowlist does not carry",
    (provider) => {
      expect(admitVerifiedIdentity(user({ providers: [provider] }))).toEqual({
        admitted: false,
        reason: "unsupported-provider",
      })
    },
  )

  it("denies a linked identity carrying more than one provider", () => {
    expect(admitVerifiedIdentity(user({ providers: ["email", "google"] }))).toEqual({
      admitted: false,
      reason: "linked-identity",
    })
  })

  it.each(["password", "sso", "recovery", "phone", "oauth", "anonymous"])(
    "denies the %s authentication method",
    (method) => {
      expect(admitVerifiedIdentity(user({ amr: [method] }))).toEqual({
        admitted: false,
        reason: "unsupported-amr",
      })
    },
  )

  it("denies a token carrying no session identity", () => {
    expect(admitVerifiedIdentity(user({ sessionId: "" }))).toEqual({
      admitted: false,
      reason: "missing-session-id",
    })
  })

  it("denies an identity with no provider at all", () => {
    expect(admitVerifiedIdentity(user({ providers: [] }))).toEqual({
      admitted: false,
      reason: "unsupported-provider",
    })
  })
})

describe("privileged AAL evidence", () => {
  it("permits a privileged mutation only when current and next AAL are both aal2", () => {
    expect(satisfiesPrivilegedAal(user({ currentAal: "aal2", nextAal: "aal2" }))).toBe(
      true,
    )
    expect(satisfiesPrivilegedAal(user({ currentAal: "aal1", nextAal: "aal1" }))).toBe(
      false,
    )
  })

  it("refuses a stale token that still claims aal2 after a factor change", () => {
    // The provider now expects aal2 but this token was minted at aal1, so the
    // application session must reauthenticate before anything privileged.
    const stale = user({ currentAal: "aal1", nextAal: "aal2" })

    expect(satisfiesPrivilegedAal(stale)).toBe(false)
    expect(requiresReauthentication(stale)).toBe(true)
  })

  it("does not demand reauthentication when no step-up is pending", () => {
    expect(
      requiresReauthentication(user({ currentAal: "aal1", nextAal: "aal1" })),
    ).toBe(false)
    expect(
      requiresReauthentication(user({ currentAal: "aal2", nextAal: "aal2" })),
    ).toBe(false)
  })
})
