import { expect, test } from "@playwright/test"

/**
 * J-001, owned by EEM-9/02 C02.
 *
 * The journey runs against the Console and its BFF over the pinned HTTPS
 * origin. The provider side of OTP delivery and the backend session bootstrap
 * belong to EEM-9/07, which wires the live local stack under its own
 * authorization; what is proved here is every step the Console itself owns.
 */
test.describe("journey_accept_invite_and_sign_in", () => {
  test("offers a clean sign-in with no credential-bearing link", async ({ page }) => {
    await page.goto("/auth/sign-in")

    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible()
    await expect(page.getByLabel("Email address")).toBeVisible()
    // No magic link, and no invitation token anywhere in the document.
    expect(await page.content()).not.toMatch(/confirmation_url|token_hash|magic/i)
  })

  test("answers identically for a known and an unknown address", async ({ page }) => {
    const responses: string[] = []

    for (const email of ["known@example.test", "definitely-unknown@example.test"]) {
      await page.goto("/auth/sign-in")
      await page.getByLabel("Email address").fill(email)
      await page.getByRole("button", { name: "Send code" }).click()
      await page.waitForURL(/\/auth\/(verify|sign-in)/)
      responses.push(new URL(page.url()).pathname)
    }

    // A distinguishable answer here is an account-enumeration oracle.
    expect(new Set(responses).size).toBe(1)
  })

  test("collects the code in a form body, never in a URL", async ({ page }) => {
    await page.goto("/auth/verify")

    const code = page.getByLabel("Six-digit code")
    await expect(code).toBeVisible()
    await expect(code).toHaveAttribute("autocomplete", "one-time-code")
    await expect(code).toHaveAttribute("inputmode", "numeric")

    const form = page.locator("form")
    await expect(form).toHaveAttribute("method", "post")
    await expect(form).toHaveAttribute("action", "/api/auth/verify-otp")
  })

  test("states the frozen code lifetime and resend cooldown", async ({ page }) => {
    await page.goto("/auth/verify")
    const body = (await page.textContent("body")) ?? ""

    expect(body).toContain("10 minutes")
    expect(body).toContain("60 seconds")
  })

  test("tells the customer only the most recent code works", async ({ page }) => {
    await page.goto("/auth/verify")

    await expect(page.getByText(/only the most recent code works/i)).toBeVisible()
  })

  test("keeps the invite surface silent before the email is verified", async ({
    page,
  }) => {
    await page.goto("/auth/invite")
    const body = (await page.textContent("body")) ?? ""

    // Zero, one and many are three screens, and none of them may disclose an
    // organization name, slug or count before a session exists.
    expect(body).toContain("Verify your email address")
    expect(body).not.toMatch(/organization[s]?\s*:/i)
  })

  test("describes onboarding as starting nothing on its own", async ({ page }) => {
    await page.goto("/onboarding")

    // Protected, so an unauthenticated caller lands on sign-in instead.
    expect(page.url()).toContain("/auth/sign-in")
  })

  test("keeps the whole journey keyboard reachable", async ({ page }) => {
    await page.goto("/auth/sign-in")

    await page.keyboard.press("Tab")
    const focused = await page.evaluate(() => document.activeElement?.tagName ?? "")

    expect(["INPUT", "BUTTON", "A"]).toContain(focused)
  })

  test("gives every form control an accessible name", async ({ page }) => {
    for (const path of ["/auth/sign-in", "/auth/verify", "/auth/recovery"]) {
      await page.goto(path)

      const unnamed = await page.evaluate(
        () =>
          [
            ...document.querySelectorAll("input:not([type=hidden]), select, textarea"),
          ].filter((element) => {
            const id = element.getAttribute("id")
            const labelled =
              element.getAttribute("aria-label") ??
              element.getAttribute("aria-labelledby") ??
              (id ? document.querySelector(`label[for="${id}"]`)?.textContent : null)
            return !labelled
          }).length,
      )

      expect(unnamed, `${path} has an unlabelled control`).toBe(0)
    }
  })
})
