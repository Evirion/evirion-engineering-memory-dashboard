import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { expect, test } from "@playwright/test"

import { repositoryRoot } from "../support/source-tree"

/**
 * Hosted Auth limits and the evidence that proves them, acceptance row AUTH-009.
 *
 * `tests/contract/backend-auth-parity.test.ts` already proves the settings
 * match between local and hosted. This proves the half that matters to a person
 * at the sign-in page: the limits are the frozen ones, the answers give nothing
 * away about who exists, and the parity itself is verifiable rather than
 * asserted.
 *
 * Nothing here reads or changes hosted Supabase. The hosted side is represented
 * by the pinned expectation, which is what a release can actually check.
 */

const lock = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL("docs/contracts/backend-auth-config-lock.json", repositoryRoot),
    ),
    "utf8",
  ),
) as {
  expectedHostedAuthConfiguration: Record<string, unknown>
  expectedLocalAuthConfiguration: Record<string, unknown>
  verification: { localCommand: string; ciBehaviour: string }
}

/** The configuration without its prose, which differs by design. */
const settings = (source: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(source).filter(([key]) => key !== "note" && key !== "source"),
  )

test.describe("hosted_provider_limits_and_release_evidence", () => {
  test("the hosted expectation closes every provider outside email OTP and TOTP", () => {
    const hosted = lock.expectedHostedAuthConfiguration
    expect(hosted.allowedProviders).toEqual(["email-otp", "totp"])
    expect(hosted.anonymousSignInsEnabled).toBe(false)
    const disabled = hosted.disabledProviders as readonly string[]
    for (const provider of [
      "password",
      "phone",
      "google",
      "github",
      "saml",
      "anonymous",
    ]) {
      expect(disabled, `${provider} is not explicitly disabled`).toContain(provider)
    }
  })

  test("local and hosted expect the same settings, not two opinions", () => {
    // A drift between them would mean the thing verified locally is not the
    // thing deployed. Prose differs by design and is not a setting.
    const local = settings(lock.expectedLocalAuthConfiguration)
    const hosted = settings(lock.expectedHostedAuthConfiguration)
    const shared = Object.keys(local).filter((key) => key in hosted)
    expect(shared.length).toBeGreaterThan(3)
    for (const key of shared) {
      expect(hosted[key], `${key} differs between local and hosted`).toEqual(local[key])
    }
  })

  test("the parity claim names a command a release can actually run", () => {
    expect(lock.verification.localCommand).toContain("check_backend_auth_parity.py")
    // CI cannot read the sibling repository, and the lock says so rather than
    // pretending the comparison happens there.
    expect(lock.verification.ciBehaviour).toContain("pinned values")
  })

  test("the sign-in page gives nothing away about who exists", async ({ page }) => {
    await page.goto("/auth/sign-in")
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()

    const body = (await page.locator("body").innerText()).toLowerCase()
    // An invite-only product must not confirm or deny an address before the
    // code is checked.
    for (const leak of [
      "no account",
      "not registered",
      "unknown email",
      "already exists",
    ]) {
      expect(body.includes(leak), `the sign-in page says "${leak}"`).toBe(false)
    }
  })

  test("the page offers no password or social route into the product", async ({
    page,
  }) => {
    await page.goto("/auth/sign-in")
    expect(await page.locator('input[type="password"]').count()).toBe(0)
    expect(
      await page
        .getByRole("button", { name: /google|github|apple|sign in with/i })
        .count(),
    ).toBe(0)
  })

  test("the resend cooldown a person is told about is the frozen one", async ({
    page,
  }) => {
    await page.goto("/auth/verify")
    const body = (await page.locator("body").innerText()).replaceAll(/\s+/g, " ")
    // EEM-9/01 froze the resend cooldown at sixty seconds. A cooldown nobody is
    // told about is a bound a person cannot plan around.
    expect(body).toMatch(/60\s*second|1\s*minute/i)
  })
})
