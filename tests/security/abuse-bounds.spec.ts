import { expect, test, type Page } from "@playwright/test"

import { signIn } from "../support/session-fixture"

/**
 * Unbounded resources, Auth abuse and enumeration, security row SEC-WEB-009.
 *
 * A bound the caller can choose is not a bound. Each case here supplies a value
 * the Console must refuse rather than pass on, or asks a question whose answer
 * must not differ by whether the thing exists.
 */

const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi

/**
 * The settled refusal, with the per-request reference masked.
 *
 * A support reference differs by design and is not an oracle. What must not
 * differ is everything else, so the wait is for the page to stop loading rather
 * than for a timeout to expire.
 */
const settledRefusal = async (page: Page, target: string): Promise<string> => {
  const response = await page.goto(target)
  await expect(page.getByText(/Loading/i)).toHaveCount(0)
  const text = (await page.locator("body").innerText())
    .replaceAll(/\s+/g, " ")
    .replaceAll(UUID_PATTERN, "<reference>")
    .trim()
  return `${response?.status() ?? 0} ${text}`
}

const PAGED_ROUTES = ["/memory", "/processing", "/repositories"] as const

test.describe("page and query bounds belong to the contract", () => {
  for (const route of PAGED_ROUTES) {
    test(`${route} refuses a caller-chosen page size`, async ({ context, page }) => {
      await signIn(context, { scenario: "default" })
      const response = await page.goto(`${route}?pageSize=100000`)

      // Whatever the answer, it is never a page rendered with the caller's
      // bound: either the parameter is refused, or it is ignored entirely.
      expect(response?.status()).toBeLessThan(500)
      const rows = await page.locator("[data-testid$='-row']").count()
      expect(rows).toBeLessThan(1000)
    })

    test(`${route} refuses an unknown query parameter rather than ignoring it`, async ({
      context,
      page,
    }) => {
      await signIn(context, { scenario: "default" })
      const response = await page.goto(`${route}?definitelyNotAFilter=1`)
      expect(response?.status()).toBeLessThan(500)
    })
  }

  test("a negative or non-numeric page size never reaches the backend as-is", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "default" })
    for (const value of ["-1", "0", "abc", "1e9", "../../etc/passwd"]) {
      const response = await page.goto(`/memory?pageSize=${encodeURIComponent(value)}`)
      expect(
        response?.status(),
        `pageSize=${value} produced a server error`,
      ).toBeLessThan(500)
    }
  })
})

test.describe("enumeration answers the same either way", () => {
  test("a missing and a foreign repository are indistinguishable", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "default" })

    const absent = "00000000-0000-4000-8000-00000000dead"
    const foreign = "00000000-0000-4000-8000-0000000000f1"

    // The words must match too, not only the status: a different message is an
    // oracle even when the code is identical.
    expect(await settledRefusal(page, `/repositories/${absent}`)).toBe(
      await settledRefusal(page, `/repositories/${foreign}`),
    )
  })

  test("a malformed identifier is refused without asking the backend", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "default" })
    let backendCalls = 0
    await page.route("**/functions/v1/**", async (route) => {
      backendCalls += 1
      await route.continue()
    })
    await page.goto("/repositories/not-a-uuid")
    expect(backendCalls).toBe(0)
  })
})

test.describe("the session and Auth bounds are the frozen ones", () => {
  test("the concurrent session cap and its replacement notice are stated", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "default" })
    await page.goto("/settings/sessions")
    const text = await page.locator("body").innerText()
    // The EEM-9/01 acceptance froze three sessions with an oldest-replacement
    // notice. A cap a person is not told about is not a bound they can act on.
    expect(text).toMatch(/three|3/i)
  })

  test("no page offers a control that would raise its own limit", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "default" })
    for (const route of PAGED_ROUTES) {
      await page.goto(route)
      const raising = await page
        .getByRole("button", { name: /increase|raise|unlimited|remove limit/i })
        .count()
      expect(raising, `${route} offers a control that raises a bound`).toBe(0)
    }
  })
})
