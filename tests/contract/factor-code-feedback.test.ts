import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import { AUTH_OUTCOMES, describeAuthOutcome } from "@/lib/auth/auth-outcome"

import { repositoryRoot } from "../support/source-tree"

/**
 * Pressing Verify with a code the provider refuses used to redirect back to the
 * same page, which rendered unchanged. It read as a broken button, and a reader
 * whose authenticator held a factor the account no longer had could not learn
 * that from the Console at all. Observed on the deployed Console on 2026-09-07.
 */

const source = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(relative, repositoryRoot)), "utf8")

describe("a refused authenticator code says so", () => {
  it("publishes one sentence for it", () => {
    const outcome = describeAuthOutcome(AUTH_OUTCOMES.factorCodeRefused)
    expect(outcome?.title).toMatch(/\S/)
    expect(outcome?.description).toMatch(/\S/)
  })

  it("discloses nothing an unauthenticated caller could use", () => {
    // The uniform sign-in wording exists to stop an address being enumerated.
    // By this point the address is already proven by an emailed code, so this
    // sentence may name the real cause; it must still not name an account.
    const outcome = describeAuthOutcome(AUTH_OUTCOMES.factorCodeRefused)
    expect(`${outcome?.title} ${outcome?.description}`).not.toMatch(/@|account exists/i)
  })

  it("is the destination of every refusal the route can reach", () => {
    const route = source("src/app/api/auth/mfa/challenge/route.ts")
    // A malformed code, a challenge that will not start, and a code the
    // provider rejects were three separate silent redirects.
    expect(route).toContain("const refused = ()")
    expect(route).toContain("AUTH_OUTCOMES.factorCodeRefused")
    expect(route).not.toContain('canonicalRedirect("/auth/mfa/challenge")\n')
  })

  it("is rendered by the page the reader lands on", () => {
    const page = source("src/app/auth/mfa/challenge/page.tsx")
    expect(page).toContain("describeAuthOutcome")
    expect(page).toContain("AlertTitle")
  })
})

describe("a reader whose authenticator is wrong has a way out", () => {
  it("offers to set up a new one", () => {
    expect(source("src/app/auth/mfa/challenge/page.tsx")).toContain(
      "/api/auth/mfa/restart",
    )
  })

  it("discards only a factor that was never confirmed", () => {
    // Replacing an established factor is account recovery, a different
    // ceremony with its own evidence, and it is not reachable from here.
    const route = source("src/app/api/auth/mfa/restart/route.ts")
    expect(route).toContain("factors.value.verified.length === 0")
    expect(route).toContain("factors.value.unverified.map")
  })
})

describe("a reload does not take away a code already scanned", () => {
  it("creates a factor only when the account has none", () => {
    // The page used to discard and re-create on every visit, so reloading
    // after scanning silently invalidated the secret in the reader's app.
    const page = source("src/app/auth/mfa/enroll/page.tsx")
    expect(page).toContain(
      "factors.value.verified.length + factors.value.unverified.length > 0",
    )
    expect(page).not.toContain("unenrollTotp")
  })
})

describe("the six digits stay one field", () => {
  const cells = source("src/components/auth/otp-cells.tsx")

  it("renders cells from a single input rather than six inputs", () => {
    // Six inputs would break pasting, the `one-time-code` autofill and a
    // screen reader announcing one field.
    expect(cells).toContain("InputOTP")
    expect(cells).toContain('autoComplete="one-time-code"')
  })

  it("lays the real input over the cells rather than beside them", () => {
    // The library's own inline styles did not take effect: the input rendered
    // in normal flow and showed the typed digits a second time.
    expect(cells).toContain("relative")
    expect(cells).toContain("absolute inset-0 size-full opacity-0")
  })

  it("submits itself once the last digit lands", () => {
    // The digits are valid for half a minute; asking for a second deliberate
    // act spends part of it. The button stays for anyone who fills the field
    // another way.
    const form = source("src/components/auth/totp-code-form.tsx")
    expect(form).toContain("onComplete")
    expect(form).toContain('type="submit"')
  })
})

describe("every screen asks for a code the same way", () => {
  it("uses the shared field and defines no second one", () => {
    // Three screens ask for six digits — the emailed code, first enrolment and
    // the step-up — and each had its own markup and its own styling.
    for (const file of [
      "src/components/auth/otp-verify-form.tsx",
      "src/components/auth/totp-code-form.tsx",
      "src/components/auth/reauthentication-ceremony.tsx",
    ]) {
      const component = source(file)
      expect(component, file).toContain("OtpCells")
      expect(component, file).not.toContain('autoComplete="one-time-code"')
    }
  })
})
