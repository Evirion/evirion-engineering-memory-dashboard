import "server-only"

import type { AuthProvider, TotpChallenge } from "./auth-provider"

const STUB_TOTP_CODE = "123456"

/**
 * Auth behaviour for the browser gate's stub principal tokens.
 *
 * The Console API double does not implement GoTrue, but the ceremony still
 * re-verifies TOTP before it completes a backend challenge. This provider
 * accepts the documented fixture code and returns the same caller token so
 * journeys stay on the stub path.
 */

export const isStubAccessToken = (accessToken: string): boolean => {
  const principal = accessToken.split("|")[0] ?? ""
  return principal.startsWith("console-stub-")
}

export const createStubAuthProvider = (accessToken: string): AuthProvider => {
  const challenge: TotpChallenge = {
    factorId: "00000000-0000-4000-8000-00000000e001",
    challengeId: "00000000-0000-4000-8000-00000000e002",
  }

  return {
    async requestEmailOtp() {
      return { status: "ok", value: null }
    },
    async verifyEmailOtp() {
      return { status: "denied", reason: "stub-provider" }
    },
    async getUser() {
      return { status: "denied", reason: "stub-provider" }
    },
    async refresh() {
      return { status: "denied", reason: "stub-provider" }
    },
    async signOut() {
      return { status: "ok", value: null }
    },
    async enrollTotp() {
      return { status: "denied", reason: "stub-provider" }
    },
    async challengeTotp() {
      return { status: "ok", value: challenge }
    },
    async verifyTotp(_token, _challenge, code) {
      if (code !== STUB_TOTP_CODE) {
        return { status: "denied", reason: "totp-rejected" }
      }
      const now = Math.floor(Date.now() / 1000)
      return {
        status: "ok",
        value: {
          accessToken,
          refreshToken: `${accessToken}-refresh`,
          accessTokenExpiresAt: now + 900,
          sessionId: "00000000-0000-4000-8000-00000000d001",
        },
      }
    },
  }
}
