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

/**
 * SEC-WEB-008 expansion, added by EEM-9/07.
 *
 * The cases above prove the shell is clean. These prove the release is: no
 * privileged value reaches the browser under any name, no diagnostic surface
 * answers, and nothing a production build emits describes its own internals.
 */
test.describe("the release exposes no privileged surface", () => {
  test("no browser bundle carries a privileged value", async ({ page }) => {
    await page.goto("/auth/sign-in")
    const scripts = await page.evaluate(() =>
      [...document.querySelectorAll("script[src]")].map((element) =>
        element.getAttribute("src"),
      ),
    )
    // Fetched from inside the browser: page.request runs in Node, where the
    // pinned hostname has no DNS record.
    for (const source of scripts) {
      if (source === null) continue
      const body = await page.evaluate(
        async (target) => (await fetch(target)).text(),
        source,
      )
      for (const forbidden of [
        "service_role",
        "sb_secret",
        "SUPABASE_SERVICE",
        "BEGIN RSA PRIVATE KEY",
        "postgresql://",
        "CONSOLE_CSRF_SIGNING_KEY",
        "CONSOLE_BFF_PROOF_SIGNING_KEY",
      ]) {
        expect(body.includes(forbidden), `${source} carries ${forbidden}`).toBe(false)
      }
    }
  })

  test("no diagnostic or profiling route answers", async ({ page }) => {
    // A relative fetch needs a document origin to resolve against.
    await page.goto("/auth/sign-in")
    const statuses = await page.evaluate(
      async (routes) => {
        const seen: Record<string, number> = {}
        for (const route of routes) {
          const response = await fetch(route, { redirect: "manual" })
          seen[route] = response.status
        }
        return seen
      },
      [
        "/.env",
        "/api/debug",
        "/api/health/detail",
        "/_next/trace",
        "/__nextjs_original-stack-frame",
        "/api/openapi",
        "/api/docs",
      ],
    )
    for (const [route, status] of Object.entries(statuses)) {
      // An opaque redirect reports 0 to script; anything that is not a refusal
      // or a redirect means the surface answered.
      expect(
        [0, 303, 307, 401, 403, 404, 405].includes(status),
        `${route} answered ${status}`,
      ).toBe(true)
    }
  })

  test("the served document names no internal host or path", async ({ page }) => {
    await page.goto("/auth/sign-in")
    const content = await page.content()
    for (const marker of [
      "127.0.0.1:54321",
      "/functions/v1/",
      "supabase.co",
      "/Users/",
    ]) {
      expect(content.includes(marker), `the document names ${marker}`).toBe(false)
    }
  })
})
