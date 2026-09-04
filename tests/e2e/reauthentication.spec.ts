import { expect, test, type Page } from "@playwright/test"

import { KNOWLEDGE, REPOSITORIES } from "../../tools/console-stub/fixtures.mjs"
import { signIn } from "../support/session-fixture"

/**
 * Step-up reauthentication and return, owned by EEM-9/02c.
 *
 * The mechanism is shared across gated mutations. These journeys prove the
 * return path and recoverable outcomes on the two surfaces shipped before
 * EEM-9/06.
 */

const IMPORTED = REPOSITORIES.activeSourceOnly
const importSurface = `/repositories/${IMPORTED}/import`
const detailOf = (id: string): string => `/memory/${id}`

const STUB_TOTP = "123456"

const completeStepUp = async (page: Page): Promise<void> => {
  await expect(page.getByTestId("reauth-ceremony")).toBeVisible()
  await page.locator("#reauth-totp").fill(STUB_TOTP)
  await page.getByTestId("reauth-complete").click()
}

test.describe("precondition notice", () => {
  test("states the published requirement on import approval", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "importAwaitingApproval" })
    await page.goto(importSurface)

    await expect(page.getByTestId("import-reauth-notice")).toBeVisible()
    await expect(page.getByTestId("import-reauth-notice")).toContainText(
      "confirming your identity again",
    )
  })

  test("states the published requirement on lifecycle activation", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memory" })
    await page.goto(detailOf(KNOWLEDGE.approved))

    await expect(page.getByTestId("lifecycle-reauth-notice")).toBeVisible()
  })
})

test.describe("other sessions warning", () => {
  test("offers the revocation notice before the ceremony completes", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "importStaleFreshness" })
    await page.goto(importSurface)

    await page.getByLabel("Cost budget in USD").fill("25")
    await page.getByRole("button", { name: "Approve extraction" }).click()

    await expect(page.getByTestId("reauth-ceremony")).toBeVisible()
    await expect(page.getByTestId("reauth-revokes-other-sessions")).toBeVisible()
  })
})

test.describe("import return path", () => {
  test("resumes approval with the budget the customer entered", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "importStaleFreshness" })
    await page.goto(importSurface)

    await page.getByLabel("Cost budget in USD").fill("25")
    await page.getByRole("button", { name: "Approve extraction" }).click()

    await completeStepUp(page)

    await expect(page.getByTestId("import-authorization")).toContainText(
      "Waiting for Evirion authorization",
    )
    await expect(page.getByTestId("import-cost")).toContainText("USD 25.000000")
    await expect(page.getByTestId("reauth-ceremony")).toHaveCount(0)
  })

  test("treats a backend refusal like a lapsed window before submit", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "importStaleFreshness" })
    await page.goto(importSurface)

    const form = page.locator('form[action="/api/imports/approve"]')
    const destination = await page.evaluate(
      async (payload: Record<string, string>) => {
        const response = await fetch("/api/imports/approve", {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams(payload).toString(),
        })
        return response.url
      },
      {
        csrfToken: await form.locator('input[name="csrfToken"]').inputValue(),
        repositoryId: await form.locator('input[name="repositoryId"]').inputValue(),
        idempotencyKey: await form.locator('input[name="idempotencyKey"]').inputValue(),
        importId: await form.locator('input[name="importId"]').inputValue(),
        expectedStatus: await form.locator('input[name="expectedStatus"]').inputValue(),
        costBudgetUsd: "25",
      },
    )

    expect(destination).toContain("reauth=required")
    expect(destination).not.toMatch(/challenge/i)

    const path = new URL(destination).pathname + new URL(destination).search
    await page.goto(path)

    await expect(page.getByTestId("reauth-ceremony")).toBeVisible()
    await expect(page.getByTestId("reauth-revokes-other-sessions")).toBeVisible()
  })
})

test.describe("knowledge return path", () => {
  test("resumes activation after step-up", async ({ context, page }) => {
    await signIn(context, { scenario: "memoryStaleFreshness" })
    await page.goto(detailOf(KNOWLEDGE.approved))

    await page.getByRole("button", { name: "Mark active" }).click()
    await completeStepUp(page)

    await expect(
      page.getByTestId("knowledge-outcome-KNOWLEDGE_MARKED_ACTIVE"),
    ).toBeVisible()
    await expect(page.getByTestId("knowledge-states")).toContainText("Active")
  })
})

test.describe("wrong authenticator code", () => {
  test("keeps the ceremony recoverable with explicit feedback", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "importStaleFreshness" })
    await page.goto(importSurface)

    await page.getByLabel("Cost budget in USD").fill("25")
    await page.getByRole("button", { name: "Approve extraction" }).click()
    await expect(page.getByTestId("reauth-ceremony")).toBeVisible()

    await page.locator("#reauth-totp").fill("000000")
    await page.getByTestId("reauth-complete").click()

    await expect(page.getByTestId("reauth-ceremony-feedback")).toContainText(
      "did not match",
    )
    await expect(page.getByTestId("reauth-ceremony")).toBeVisible()
  })
})

test.describe("absent freshness field", () => {
  test("treats a missing projection like a lapsed window", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "importAbsentFreshnessField" })
    await page.goto(importSurface)

    await page.getByLabel("Cost budget in USD").fill("25")
    await page.getByRole("button", { name: "Approve extraction" }).click()

    await expect(page.getByTestId("reauth-ceremony")).toBeVisible()
  })
})

test.describe("invalidated challenge", () => {
  test("renders a recoverable outcome and allows a fresh confirmation", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "reauthInvalidateChallenge" })
    await page.goto(importSurface)

    await page.getByLabel("Cost budget in USD").fill("25")
    await page.getByRole("button", { name: "Approve extraction" }).click()

    await completeStepUp(page)

    await expect(page.getByTestId("reauth-challenge-invalidated")).toBeVisible()
    await expect(page.getByRole("heading", { name: /sign in/i })).toHaveCount(0)

    await page.getByTestId("reauth-issue").click()
    await completeStepUp(page)

    await expect(page.getByTestId("import-authorization")).toContainText(
      "Waiting for Evirion authorization",
    )
  })
})
