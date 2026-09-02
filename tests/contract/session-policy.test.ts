import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import { COOKIE_BUDGET, SESSION_POLICY } from "@/lib/auth/session-policy"
import { repositoryRoot } from "../support/source-tree"

type Baseline = {
  authSession: Record<string, string | number | boolean>
  cookieBudget: Record<string, string | number>
  hosting: Record<string, string | number>
  serverBrowserBoundary: {
    browserForbidden: string[]
    cookieAttributes: string
    supabaseAuthMethods: string[]
    supabaseSessionMethodForbidden: string
  }
}

/**
 * The Auth/session and cookie numbers are frozen. This asserts the TypeScript
 * constants are a faithful mirror of the baseline rather than a second,
 * drifting source, so no value can be invented or rounded in code.
 */
const durationToSeconds = (value: string): number => {
  const match = /^(\d+)(s|m|h)/.exec(value)
  if (!match) throw new Error(`unparsable duration: ${value}`)
  const amount = Number(match[1])
  switch (match[2]) {
    case "s":
      return amount
    case "m":
      return amount * 60
    case "h":
      return amount * 3600
    default:
      throw new Error(`unsupported duration unit in ${value}`)
  }
}

describe("frozen Auth session policy", () => {
  const baseline = JSON.parse(
    readFileSync(
      fileURLToPath(
        new URL("docs/architecture/toolchain-baseline.json", repositoryRoot),
      ),
      "utf8",
    ),
  ) as Baseline

  it.each([
    ["jwtLifetime", "jwtLifetimeSeconds"],
    ["absoluteApplicationSession", "absoluteSessionSeconds"],
    ["idleExpiry", "idleExpirySeconds"],
    ["idleWarning", "idleWarningSeconds"],
    ["emailOtpLifetime", "emailOtpLifetimeSeconds"],
    ["otpResendCooldown", "otpResendCooldownSeconds"],
    ["dangerousOperationReauthentication", "reauthenticationSeconds"],
    ["touchCoalescing", "touchCoalescingSeconds"],
  ] as const)("mirrors authSession.%s exactly", (baselineKey, policyKey) => {
    expect(SESSION_POLICY[policyKey]).toBe(
      durationToSeconds(baseline.authSession[baselineKey] as string),
    )
  })

  it("mirrors the concurrent session cap and its replacement notice", () => {
    expect(SESSION_POLICY.concurrentSessionMaximum).toBe(
      baseline.authSession["concurrentSessionMaximum"],
    )
    expect(SESSION_POLICY.oldestSessionReplacementNoticeRequired).toBe(
      baseline.authSession["oldestSessionReplacementNoticeRequired"],
    )
  })

  it("ties the idle window to visible-tab human activity", () => {
    expect(baseline.authSession["idleExpiry"]).toBe("30m-visible-tab-human-activity")
    expect(SESSION_POLICY.idleExpirySeconds).toBe(30 * 60)
    // The warning precedes expiry; a warning longer than the window is a bug.
    expect(SESSION_POLICY.idleWarningSeconds).toBeLessThan(
      SESSION_POLICY.idleExpirySeconds,
    )
  })

  it("mirrors every cookie budget value exactly", () => {
    expect(COOKIE_BUDGET.chunkMaximum).toBe(
      baseline.cookieBudget["logicalCookieChunkMaximum"],
    )
    expect(COOKIE_BUDGET.chunkValueBytes).toBe(
      baseline.cookieBudget["logicalCookieChunkValueBytes"],
    )
    expect(COOKIE_BUDGET.requestHeaderBytes).toBe(
      baseline.cookieBudget["aggregateRequestCookieHeaderBytes"],
    )
    expect(COOKIE_BUDGET.responseHeaderBytes).toBe(
      baseline.cookieBudget["aggregateResponseSetCookieHeaderBytes"],
    )
    expect(baseline.cookieBudget["overflowBehavior"]).toBe(
      "fail-closed-with-cookie-budget-error",
    )
  })

  it("keeps the browser-forbidden inventory and the cookie attributes frozen", () => {
    expect(baseline.serverBrowserBoundary.cookieAttributes).toBe(
      "__Host- prefix; HttpOnly; Secure; SameSite=Lax; Path=/; no Domain",
    )
    expect(baseline.serverBrowserBoundary.supabaseSessionMethodForbidden).toBe(
      "getSession",
    )
    expect(baseline.serverBrowserBoundary.supabaseAuthMethods).toEqual([
      "getClaims",
      "getUser",
    ])
    for (const forbidden of [
      "Supabase access token",
      "Supabase refresh token",
      "service_role key",
    ]) {
      expect(baseline.serverBrowserBoundary.browserForbidden).toContain(forbidden)
    }
  })

  it("keeps the pinned local origin and the single trusted proxy hop", () => {
    expect(baseline.hosting["localHttpsOrigin"]).toBe(
      "https://console.evirion.test:3443",
    )
    expect(baseline.hosting["trustedProxyHops"]).toBe(1)
  })
})
