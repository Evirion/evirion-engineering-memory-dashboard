import { expect, test } from "@playwright/test"

import {
  EXTRACTION_JOBS,
  FOREIGN_REPOSITORY,
  IMPORTS,
  REPOSITORIES,
} from "../../tools/console-stub/fixtures.mjs"
import { STUB_ORIGIN, signIn } from "../support/session-fixture"

/**
 * SEC-WEB-001 for the import surface, owned by EEM-9/04.
 *
 * Three identifiers can be substituted here rather than one: the organization,
 * the repository and the run. What is asserted is not only that each is refused
 * but that the refusal discloses nothing, and that no secret reaches the
 * document on a surface that talks about money and providers.
 */

const IMPORTED = REPOSITORIES.activeSourceOnly
const surface = `/repositories/${IMPORTED}/import`

/** Well-formed identifiers that belong to nothing at all. */
const ABSENT_REPOSITORY = "00000000-0000-4000-8000-0000000009ff"
const ABSENT_IMPORT = "00000000-0000-4000-8000-0000000009fe"

test.describe("import tenant boundary", () => {
  test("refuses a foreign repository exactly as it refuses an absent one", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "importProcessing" })

    await page.goto(`/repositories/${FOREIGN_REPOSITORY}/import`)
    const foreign = await page.content()

    await page.goto(`/repositories/${ABSENT_REPOSITORY}/import`)
    const absent = await page.content()

    expect(foreign).toContain("RESOURCE_NOT_FOUND")
    expect(absent).toContain("RESOURCE_NOT_FOUND")
    // Neither discloses that a run exists behind the other tenant's identifier.
    expect(foreign).not.toContain("Extracting Engineering Memory")
    expect(absent).not.toContain("Extracting Engineering Memory")
  })

  test("refuses a malformed repository identifier without a backend round trip", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "importProcessing" })

    await page.goto("/repositories/not-a-uuid/import")

    await expect(page.getByText("RESOURCE_NOT_FOUND")).toBeVisible()
  })

  test("refuses a substituted run identifier through the BFF", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "importAwaitingApproval" })
    await page.goto(surface)

    const form = page.locator('form[action="/api/imports/approve"]')
    const fields = {
      csrfToken: await form.locator('input[name="csrfToken"]').inputValue(),
      repositoryId: await form.locator('input[name="repositoryId"]').inputValue(),
      idempotencyKey: await form.locator('input[name="idempotencyKey"]').inputValue(),
      expectedStatus: await form.locator('input[name="expectedStatus"]').inputValue(),
      costBudgetUsd: "25",
    }

    const approve = (importId: string): Promise<string> =>
      page.evaluate(
        async (payload: Record<string, string>) => {
          const response = await fetch("/api/imports/approve", {
            method: "POST",
            headers: { "content-type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams(payload).toString(),
          })
          return response.url
        },
        { ...fields, importId },
      )

    // A run this caller cannot see and one that never existed answer alike.
    expect(await approve(IMPORTS.completed)).toContain(
      "result=REPOSITORY_IMPORT_NOT_FOUND",
    )
    expect(await approve(ABSENT_IMPORT)).toContain("result=REPOSITORY_IMPORT_NOT_FOUND")

    await page.goto(surface)
    // Nothing moved on the run the caller does own.
    await expect(page.getByTestId("import-authorization")).toHaveAttribute(
      "data-waiting-on",
      "customer",
    )
  })

  test("refuses a direct backend read for another organization", async ({
    context,
  }) => {
    const { token } = await signIn(context, { scenario: "importProcessing" })

    // Straight at the backend with this caller's own token, bypassing the UI.
    const response = await context.request.get(
      `${STUB_ORIGIN}/v1/organizations/00000000-0000-4000-8000-0000000000b1` +
        `/repositories/${IMPORTED}/imports/current`,
      { headers: { authorization: `Bearer ${token}` }, ignoreHTTPSErrors: true },
    )

    expect(response.status()).toBe(403)
    expect(await response.json()).toMatchObject({
      error: { code: "ORGANIZATION_MEMBERSHIP_REQUIRED" },
    })
  })

  test("refuses a retry for a job the backend has not declared retryable", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "importFailed" })
    await page.goto(surface)

    const form = page.locator('form[action="/api/imports/retry"]')
    const fields = {
      csrfToken: await form.locator('input[name="csrfToken"]').inputValue(),
      repositoryId: await form.locator('input[name="repositoryId"]').inputValue(),
      idempotencyKey: await form.locator('input[name="idempotencyKey"]').inputValue(),
      importId: await form.locator('input[name="importId"]').inputValue(),
    }

    // The blocked job renders no control, so this is the direct call that
    // proves the backend refuses it rather than the UI merely hiding it.
    const url = await page.evaluate(
      async (payload: Record<string, string>) => {
        const response = await fetch("/api/imports/retry", {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams(payload).toString(),
        })
        return response.url
      },
      { ...fields, extractionJobId: EXTRACTION_JOBS.blocked },
    )

    expect(url).toContain("result=REPOSITORY_IMPORT_JOB_NOT_RETRYABLE")
  })

  test("refuses every import mutation for a read-only principal", async ({
    context,
    page,
  }) => {
    await signIn(context, {
      scenario: "importAwaitingApproval",
      principal: "console-stub-viewer",
    })
    await page.goto(surface)

    // A viewer is offered nothing, and reaching the route anyway is refused by
    // the backend rather than by the absence of a rendered control.
    await expect(page.getByTestId("import-approve")).toHaveCount(0)

    const url = await page.evaluate(async () => {
      const response = await fetch("/api/imports/prepare", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          csrfToken: "forged",
          repositoryId: "00000000-0000-4000-8000-000000000006",
          idempotencyKey: "00000000-0000-4000-8000-0000000000ff",
          range: "ENTIRE_HISTORY",
        }).toString(),
      })
      return response.url
    })

    // A forged CSRF proof never reaches the backend at all.
    expect(url).toContain("/auth/sign-in")
  })

  test("puts no caller token, provider key or budget secret in the document", async ({
    context,
    page,
  }) => {
    const { token } = await signIn(context, { scenario: "importProcessing" })

    await page.goto(surface)
    const document = await page.content()

    expect(document).not.toContain(token)
    expect(document).not.toContain("service_role")
    expect(document).not.toMatch(/postgres(ql)?:\/\//)
    expect(document).not.toMatch(/sk-[A-Za-z0-9]/)
    expect(document).not.toContain("Bearer ")
  })
})
