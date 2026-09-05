import { expect, test } from "@playwright/test"

import { signIn } from "../support/session-fixture"

/**
 * Safe onboarding, acceptance row G-001.
 *
 * A design partner signs in, connects an existing GitHub App and sees the
 * repositories available to them. The row's point is what does not happen:
 * seeing a repository must start no work on it.
 */

test.describe("goal_safe_onboarding_without_ingestion", () => {
  test("a partner reaches their repositories without starting any ingestion", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "notConnected" })

    // Onboarding states the guarantee in the product's own words, which is the
    // clearest evidence this row can have: nothing is read until the partner
    // both connects and explicitly activates.
    await page.goto("/onboarding")
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
    const welcome = (await page.locator("body").innerText()).replaceAll(/\s+/g, " ")
    expect(welcome).toContain(
      "Nothing is read from your repositories until you connect",
    )
    expect(welcome).toContain("explicitly activate")

    // Connecting is a separate, deliberate act on its own surface, and the
    // page says plainly that reach is not entitlement.
    await page.goto("/settings/github")
    await expect(page.getByRole("button", { name: /connect/i }).first()).toBeVisible()
    expect((await page.locator("body").innerText()).replaceAll(/\s+/g, " ")).toContain(
      "Access is not entitlement",
    )

    // Once connected, repositories are visible and none of them is processing.
    await signIn(context, { scenario: "default" })
    await page.goto("/repositories")
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()

    // Repositories render as list items, which is what a reader and a screen
    // reader both traverse.
    expect(await page.getByRole("listitem").count()).toBeGreaterThan(0)

    // Nothing on this journey may claim work started. Activation is a separate,
    // explicit decision the partner has not taken yet.
    const body = (await page.locator("body").innerText()).toLowerCase()
    for (const claim of [
      "extracting",
      "ingesting",
      "processing started",
      "import started",
    ]) {
      expect(body.includes(claim), `the repository list claims "${claim}"`).toBe(false)
    }
  })

  test("visiting a repository starts nothing", async ({ context, page }) => {
    await signIn(context, { scenario: "default" })

    const mutations: string[] = []
    await page.route("**/functions/v1/**", async (route) => {
      const request = route.request()
      if (request.method() !== "GET")
        mutations.push(`${request.method()} ${request.url()}`)
      await route.continue()
    })

    await page.goto("/repositories")
    const first = page.getByRole("listitem").getByRole("link").first()
    if ((await first.count()) > 0) await first.click()
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()

    // Reading is a read. A journey that wrote while looking would be the defect
    // this row exists to prevent.
    expect(mutations).toEqual([])
  })

  test("processing shows no recovery control a customer could press", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "processingSettings" })
    await page.goto("/processing")
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()

    // PROC-002 was amended: the surface is read-only and the recovery
    // vocabulary does not exist.
    const recovery = await page
      .getByRole("button", { name: /retry|resume|replay|re-?run/i })
      .count()
    expect(recovery).toBe(0)
  })
})
