import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import { repositoryRoot } from "../support/source-tree"

/**
 * The sign-in route must actually ask the provider to send a code.
 *
 * It did not. `request-otp` bound a proof, set cookies and redirected to the
 * verify page without ever calling anyone, so sign-in could not succeed for any
 * address. Nothing caught it, for two reasons worth keeping in mind: the reply
 * is identical whatever happens, which is the property that stops account
 * enumeration and also hides a missing send; and every Console check until
 * EEM-9/07 ran against the test double, which answered as the contract
 * described without anyone asking whether a call had been made.
 *
 * A behavioural test would need the route to run with a provider it does not
 * inject. Reading the source is weaker, but it fails on exactly the regression
 * that happened, which no test did before.
 */

const source = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(relative, repositoryRoot)), "utf8")

const REQUEST_OTP = "src/app/api/auth/request-otp/route.ts"
const VERIFY_OTP = "src/app/api/auth/verify-otp/route.ts"

describe("the sign-in route sends a code", () => {
  it("calls the provider that requests the email OTP", () => {
    const route = source(REQUEST_OTP)

    expect(route).toContain("createSupabaseAuthProvider")
    expect(route).toMatch(/requestEmailOtp\s*\(/)
  })

  it("asks for the code before it mints the proof that verifies it", () => {
    // Binding a proof for a code nobody sent leaves the user on a verify page
    // that can never succeed, which is the shape the defect took. Compare call
    // sites rather than first occurrences: both names appear in the imports.
    const route = source(REQUEST_OTP)
    const send = route.indexOf(".requestEmailOtp(")
    const mint = route.indexOf("await issueCsrfToken(")

    expect(send).toBeGreaterThan(-1)
    expect(mint).toBeGreaterThan(-1)
    expect(send).toBeLessThan(mint)
  })

  it("keeps one reply for every outcome, so the send is not an enumeration oracle", () => {
    const route = source(REQUEST_OTP)
    const redirects = [...route.matchAll(/canonicalRedirect\("([^"]+)"\)/g)].map(
      (match) => match[1],
    )

    // Every path ends at the sign-in page or the verify page, and the provider
    // result is deliberately not branched on.
    expect(new Set(redirects)).toEqual(new Set(["/auth/sign-in", "/auth/verify"]))
    expect(route).not.toMatch(/requestEmailOtp[\s\S]{0,200}?\bif\s*\(/)
  })

  it("verifies through the same provider it requested from", () => {
    const verify = source(VERIFY_OTP)

    expect(verify).toContain("createSupabaseAuthProvider")
    expect(verify).toMatch(/verifyEmailOtp\s*\(/)
  })
})
