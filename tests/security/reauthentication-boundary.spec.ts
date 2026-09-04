import { expect, test, type Page } from "@playwright/test"

import { KNOWLEDGE, REPOSITORIES } from "../../tools/console-stub/fixtures.mjs"
import { signIn } from "../support/session-fixture"

/**
 * SEC-WEB-001 for the step-up ceremony, owned by EEM-9/02c.
 *
 * A challenge identifier, nonce or session token must never reach a URL, the
 * document, or browser-reachable storage.
 */

const IMPORTED = REPOSITORIES.activeSourceOnly
const importSurface = `/repositories/${IMPORTED}/import`
const detailOf = (id: string): string => `/memory/${id}`

const queryHasSecret = (url: string): boolean => {
  const params = new URL(url).searchParams
  for (const [name, value] of params.entries()) {
    if (/challenge|nonce|token|totp/i.test(name)) return true
    if (/challenge|nonce|token/i.test(value)) return true
  }
  return false
}

const browserReachableState = (page: Page) =>
  page.evaluate(() => ({
    cookie: document.cookie,
    localStorage: { ...localStorage },
    sessionStorage: { ...sessionStorage },
    globals: Object.keys(window).filter((key) =>
      /token|nonce|challenge|reauth/i.test(key),
    ),
  }))

test.describe("reauthentication boundary", () => {
  test("keeps challenge identifiers and tokens out of URLs and the document", async ({
    context,
    page,
  }) => {
    const { token } = await signIn(context, { scenario: "importStaleFreshness" })
    await page.goto(importSurface)

    await page.getByLabel("Cost budget in USD").fill("25")
    await page.getByRole("button", { name: "Approve extraction" }).click()

    await expect(page.getByTestId("reauth-ceremony")).toBeVisible()

    const url = page.url()
    expect(url).toContain("reauth=required")
    expect(queryHasSecret(url)).toBe(false)

    const document = await page.content()
    expect(document).not.toContain(token)
    expect(document).not.toMatch(/challengeId/i)
    expect(document).not.toMatch(/Bearer /)

    await page.locator("#reauth-totp").fill("123456")
    await page.getByTestId("reauth-complete").click()

    await expect(page.getByTestId("import-authorization")).toContainText(
      "Waiting for Evirion authorization",
    )

    const afterUrl = page.url()
    expect(queryHasSecret(afterUrl)).toBe(false)

    const afterDocument = await page.content()
    expect(afterDocument).not.toContain(token)
    expect(afterDocument).not.toMatch(/challengeId/i)

    const reachable = await browserReachableState(page)
    expect(reachable.cookie).not.toContain(token)
    expect(JSON.stringify(reachable.localStorage)).not.toMatch(/challengeId/i)
    expect(JSON.stringify(reachable.sessionStorage)).not.toMatch(/challengeId/i)
    expect(reachable.globals).toEqual([])
  })

  test("keeps step-up state out of the knowledge lifecycle surface as well", async ({
    context,
    page,
  }) => {
    const { token } = await signIn(context, { scenario: "memoryStaleFreshness" })
    await page.goto(detailOf(KNOWLEDGE.approved))

    await page.getByRole("button", { name: "Mark active" }).click()
    await expect(page.getByTestId("reauth-ceremony")).toBeVisible()

    expect(queryHasSecret(page.url())).toBe(false)
    expect(await page.content()).not.toContain(token)
  })
})
