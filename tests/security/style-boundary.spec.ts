import { expect, test, type Page } from "@playwright/test"

import { signIn } from "../support/session-fixture"

/**
 * The Console serves `style-src 'self' 'nonce-…'` with no `unsafe-inline`.
 *
 * A nonce does not cover style *attributes*, and `style-src-attr` is unset, so
 * it falls back to `style-src` and every inline `style` attribute is refused.
 * That is a deliberate hardening decision, and it has a standing consequence
 * for this codebase: any component that positions or animates itself by
 * writing to `element.style` is silently broken here — the JavaScript runs,
 * the assignment is discarded, and the element renders in the wrong place or
 * never moves. The failure is invisible in unit tests and invisible in a
 * screenshot taken before the animation would have started.
 *
 * These two checks make it visible. The first proves the policy refuses
 * nothing on a real page load, so a component that quietly needs a style
 * attribute cannot land unnoticed. The second proves the document ships none,
 * so the refusal is genuinely absent rather than merely unobserved on the
 * paths a test happens to walk.
 */
const OWNED_JOURNEYS = [
  "/repositories",
  "/memory",
  "/processing",
  "/settings/members",
  "/settings/github",
  "/settings/usage",
] as const

type ViolationWindow = { cspViolations?: string[] }

/** Every CSP violation the page reports, whatever the directive. */
const violationsDuring = async (page: Page, journey: string): Promise<string[]> => {
  const violations: string[] = []

  await page.addInitScript(() => {
    const seen: string[] = []
    ;(globalThis as unknown as { cspViolations: string[] }).cspViolations = seen
    document.addEventListener("securitypolicyviolation", (event) => {
      seen.push(`${event.violatedDirective} blocked ${event.blockedURI}`)
    })
  })

  page.on("console", (message) => {
    if (/Content Security Policy/i.test(message.text())) violations.push(message.text())
  })

  await page.goto(journey)
  await page.waitForLoadState("networkidle")

  const reported = await page.evaluate(
    () => (globalThis as unknown as ViolationWindow).cspViolations ?? [],
  )
  return [...violations, ...reported]
}

test.describe("style boundary", () => {
  for (const journey of OWNED_JOURNEYS) {
    test(`${journey} raises no Content-Security-Policy violation`, async ({
      context,
      page,
    }) => {
      await signIn(context)
      const violations = await violationsDuring(page, journey)

      expect(violations, `CSP violations on ${journey}`).toEqual([])
    })
  }

  test("ships no inline style attribute the policy would refuse", async ({
    context,
    page,
  }) => {
    await signIn(context)

    for (const journey of OWNED_JOURNEYS) {
      await page.goto(journey)
      const styled = await page.evaluate(() =>
        [...document.querySelectorAll("[style]")]
          // `next-route-announcer` is injected by Next.js itself and is
          // outside this application's markup. It is named rather than
          // filtered by a pattern, so a second framework element appearing
          // later still fails here and gets looked at.
          .filter((element) => element.tagName.toLowerCase() !== "next-route-announcer")
          .map(
            (element) =>
              `${element.tagName.toLowerCase()}[style="${element.getAttribute("style")}"]`,
          ),
      )

      expect(styled, `inline style attributes on ${journey}`).toEqual([])
    }
  })
})
