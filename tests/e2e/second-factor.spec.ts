import { expect, test } from "@playwright/test"

import { signIn } from "../support/session-fixture"

/**
 * The enrolment page a reader meets immediately after their first sign-in.
 *
 * It replaced a page that offered a button, called the provider and threw the
 * answer away, so the reader registered a factor they had no way to hold. The
 * assertions below are the three things that made it unusable.
 */
test.describe("first second-factor enrolment", () => {
  test.beforeEach(async ({ context }) => {
    await signIn(context)
  })

  test("shows a scannable code and the key to type instead", async ({ page }) => {
    await page.goto("/auth/mfa/enroll")

    await expect(
      page.getByRole("heading", { name: "Set up your authenticator" }),
    ).toBeVisible()
    await expect(
      page.getByRole("img", { name: "QR code for your authenticator app" }),
    ).toBeVisible()
    await expect(page.getByText("JBSWY3DPEHPK3PXP", { exact: false })).toBeVisible()
  })

  test("takes the confirming code in one labelled field", async ({ page }) => {
    await page.goto("/auth/mfa/enroll")

    const code = page.getByLabel("Enter the six-digit code the app shows")
    await expect(code).toBeVisible()
    await expect(code).toHaveAttribute("autocomplete", "one-time-code")
    await expect(code).toHaveAttribute("inputmode", "numeric")
  })

  test("keeps the seed out of anything the browser retains", async ({ page }) => {
    const response = await page.goto("/auth/mfa/enroll")

    expect(response?.headers()["cache-control"] ?? "").toContain("no-store")
    const storage = await page.evaluate(() => ({
      local: JSON.stringify({ ...window.localStorage }),
      session: JSON.stringify({ ...window.sessionStorage }),
    }))
    expect(storage.local).toBe("{}")
    expect(storage.session).toBe("{}")
  })
})
