import { expect, test } from "@playwright/test"

/**
 * SEC-WEB-005, owned by EEM-9/02 C02.
 *
 * Every redirect the Console issues stays on the canonical origin. A target
 * supplied by the caller is never followed off-origin, and no credential
 * reaches a URL.
 */
test.describe("redirect and URL boundary", () => {
  test("sends an unauthenticated caller to sign-in and nowhere else", async ({
    page,
  }) => {
    for (const path of ["/onboarding", "/settings/sessions"]) {
      const response = await page.goto(path)

      expect(response?.url()).toContain("https://console.evirion.test:3443")
      expect(page.url()).toContain("/auth/sign-in")
    }
  })

  test("never follows a caller-supplied off-origin redirect target", async ({
    page,
  }) => {
    await page.goto("/auth/sign-in")
    const csrfToken = await page.locator('input[name="csrfToken"]').inputValue()

    const landing = await page.evaluate(
      async ([token]) => {
        const body = new URLSearchParams({
          csrfToken: token as string,
          email: "partner@example.test",
          code: "123456",
          next: "https://evil.example/steal",
        })
        const response = await fetch("/api/auth/verify-otp", {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: body.toString(),
        })
        return response.url
      },
      [csrfToken] as const,
    )

    expect(landing).not.toContain("evil.example")
    expect(landing).toContain("console.evirion.test")
  })

  test("puts no credential-shaped value in any URL the browser visited", async ({
    page,
  }) => {
    const visited: string[] = []
    page.on("request", (request) => visited.push(request.url()))

    await page.goto("/auth/sign-in")
    await page.goto("/auth/verify")
    await page.goto("/auth/recovery")

    for (const url of visited) {
      expect(url).not.toMatch(/[?&#](token|code|otp|access_token|refresh_token)=/i)
      expect(url).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}\./)
    }
  })

  test("keeps every navigation on the canonical origin", async ({ page }) => {
    await page.goto("/auth/sign-in")

    const targets = await page.evaluate(() =>
      [...document.querySelectorAll("a[href], form[action]")].map(
        (element) =>
          element.getAttribute("href") ?? element.getAttribute("action") ?? "",
      ),
    )

    for (const target of targets.filter(Boolean)) {
      const resolved = new URL(target, "https://console.evirion.test:3443")

      expect(resolved.origin).toBe("https://console.evirion.test:3443")
    }
  })

  test("exposes no external link with an unsafe scheme", async ({ page }) => {
    for (const path of ["/auth/sign-in", "/auth/verify", "/auth/recovery"]) {
      await page.goto(path)

      const schemes = await page.evaluate(() =>
        [...document.querySelectorAll("a[href]")].map(
          (element) => element.getAttribute("href") ?? "",
        ),
      )

      for (const href of schemes) {
        expect(href).not.toMatch(/^(javascript|data|vbscript|file):/i)
      }
    }
  })
})
