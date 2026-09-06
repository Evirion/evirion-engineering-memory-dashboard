import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import { AUTH_OUTCOMES, describeAuthOutcome } from "@/lib/auth/auth-outcome"
import { landingForAuthenticatedReader } from "@/lib/auth/authenticated-landing"

import { repositoryRoot } from "../support/source-tree"

/**
 * Six findings from walking the deployed sign-in flow, owned by the contract
 * packet at `docs/plans/active/eem-9-07-auth-flow-feedback-contract.md`.
 *
 * The two pure modules are exercised directly. The wiring is read from source,
 * following `auth-request-otp.test.ts`: the proxy and the route handlers need a
 * server environment they do not inject, and a weaker test that fails on the
 * exact regression beats no test at all.
 */

const source = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(relative, repositoryRoot)), "utf8")

describe("A1: a failure says what to do next", () => {
  it("renders one sentence for the only published outcome", () => {
    expect(describeAuthOutcome(AUTH_OUTCOMES.verificationFailed)).toMatch(/\S/)
  })

  it("renders nothing for a value the Console does not publish", () => {
    // The parameter is attacker-controlled. Rendering an unrecognised value
    // would let a crafted link put text of someone else's choosing on the
    // sign-in page, so only exact published codes speak.
    for (const value of [
      "",
      "unknown",
      "verification-failed ",
      "VERIFICATION-FAILED",
    ]) {
      expect(describeAuthOutcome(value)).toBeUndefined()
    }
    expect(describeAuthOutcome(undefined)).toBeUndefined()
  })

  it("keeps one sentence for every cause of a failed verification", () => {
    // OWASP A07 asks for the same message for all outcomes, not for no message.
    // The second code is not an exception to that: a failed registration can
    // only happen after the address is proven, so there is no identity left to
    // enumerate. Blaming the code for it sent a reader hunting a typo that did
    // not exist.
    expect(Object.values(AUTH_OUTCOMES)).toHaveLength(2)
    expect(describeAuthOutcome(AUTH_OUTCOMES.sessionNotRegistered)).not.toBe(
      describeAuthOutcome(AUTH_OUTCOMES.verificationFailed),
    )
  })

  it("blames the code only when the code was the problem", () => {
    expect(describeAuthOutcome(AUTH_OUTCOMES.verificationFailed)).toMatch(/code/i)
    expect(describeAuthOutcome(AUTH_OUTCOMES.sessionNotRegistered)).toMatch(
      /accepted|not your/i,
    )
  })

  it("is carried by the verify route and read by the sign-in page", () => {
    expect(source("src/app/api/auth/verify-otp/route.ts")).toContain(
      "AUTH_OUTCOME_PARAMETER",
    )
    expect(source("src/app/auth/sign-in/page.tsx")).toContain("describeAuthOutcome")
  })
})

describe("A2: the code is single-use, and the page says so first", () => {
  it("states it before the reader types rather than after they fail", () => {
    expect(source("src/app/auth/verify/page.tsx")).toMatch(/works once|single use/i)
  })

  it("keeps the refusal uniform instead of counting attempts", () => {
    // Chosen deliberately: a signed counter cookie is unforgeable but
    // replayable, and a fresh code costs nothing at 30 mails an hour.
    const route = source("src/app/api/auth/verify-otp/route.ts")
    expect(route).not.toMatch(/attempt(s|Count|Remaining)/i)
  })
})

describe("A3 and A4: a signed-in reader is not offered the door again", () => {
  it("sends an authenticated reader away from every pre-auth page", () => {
    for (const pathname of [
      "/auth/sign-in",
      "/auth/verify",
      "/auth/invite",
      "/auth/recovery",
    ]) {
      expect(landingForAuthenticatedReader(pathname, "navigate")).toBe("/onboarding")
    }
  })

  it("sends an authenticated reader off the placeholder root", () => {
    expect(landingForAuthenticatedReader("/", "navigate")).toBe("/onboarding")
  })

  it("leaves every other path alone, including the pages that need a session", () => {
    for (const pathname of [
      "/onboarding",
      "/repositories",
      "/auth/mfa/challenge",
      "/auth/mfa/enroll",
      "/api/auth/verify-otp",
    ]) {
      expect(landingForAuthenticatedReader(pathname, "navigate")).toBeUndefined()
    }
  })

  it("does not match a path that merely starts with a guarded one", () => {
    expect(
      landingForAuthenticatedReader("/auth/sign-in-elsewhere", "navigate"),
    ).toBeUndefined()
  })

  it("leaves a sub-resource request alone, so a refusal still lands visibly", () => {
    // Twenty-eight paths refuse by redirecting to sign-in. A fetch following
    // one is the application refusing, not a reader at the wrong door, and a
    // security test reads that landing to prove a forged proof went nowhere.
    for (const mode of ["cors", "no-cors", "same-origin", null]) {
      expect(landingForAuthenticatedReader("/auth/sign-in", mode)).toBeUndefined()
    }
  })

  it("is consulted by the proxy, which already reads the session", () => {
    expect(source("src/proxy.ts")).toContain("landingForAuthenticatedReader")
  })
})

describe("A5: no half-formed session survives", () => {
  it("clears the cookies when the backend never registered the session", () => {
    // A transient bootstrap failure used to keep the cookies for a retry that
    // no code performs, leaving the browser signed in against a backend that
    // had never heard of the session.
    const route = source("src/app/api/auth/verify-otp/route.ts")
    expect(route).not.toContain('bootstrap.failure.kind === "error"')
    expect(route).toMatch(/if \(!bootstrap\.ok\) return denied\(/)
    expect(route).toContain("AUTH_OUTCOMES.sessionNotRegistered")
  })
})

describe("A6: the refusal is true whatever the reader belongs to", () => {
  it("does not claim an organization was selected", () => {
    const errors = source("src/lib/errors/console-errors.ts")
    expect(errors).not.toContain("not available for the selected organization")
  })
})
