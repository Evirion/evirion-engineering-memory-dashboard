import { expect, test } from "@playwright/test"

import { probe, probeOne } from "../support/browser-fetch"

/**
 * SEC-WEB-006, owned by EEM-9/02 C01.
 *
 * These run against the pinned HTTPS origin behind the local trusted edge, so
 * the header and cache behaviour observed here is the behaviour staging will
 * show. EEM-9/02 C02 extends this file with the session and pre-auth cases.
 */
test.describe("security headers and cache isolation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/")
  })

  test("serves a per-response nonce CSP with no unsafe directive", async ({ page }) => {
    const policy = (await probeOne(page, "/")).headers["content-security-policy"]

    expect(policy).toBeTruthy()
    expect(policy).toContain("'strict-dynamic'")
    expect(policy).toContain("frame-ancestors 'none'")
    expect(policy).toContain("base-uri 'none'")
    expect(policy).toContain("object-src 'none'")
    expect(policy).not.toContain("unsafe-inline")
    expect(policy).not.toContain("unsafe-eval")
    expect(policy).toMatch(/script-src [^;]*'nonce-[A-Za-z0-9+/=]+'/)
  })

  test("mints a unique nonce per response across a warm instance", async ({ page }) => {
    const responses = await probe(
      page,
      Array.from({ length: 8 }, () => "/"),
    )
    const nonces = responses.map(
      (response) =>
        /'nonce-([A-Za-z0-9+/=]+)'/.exec(
          response.headers["content-security-policy"] ?? "",
        )?.[1],
    )

    expect(nonces.every(Boolean), "every response must carry a nonce").toBe(true)
    // A module-scope nonce would repeat here once the instance is warm.
    expect(new Set(nonces).size).toBe(8)
  })

  test("binds the enforced header nonce to the nonce the document used", async ({
    page,
  }) => {
    const response = await page.goto("/")
    const policy = response?.headers()["content-security-policy"] ?? ""
    const headerNonce = /'nonce-([A-Za-z0-9+/=]+)'/.exec(policy)?.[1]

    expect(headerNonce).toBeTruthy()

    const documentNonces = await page.evaluate(() =>
      [...document.querySelectorAll("script[nonce], style[nonce]")]
        .map(
          (element) =>
            (element as HTMLElement).nonce ?? element.getAttribute("nonce") ?? "",
        )
        .filter(Boolean),
    )

    for (const nonce of documentNonces) {
      expect(nonce).toBe(headerNonce)
    }
  })

  test("sends the full transport and isolation header set", async ({ page }) => {
    const { headers } = await probeOne(page, "/")

    expect(headers["strict-transport-security"]).toContain("max-age=63072000")
    expect(headers["x-content-type-options"]).toBe("nosniff")
    expect(headers["x-frame-options"]).toBe("DENY")
    expect(headers["referrer-policy"]).toBe("no-referrer")
    expect(headers["permissions-policy"]).toContain("camera=()")
    expect(headers["cross-origin-opener-policy"]).toBe("same-origin")
  })

  test("keeps every response out of a shared cache", async ({ page }) => {
    const { headers } = await probeOne(page, "/")

    expect(headers["cache-control"]).toContain("no-store")
    expect(headers["cache-control"]).toContain("private")
  })

  test("advertises no framework version", async ({ page }) => {
    expect((await probeOne(page, "/")).headers["x-powered-by"]).toBeUndefined()
  })

  test("preserves the pinned HTTPS origin and its secure context", async ({ page }) => {
    expect(page.url().startsWith("https://console.evirion.test:3443")).toBe(true)
    expect(await page.evaluate(() => window.isSecureContext)).toBe(true)
  })
})
