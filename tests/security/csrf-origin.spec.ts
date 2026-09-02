import { type BrowserContext, type Page, expect, test } from "@playwright/test"

/**
 * SEC-WEB-003, owned by EEM-9/02 C02.
 *
 * Every case here must be refused before any Auth, bootstrap or domain
 * effect, and must leave no session cookie behind. Idempotency is a separate
 * control: nothing in this file relies on it.
 */
/**
 * A browser cannot read the `Location` of a `redirect: "manual"` response:
 * the Fetch specification returns an opaque redirect with no headers. The
 * redirect is followed instead and the landing URL is asserted, which is the
 * observable property that matters anyway.
 */
type PostResult = { status: number; url: string }

const postFromPage = async (
  page: Page,
  path: string,
  { body, headers }: { body: Record<string, string>; headers?: Record<string, string> },
): Promise<PostResult> =>
  page.evaluate(
    async ([target, payload, extraHeaders]) => {
      const form = new URLSearchParams(payload as Record<string, string>)
      const response = await fetch(target as string, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          ...(extraHeaders as Record<string, string>),
        },
        body: form.toString(),
        cache: "no-store",
      })
      return { status: response.status, url: response.url }
    },
    [path, body, headers ?? {}] as const,
  )

const sessionCookieNames = async (context: BrowserContext) =>
  (await context.cookies())
    .map((cookie) => cookie.name)
    .filter((name) => name.includes("session"))

test.describe("CSRF and origin boundary", () => {
  test("refuses a post carrying no CSRF proof and establishes no session", async ({
    page,
    context,
  }) => {
    await page.goto("/auth/sign-in")

    const result = await postFromPage(page, "/api/auth/verify-otp", {
      body: { email: "partner@example.test", code: "123456" },
    })

    expect(result.url).toContain("/auth/sign-in")
    expect(await sessionCookieNames(context)).toEqual([])
  })

  test("refuses a forged CSRF proof", async ({ page, context }) => {
    await page.goto("/auth/sign-in")

    const result = await postFromPage(page, "/api/auth/verify-otp", {
      body: {
        csrfToken: "forged.token",
        email: "partner@example.test",
        code: "123456",
      },
    })

    expect(result.url).toContain("/auth/sign-in")
    expect(await sessionCookieNames(context)).toEqual([])
  })

  test("refuses a proof lifted from one browser and replayed by another", async ({
    page,
    browser,
  }) => {
    await page.goto("/auth/sign-in")
    const stolen = await page.locator('input[name="csrfToken"]').inputValue()

    expect(stolen).not.toBe("")

    // A second context has no matching cookie copy, so the double-submit fails
    // even though the signature itself is genuine.
    const attacker = await browser.newContext()
    const attackerPage = await attacker.newPage()
    await attackerPage.goto("/auth/sign-in")

    const result = await postFromPage(attackerPage, "/api/auth/verify-otp", {
      body: { csrfToken: stolen, email: "victim@example.test", code: "123456" },
    })

    expect(result.url).toContain("/auth/sign-in")
    expect(await sessionCookieNames(attacker)).toEqual([])
    await attacker.close()
  })

  test.describe("cross-site and malformed origins", () => {
    for (const [label, headers] of [
      ["a cross-site origin", { origin: "https://evil.example" }],
      ["a null origin", { origin: "null" }],
      ["a sibling subdomain", { origin: `https://evil.console.evirion.test:3443` }],
      ["a forged forwarding header", { "x-forwarded-host": "evil.example" }],
    ] as const) {
      test(`refuses ${label}`, async ({ page, context }) => {
        await page.goto("/auth/sign-in")
        const csrfToken = await page.locator('input[name="csrfToken"]').inputValue()

        const result = await postFromPage(page, "/api/auth/verify-otp", {
          body: { csrfToken, email: "partner@example.test", code: "123456" },
          headers,
        })

        expect(result.url).toContain("/auth/sign-in")
        expect(await sessionCookieNames(context)).toEqual([])
      })
    }
  })

  test("refuses a content type outside the allowlist", async ({ page, context }) => {
    await page.goto("/auth/sign-in")
    const csrfToken = await page.locator('input[name="csrfToken"]').inputValue()

    const result = await page.evaluate(
      async ([token]) => {
        const response = await fetch("/api/auth/verify-otp", {
          method: "POST",
          headers: { "content-type": "text/plain" },
          body: `csrfToken=${token}`,
        })
        return { url: response.url }
      },
      [csrfToken] as const,
    )

    expect(result.url).toContain("/auth/sign-in")
    expect(await sessionCookieNames(context)).toEqual([])
  })

  test("refuses a safe method on a mutation route", async ({ page }) => {
    await page.goto("/auth/sign-in")

    const status = await page.evaluate(async () => {
      const response = await fetch("/api/auth/verify-otp", { method: "GET" })
      return response.status
    })

    // Next returns 405 for a method the route handler does not export.
    expect([405, 404]).toContain(status)
  })

  test("issues a distinct pre-auth proof per browsing context", async ({
    page,
    browser,
  }) => {
    await page.goto("/auth/sign-in")
    const first = await page.locator('input[name="csrfToken"]').inputValue()

    const second = await browser.newContext()
    const secondPage = await second.newPage()
    await secondPage.goto("/auth/sign-in")
    const other = await secondPage.locator('input[name="csrfToken"]').inputValue()

    expect(first).not.toBe(other)
    await second.close()
  })
})
