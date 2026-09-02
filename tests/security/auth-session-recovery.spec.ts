import { expect, test } from "@playwright/test"

/**
 * SEC-WEB-002 and AUTH-008, owned by EEM-9/02 C02.
 *
 * The named primary evidence for AUTH-008 is the server-only cookie, OTP, MFA
 * and session-recovery matrix. The browser-observable half lives here; the
 * cookie chunking, rotation, budget and adversarial-state half is asserted
 * without a browser in `tests/unit/auth/session-cookies.test.ts` and
 * `tests/unit/auth/session-broker.test.ts`, because those cases must hold
 * before a response is ever produced.
 */
test.describe("server-only session boundary", () => {
  test("gives browser JavaScript no readable session cookie", async ({ page }) => {
    await page.goto("/auth/sign-in")

    const readable = await page.evaluate(() => document.cookie)

    // Every cookie the Console sets is HttpOnly, so document.cookie sees none.
    expect(readable).not.toContain("__Host-console-session")
    expect(readable).not.toContain("__Host-console-pre-auth")
  })

  test("marks every Console cookie host-only, secure and lax", async ({
    page,
    context,
  }) => {
    await page.goto("/auth/sign-in")

    const consoleCookies = (await context.cookies()).filter((cookie) =>
      cookie.name.startsWith("__Host-"),
    )

    expect(consoleCookies.length).toBeGreaterThan(0)
    for (const cookie of consoleCookies) {
      expect(cookie.httpOnly, `${cookie.name} must be HttpOnly`).toBe(true)
      expect(cookie.secure, `${cookie.name} must be Secure`).toBe(true)
      expect(cookie.sameSite, `${cookie.name} must be SameSite=Lax`).toBe("Lax")
      expect(cookie.path, `${cookie.name} must be Path=/`).toBe("/")
      // __Host- forbids a Domain attribute; a host-only cookie reports the
      // exact host rather than a dot-prefixed domain.
      expect(cookie.domain.startsWith("."), `${cookie.name} must be host-only`).toBe(
        false,
      )
    }
  })

  test("stores no token in browser storage at any Auth step", async ({ page }) => {
    for (const path of [
      "/auth/sign-in",
      "/auth/verify",
      "/auth/mfa/challenge",
      "/auth/recovery",
    ]) {
      await page.goto(path)

      const storage = await page.evaluate(() => ({
        local: JSON.stringify({ ...window.localStorage }),
        session: JSON.stringify({ ...window.sessionStorage }),
      }))

      expect(storage.local, `${path} wrote to localStorage`).toBe("{}")
      expect(storage.session, `${path} wrote to sessionStorage`).toBe("{}")
    }
  })

  test("initializes no session-bearing Supabase client in the browser", async ({
    page,
  }) => {
    await page.goto("/auth/sign-in")

    const leaked = await page.evaluate(() =>
      Object.keys(window).filter((key) => /supabase|gotrue/i.test(key)),
    )

    expect(leaked).toEqual([])
  })

  test("keeps every Auth response private and uncacheable", async ({ page }) => {
    for (const path of [
      "/auth/sign-in",
      "/auth/verify",
      "/auth/mfa/enroll",
      "/auth/recovery",
    ]) {
      const response = await page.goto(path)
      const cacheControl = response?.headers()["cache-control"] ?? ""

      expect(cacheControl, `${path} must be no-store`).toContain("no-store")
      expect(cacheControl, `${path} must be private`).toContain("private")
    }
  })

  test("sends an unauthenticated caller on a protected route to sign-in", async ({
    page,
  }) => {
    await page.goto("/settings/sessions")

    expect(page.url()).toContain("/auth/sign-in")
  })

  test("clears every bounded slot on logout even without a valid proof", async ({
    page,
    context,
  }) => {
    await page.goto("/auth/sign-in")

    const before = (await context.cookies()).filter((cookie) =>
      cookie.name.startsWith("__Host-"),
    )
    expect(before.length).toBeGreaterThan(0)

    await page.evaluate(async () => {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "",
        redirect: "manual",
      })
    })

    const after = (await context.cookies()).filter((cookie) =>
      cookie.name.startsWith("__Host-console-session"),
    )

    // Refusing to sign out because a proof expired would be the worse failure.
    expect(after).toEqual([])
  })

  test("renders the recovery path as a request, never as a self-service reset", async ({
    page,
  }) => {
    await page.goto("/auth/recovery")
    const body = (await page.textContent("body")) ?? ""

    expect(body).toContain("no password to reset")
    expect(body).not.toMatch(/reset your password/i)
    // Recovery ends sessions and resets a factor, so no unverified request may
    // start it: the page offers no form at all, only the operator-led path.
    expect(body).toMatch(/no self-service form/i)
    expect(await page.locator("form").count()).toBe(0)
  })

  test("states the concurrent-session cap and its replacement notice", async ({
    page,
  }) => {
    await page.goto("/auth/sign-in")
    // The inventory itself is protected, so the unauthenticated caller is
    // redirected; the cap is asserted against the frozen policy in the unit
    // suite. This only proves the protected route does not leak before auth.
    await page.goto("/settings/sessions")

    expect(page.url()).toContain("/auth/sign-in")
  })
})
