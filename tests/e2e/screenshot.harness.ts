import { test } from "@playwright/test"

import { signIn } from "../support/session-fixture"

/**
 * Not a gate. A visual capture harness for reviewing the Console during
 * design work, kept out of the default run by its `@visual` tag.
 *
 *   pnpm exec playwright test tests/e2e/screenshot.spec.ts --grep @visual
 */
const SURFACES = [
  ["repositories", "/repositories", "default"],
  ["memory", "/memory", "memory"],
  ["processing", "/processing", "processingSettings"],
  ["members", "/settings/members", "processingSettings"],
  ["github", "/settings/github", "default"],
  ["usage", "/settings/usage", "processingSettings"],
] as const

for (const [name, route, scenario] of SURFACES) {
  test(`@visual ${name}`, async ({ context, page }) => {
    await signIn(context, { scenario })
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto(route)
    await page.waitForLoadState("networkidle")
    await page.screenshot({ path: `test-results/visual/${name}.png`, fullPage: true })
  })
}

test("@visual memory-mobile", async ({ context, page }) => {
  await signIn(context, { scenario: "memory" })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/memory")
  await page.waitForLoadState("networkidle")
  await page.screenshot({
    path: "test-results/visual/memory-mobile.png",
    fullPage: true,
  })
})

/** Signed out, so no session fixture. */
test("@visual sign-in", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 })
  await page.goto("/auth/sign-in")
  await page.waitForLoadState("networkidle")
  await page.screenshot({ path: "test-results/visual/sign-in.png", fullPage: true })
})

/** The submit control mid-flight, with the response held open. */
test("@visual sign-in-pending", async ({ page }) => {
  await page.route("**/api/auth/request-otp", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 8000))
    await route.fulfill({ status: 204 })
  })
  await page.setViewportSize({ width: 1024, height: 620 })
  await page.goto("/auth/sign-in")
  await page.getByLabel("Email address").fill("partner@northwind.example")
  await page.waitForLoadState("networkidle")
  await page.getByRole("button", { name: "Send code" }).click()
  await page.waitForTimeout(600)
  await page.screenshot({ path: "test-results/visual/sign-in-pending.png" })
})

/** The processing table, where the progress tone now turns. */
test("@visual processing-running", async ({ context, page }) => {
  await signIn(context, { scenario: "processingSettings" })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto("/processing")
  await page.waitForLoadState("networkidle")
  await page.screenshot({
    path: "test-results/visual/processing-running.png",
    fullPage: true,
  })
})
