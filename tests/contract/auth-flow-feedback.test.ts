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
    expect(describeAuthOutcome(AUTH_OUTCOMES.verificationFailed)?.description).toMatch(
      /\S/,
    )
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
    // The property this protects is the sign-in one: an unauthenticated caller
    // must not learn whether an address is known. None of the other three codes
    // touches it, because each can only occur after the address has been proven
    // by an emailed code, so no identity is left to enumerate. Blaming the code
    // for any of them sent a reader hunting a typo that did not exist, and
    // inviting a retry that cannot succeed sent them hunting nothing at all.
    expect(Object.values(AUTH_OUTCOMES)).toHaveLength(4)
    const distinct = new Set(
      Object.values(AUTH_OUTCOMES).map(
        (outcome) => describeAuthOutcome(outcome)?.description,
      ),
    )
    expect(distinct.size).toBe(4)
  })

  it("blames the code only when the code was the problem", () => {
    expect(describeAuthOutcome(AUTH_OUTCOMES.verificationFailed)?.title).toMatch(
      /code/i,
    )
    expect(
      describeAuthOutcome(AUTH_OUTCOMES.sessionNotRegistered)?.description,
    ).toMatch(/accepted|not your/i)
  })

  it("is carried by the verify route and read by the sign-in page", () => {
    expect(source("src/app/api/auth/verify-otp/route.ts")).toContain(
      "AUTH_OUTCOME_PARAMETER",
    )
    const page = source("src/app/auth/sign-in/page.tsx")
    expect(page).toContain("describeAuthOutcome")
    expect(page).toContain("AlertCircleIcon")
    expect(page).toContain("AlertTitle")
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
  it("leaves an authenticated reader on an Auth page rather than looping them", () => {
    // This used to send them to the Console, and that was the wrong trade. The
    // protected shell sends a reader whose session the backend refuses to
    // sign-in, so bouncing them back produced an unbreakable loop between the
    // two — observed on the deployed Console once the access token expired.
    // Offering sign-in to someone who already holds a session is untidy; a loop
    // is a broken product.
    for (const pathname of [
      "/auth/sign-in",
      "/auth/verify",
      "/auth/invite",
      "/auth/recovery",
    ]) {
      expect(landingForAuthenticatedReader(pathname, "navigate", true)).toBeUndefined()
    }
  })

  it("sends an authenticated reader off the placeholder root", () => {
    expect(landingForAuthenticatedReader("/", "navigate", true)).toBe("/onboarding")
  })

  it("leaves every other path alone, including the pages that need a session", () => {
    for (const pathname of [
      "/onboarding",
      "/repositories",
      "/auth/mfa/challenge",
      "/auth/mfa/enroll",
      "/api/auth/verify-otp",
    ]) {
      expect(landingForAuthenticatedReader(pathname, "navigate", true)).toBeUndefined()
    }
  })

  it("does not match a path that merely starts with a guarded one", () => {
    expect(
      landingForAuthenticatedReader("/auth/sign-in-elsewhere", "navigate", true),
    ).toBeUndefined()
  })

  it("leaves a sub-resource request alone, so a refusal still lands visibly", () => {
    // Twenty-eight paths refuse by redirecting to sign-in. A fetch following
    // one is the application refusing, not a reader at the wrong door, and a
    // security test reads that landing to prove a forged proof went nowhere.
    for (const mode of ["cors", "no-cors", "same-origin", null]) {
      expect(landingForAuthenticatedReader("/auth/sign-in", mode, true)).toBeUndefined()
    }
  })

  it("sends a session that has not proved a second factor to finish it", () => {
    // The backend creates an `aal1` session awaiting that proof and refuses
    // every read until it arrives, so the Console is not a place this reader
    // can be sent: they would meet a page that could only fail.
    for (const pathname of ["/", "/onboarding", "/repositories", "/settings/members"]) {
      expect(landingForAuthenticatedReader(pathname, "navigate", false)).toBe(
        "/auth/mfa/enroll",
      )
    }
  })

  it("never redirects that reader away from an Auth path", () => {
    // Sending them off sign-in deadlocked an enrolment that could not proceed:
    // the page sent them to sign in, this sent them back, and the browser gave
    // up with ERR_TOO_MANY_REDIRECTS. Sign-in is the way out of every
    // half-finished session, so it stays reachable. A form POST also carries
    // `sec-fetch-mode: navigate`, so the handlers cannot be assumed to be
    // fetches.
    for (const pathname of [
      "/auth/sign-in",
      "/auth/verify",
      "/auth/recovery",
      "/auth/mfa/enroll",
      "/auth/mfa/challenge",
      "/api/auth/mfa/challenge",
      "/api/auth/verify-otp",
      "/api/auth/logout",
    ]) {
      expect(landingForAuthenticatedReader(pathname, "navigate", false)).toBeUndefined()
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
    // Both failure paths must leave through `denied`, which is what clears the
    // cookies. Choosing which sentence to show is allowed; returning without
    // clearing is not.
    const route = source("src/app/api/auth/verify-otp/route.ts")
    expect(route).toMatch(/if \(!preAuth\.ok\) return denied\(/)
    expect(route).toMatch(/if \(!bootstrap\.ok\) return denied\(/)
    expect(route).toContain("AUTH_OUTCOMES.sessionNotRegistered")
  })
})

describe("A5b: a refusal no retry can fix says so", () => {
  it("separates the account the Console will never admit from a failed attempt", () => {
    // A platform operator is provisioned outside the invitation path, so the
    // backend refuses its pre-auth every time. Telling that reader "the problem
    // is ours" sent them retrying a door that was never theirs.
    const permanent = describeAuthOutcome(AUTH_OUTCOMES.sessionNotPermitted)
    expect(permanent?.description).toMatch(/not a member/i)
    expect(permanent?.description).not.toMatch(/try again/i)

    const transient = describeAuthOutcome(AUTH_OUTCOMES.sessionNotRegistered)
    expect(transient?.description).toMatch(/try again/i)
  })

  it("reads the refusal off the status the backend answered with", () => {
    const route = source("src/app/api/auth/verify-otp/route.ts")
    expect(route).toContain("AUTH_OUTCOMES.sessionNotPermitted")
    expect(route).toMatch(/status >= 400 && failure\.status < 500/)
  })
})

describe("A6: the refusal is true whatever the reader belongs to", () => {
  it("does not claim an organization was selected", () => {
    const errors = source("src/lib/errors/console-errors.ts")
    expect(errors).not.toContain("not available for the selected organization")
  })
})
