import { expect, test } from "@playwright/test"

import { probe } from "../support/browser-fetch"

/**
 * SEC-WEB-008 contributor evidence for EEM-9/02 C01. The row's primary owner
 * is EEM-9/07 I01-C against a deployed environment; these are the local
 * prerequisites that must hold before that gate can run.
 */
test.describe("release surface", () => {
  test("exposes no diagnostic or internal documentation route", async ({ page }) => {
    await page.goto("/")

    const observed = await probe(page, [
      "/api/internal",
      "/_next/webpack-hmr",
      "/debug",
      "/status",
      "/health",
      "/metrics",
      "/openapi.json",
      "/docs",
      "/.env",
      "/.git/config",
    ])

    const reachable = observed
      .filter(({ status }) => ![401, 403, 404].includes(status))
      .map(({ path, status }) => `${path} returned ${status}`)

    expect(reachable).toEqual([])
  })

  test("loads the shell without a console error and without a source map", async ({
    page,
  }) => {
    const consoleErrors: string[] = []
    const sourceMapRequests: string[] = []

    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text())
    })
    page.on("request", (request) => {
      if (request.url().endsWith(".map")) sourceMapRequests.push(request.url())
    })

    await page.goto("/")
    await expect(
      page.getByRole("heading", { name: "Evirion Engineering Memory Console" }),
    ).toBeVisible()

    expect(consoleErrors).toEqual([])
    expect(sourceMapRequests).toEqual([])
  })

  test("serves no source map for any script the page loaded", async ({ page }) => {
    const scriptUrls: string[] = []
    page.on("response", (response) => {
      if (response.url().endsWith(".js")) scriptUrls.push(response.url())
    })

    await page.goto("/")
    expect(
      scriptUrls.length,
      "the shell must load at least one script",
    ).toBeGreaterThan(0)

    const observed = await probe(
      page,
      scriptUrls.map((url) => `${new URL(url).pathname}.map`),
    )
    const served = observed
      .filter(({ status }) => ![403, 404].includes(status))
      .map(({ path, status }) => `${path} returned ${status}`)

    expect(served).toEqual([])
  })

  test("puts no secret-shaped value in the served document", async ({ page }) => {
    await page.goto("/")
    const content = await page.content()

    for (const pattern of [
      /service_role/i,
      /SUPABASE_SERVICE_ROLE_KEY/,
      /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
      /postgres(?:ql)?:\/\//,
      /\bgh[pousr]_[A-Za-z0-9]{20,}/,
      /\bsk-[A-Za-z0-9]{20,}/,
      /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./,
    ]) {
      expect(content, `document matched ${pattern}`).not.toMatch(pattern)
    }
  })

  test("stores nothing in browser storage before authentication", async ({ page }) => {
    await page.goto("/")

    const storage = await page.evaluate(() => ({
      local: Object.entries({ ...window.localStorage }),
      session: Object.entries({ ...window.sessionStorage }),
      cookies: document.cookie,
    }))

    expect(storage.local).toEqual([])
    expect(storage.session).toEqual([])
    expect(storage.cookies).toBe("")
  })
})
