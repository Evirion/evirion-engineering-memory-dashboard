import {
  expect,
  test,
  type APIRequestContext,
  type BrowserContext,
} from "@playwright/test"

import { signIn } from "../support/session-fixture"

/**
 * The browser boundary matrix, acceptance row NFR-SEC-003.
 *
 * `csrf-origin.spec.ts` owns the proof itself: missing, forged, replayed across
 * browsers, wrong content type, safe method on a mutation route. This file owns
 * what surrounds it — the request headers a proxy is supposed to have
 * normalised, and the state a warm server instance must not carry between
 * callers.
 *
 * Every case drives a real mutation route with a real session, because a
 * refusal proved against an unauthenticated caller proves only the session
 * check.
 */

// page.request runs in Node, where --host-resolver-rules does not apply and
// console.evirion.test has no DNS record. The leaf covers the loopback address,
// and the edge rewrites Host to the canonical origin anyway, so the application
// sees exactly what it sees from the browser.
/**
 * An API context carrying the browser's cookies.
 *
 * These probes set Origin and forwarding headers, which a browser refuses to
 * let script control, so they cannot run through page.evaluate. Playwright's
 * request context runs in Node, where the local leaf is not in the trust store
 * and console.evirion.test does not resolve; both are readiness concerns rather
 * than the property under test, so the address is the loopback one and
 * verification is relaxed for these calls alone. The browser gate keeps
 * ignoreHTTPSErrors off, which is where the cookie contract is proved.
 */
const apiAs = async (
  context: BrowserContext,
  playwright: {
    request: { newContext: (options: object) => Promise<APIRequestContext> }
  },
): Promise<APIRequestContext> =>
  playwright.request.newContext({
    ignoreHTTPSErrors: true,
    storageState: await context.storageState(),
  })

const MUTATION_ROUTE = "https://127.0.0.1:3443/api/repositories/activate"
const ORIGIN = "https://console.evirion.test:3443"

/**
 * A refused form action redirects to sign-in rather than returning 4xx, so the
 * property is where the caller is sent: to authenticate again, never back to
 * the resource as though the mutation had been applied.
 */
const expectRefused = (
  status: number,
  location: string | undefined,
  reason: string,
): void => {
  expect(status >= 400 || status === 303, `${reason} was not refused (${status})`).toBe(
    true,
  )
  if (status === 303) {
    expect(location ?? "", reason).toContain("/auth/sign-in")
  }
}

test.describe("otp_http_only_session_csrf_csp_cache_xss_abuse_dast_matrix", () => {
  test("a sibling subdomain is not this origin", async ({
    context,
    page,
    playwright,
  }) => {
    await signIn(context, { scenario: "default" })
    await page.goto("/repositories")
    const api = await apiAs(context, playwright)

    const response = await api.post(MUTATION_ROUTE, {
      headers: {
        origin: "https://evil.evirion.test:3443",
        "content-type": "application/x-www-form-urlencoded",
      },
      form: { repositoryId: "00000000-0000-4000-8000-0000000000a2" },
      maxRedirects: 0,
    })
    expectRefused(
      response.status(),
      response.headers()["location"],
      "a sibling subdomain",
    )
  })

  test("a null or malformed Origin is refused rather than treated as absent", async ({
    context,
    page,
    playwright,
  }) => {
    await signIn(context, { scenario: "default" })
    await page.goto("/repositories")
    const api = await apiAs(context, playwright)

    for (const origin of [
      "null",
      "",
      "not-a-url",
      "https://",
      "http://console.evirion.test:3443",
    ]) {
      const response = await api.post(MUTATION_ROUTE, {
        headers: { origin, "content-type": "application/x-www-form-urlencoded" },
        form: { repositoryId: "00000000-0000-4000-8000-0000000000a2" },
        maxRedirects: 0,
      })
      expectRefused(
        response.status(),
        response.headers()["location"],
        `origin ${JSON.stringify(origin)}`,
      )
    }
  })

  test("a caller cannot forge the headers the trusted proxy sets", async ({
    context,
    page,
    playwright,
  }) => {
    await signIn(context, { scenario: "default" })
    await page.goto("/repositories")
    const api = await apiAs(context, playwright)

    // The edge strips inbound forwarding headers and sets canonical ones. A
    // caller who could supply them would choose its own apparent origin.
    for (const headers of [
      { "x-forwarded-host": "evil.example.com" },
      { "x-forwarded-proto": "http" },
      { forwarded: 'for="1.2.3.4";host="evil.example.com";proto=https' },
      { "x-forwarded-for": "127.0.0.1, 10.0.0.1, 10.0.0.2" },
    ]) {
      const response = await api.post(MUTATION_ROUTE, {
        headers: {
          origin: ORIGIN,
          "content-type": "application/x-www-form-urlencoded",
          ...headers,
        },
        form: { repositoryId: "00000000-0000-4000-8000-0000000000a2" },
        maxRedirects: 0,
      })
      // Either refused, or accepted having ignored the forged value entirely.
      // What must never happen is the forged host deciding the answer.
      const body = await response.text()
      expect(
        body.includes("evil.example.com"),
        `${JSON.stringify(headers)} reached the response`,
      ).toBe(false)
    }
  })

  test("a proof lifted before logout is refused after it", async ({
    context,
    page,
    playwright,
  }) => {
    await signIn(context, { scenario: "default" })
    await page.goto("/repositories")
    const api = await apiAs(context, playwright)

    await page.request
      .post("https://127.0.0.1:3443/api/auth/logout", { maxRedirects: 0 })
      .catch(() => undefined)

    const response = await api.post(MUTATION_ROUTE, {
      headers: { origin: ORIGIN, "content-type": "application/x-www-form-urlencoded" },
      form: { repositoryId: "00000000-0000-4000-8000-0000000000a2" },
      maxRedirects: 0,
    })
    expectRefused(
      response.status(),
      response.headers()["location"],
      "a stale post-logout proof",
    )
  })
})

test.describe("a warm instance carries nothing between callers", () => {
  test("a second caller never sees the first caller's document", async ({
    browser,
  }) => {
    const owner = await browser.newContext()
    const viewer = await browser.newContext()
    try {
      await signIn(owner, { principal: "console-stub-owner", scenario: "default" })
      await signIn(viewer, { principal: "console-stub-viewer", scenario: "default" })

      const ownerPage = await owner.newPage()
      const viewerPage = await viewer.newPage()
      await ownerPage.goto("/settings/members")
      await viewerPage.goto("/settings/members")

      const ownerText = await ownerPage.locator("body").innerText()
      const viewerText = await viewerPage.locator("body").innerText()

      // The owner sees controls the viewer must not, so identical documents
      // would mean one caller was served the other's render.
      expect(ownerText).not.toBe(viewerText)
      expect(viewerText).not.toContain("console-stub-owner")
    } finally {
      await owner.close()
      await viewer.close()
    }
  })

  test("no authenticated response may be stored by a shared cache", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "default" })
    for (const route of ["/repositories", "/memory", "/settings/members"]) {
      const response = await page.goto(route)
      const cacheControl = response?.headers()["cache-control"] ?? ""
      expect(cacheControl, `${route} is cacheable`).toMatch(/no-store/)
    }
  })
})
