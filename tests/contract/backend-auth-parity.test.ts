import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import { SESSION_POLICY } from "@/lib/auth/session-policy"
import { repositoryRoot } from "../support/source-tree"

type AuthConfigLock = {
  source: { commit: string; files: { path: string; sha256: string }[] }
  expectedLocalAuthConfiguration: Record<string, unknown>
  expectedHostedAuthConfiguration: Record<string, unknown>
}

const read = <T>(relative: string): T =>
  JSON.parse(
    readFileSync(fileURLToPath(new URL(relative, repositoryRoot)), "utf8"),
  ) as T

/**
 * Dashboard and backend Auth parity, provable in CI.
 *
 * No Dashboard workflow token can read the backend repository, so CI checks
 * the Dashboard policy against values pinned from the backend at the exact
 * attestation-verified contract source commit. `scripts/check_backend_auth_parity.py`
 * closes the other half locally by re-reading the sibling.
 */
describe("backend Auth configuration parity", () => {
  const lock = read<AuthConfigLock>("docs/contracts/backend-auth-config-lock.json")
  const contract = read<{ sourceCommit: string }>(
    "docs/contracts/console-contract-lock.json",
  )
  const local = lock.expectedLocalAuthConfiguration
  const hosted = lock.expectedHostedAuthConfiguration

  it("pins the same commit the attestation-verified contract lock records", () => {
    expect(lock.source.commit).toBe(contract.sourceCommit)
    expect(lock.source.files.length).toBeGreaterThan(0)
    for (const entry of lock.source.files) {
      expect(entry.sha256).toMatch(/^[0-9a-f]{64}$/)
    }
  })

  it("keeps public signup and anonymous sign-in closed", () => {
    expect(local["signupEnabled"]).toBe(false)
    expect(local["anonymousSignInsEnabled"]).toBe(false)
    expect(hosted["signupEnabled"]).toBe(false)
    expect(hosted["anonymousSignInsEnabled"]).toBe(false)
  })

  it("keeps every provider outside email OTP plus TOTP disabled", () => {
    expect(hosted["allowedProviders"]).toEqual(["email-otp", "totp"])
    expect(hosted["manualIdentityLinkingEnabled"]).toBe(false)
    for (const provider of [
      "password",
      "phone",
      "google",
      "github",
      "saml",
      "anonymous",
    ]) {
      expect(hosted["disabledProviders"]).toContain(provider)
    }
  })

  it("keeps SMS closed and TOTP available", () => {
    expect(local["smsSignupEnabled"]).toBe(false)
    expect(local["smsConfirmationsEnabled"]).toBe(false)
    expect(local["totpEnrollEnabled"]).toBe(true)
    expect(local["totpVerifyEnabled"]).toBe(true)
  })

  it("agrees with the frozen Console session policy on every shared number", () => {
    expect(local["jwtExpirySeconds"]).toBe(SESSION_POLICY.jwtLifetimeSeconds)
    expect(local["otpExpirySeconds"]).toBe(SESSION_POLICY.emailOtpLifetimeSeconds)
    // "1m" and 60 seconds are the same cooldown expressed in two notations.
    expect(local["otpMaxFrequency"]).toBe("1m")
    expect(SESSION_POLICY.otpResendCooldownSeconds).toBe(60)
  })

  it("keeps the redirect allowlist at exactly the pinned origin", () => {
    expect(local["siteUrl"]).toBe("https://console.evirion.test:3443")
    expect(local["additionalRedirectUrls"]).toEqual([
      "https://console.evirion.test:3443",
    ])
  })

  it("expects the same settings locally and hosted", () => {
    for (const key of [
      "signupEnabled",
      "anonymousSignInsEnabled",
      "smsSignupEnabled",
      "smsConfirmationsEnabled",
      "totpEnrollEnabled",
      "totpVerifyEnabled",
      "jwtExpirySeconds",
      "otpExpirySeconds",
      "otpLength",
      "otpMaxFrequency",
    ]) {
      expect(hosted[key], `hosted ${key} must match local`).toEqual(local[key])
    }
  })
})
