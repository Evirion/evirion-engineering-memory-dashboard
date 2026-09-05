import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { expect, test } from "@playwright/test"

import { collectSourceFiles, repositoryRoot } from "../support/source-tree"
import { signIn } from "../support/session-fixture"

/**
 * The Console half of the paid boundary, ASVS V10 business logic.
 *
 * The backend proves that nothing a customer can reach authorizes paid work.
 * This proves the Console never offers the attempt: no control, no route, no
 * form field, and no state derived in the browser that the backend is supposed
 * to own.
 */

const PAID_CONTROL_NAMES =
  /authorize (paid|spend|model)|approve (payment|spend)|grant authorization|raise budget|increase budget/i

const CUSTOMER_ROUTES = [
  "/repositories",
  "/memory",
  "/processing",
  "/settings/github",
  "/settings/members",
  "/settings/usage",
] as const

test.describe("no customer surface authorizes paid work", () => {
  for (const route of CUSTOMER_ROUTES) {
    test(`${route} offers no paid-authorize control`, async ({ context, page }) => {
      await signIn(context, { scenario: "default" })
      await page.goto(route)
      expect(await page.getByRole("button", { name: PAID_CONTROL_NAMES }).count()).toBe(
        0,
      )
      expect(await page.getByRole("link", { name: PAID_CONTROL_NAMES }).count()).toBe(0)
    })
  }

  test("no route exists that would carry such a command", () => {
    const offenders = collectSourceFiles("src")
      .filter((path) => path.includes("/api/"))
      .filter((path) => /paid|authoriz|budget/i.test(path))
    // Budget and paid authorization are operator surfaces. A Console route
    // named for one would be the first step toward serving it.
    expect(offenders).toEqual([])
  })

  test("the browser never decides entitlement, consent or budget", () => {
    const offenders: string[] = []
    for (const path of collectSourceFiles("src").filter((file) =>
      file.endsWith(".tsx"),
    )) {
      const source = readFileSync(fileURLToPath(new URL(path, repositoryRoot)), "utf8")
      if (!source.includes('"use client"')) continue
      for (const decision of [
        "canAuthorizePaid",
        "isEntitled =",
        "hasConsent =",
        "budgetRemaining =",
      ]) {
        if (source.includes(decision)) offenders.push(`${path}: ${decision}`)
      }
    }
    expect(offenders).toEqual([])
  })
})

test.describe("visibility is never authority", () => {
  test("a viewer sees no mutating control on any owned surface", async ({
    context,
    page,
  }) => {
    await signIn(context, { principal: "console-stub-viewer", scenario: "default" })
    for (const route of CUSTOMER_ROUTES) {
      await page.goto(route)
      const mutating = await page
        .getByRole("button", {
          name: /activate|disable|approve|reject|invite|remove|request/i,
        })
        .count()
      expect(mutating, `${route} offers a viewer a mutating control`).toBe(0)
    }
  })

  test("a state the backend owns is rendered, never computed", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "default" })
    await page.goto("/settings/usage")
    // Usage is a backend projection. A Console that summed it would drift from
    // the ledger the moment either changed.
    const body = await page.locator("body").innerText()
    expect(body.length).toBeGreaterThan(0)
    const computed = await page.evaluate(() =>
      Object.keys(globalThis).some((key) =>
        /usageTotal|costTotal|budgetLeft/i.test(key),
      ),
    )
    expect(computed).toBe(false)
  })
})
