import { expect, test } from "@playwright/test"

import {
  REPOSITORIES,
  type StubScenarioName,
} from "../../tools/console-stub/fixtures.mjs"
import { signIn } from "../support/session-fixture"

/**
 * J-004 and the historical-import surface, owned by EEM-9/04.
 *
 * What is proved here is not that a happy path works but that the surface
 * keeps the distinctions the subtask exists for: the two waits look different
 * and only one is actionable, approving never satisfies the Evirion gate, an
 * unresolved cost is never a zero, and recovery exists only where the
 * projection declares it.
 */

const IMPORTED = REPOSITORIES.activeSourceOnly
const surface = `/repositories/${IMPORTED}/import`

test.describe("prepare_import", () => {
  test("offers preparation when no run exists and states it is free", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "importAbsent" })
    await page.goto(surface)

    await expect(page.getByTestId("import-empty")).toBeVisible()
    await expect(page.getByTestId("import-prepare")).toContainText(
      "make no model call and cost nothing",
    )
  })

  test("prepares a run from a committed receipt", async ({ context, page }) => {
    await signIn(context, { scenario: "importAbsent" })
    await page.goto(surface)

    await page.getByRole("button", { name: "Prepare import" }).click()

    await expect(page.getByText("Done.")).toBeVisible()
    // The state beside the notice is re-read, not assumed.
    await expect(page.getByTestId("import-status")).toContainText("Preparing import")
  })

  test("refuses a custom range whose bounds are the wrong way round", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "importAbsent" })
    await page.goto(surface)

    await page.getByLabel("Custom date range").check()
    await page.getByLabel("Merged from").fill("2026-06-01")
    await page.getByLabel("Merged to").fill("2026-01-01")
    await page.getByRole("button", { name: "Prepare import" }).click()

    await expect(page.getByText("REQUEST_INVALID")).toBeVisible()
    // Refused before the backend was called, so no run exists.
    await expect(page.getByTestId("import-empty")).toBeVisible()
  })

  test("offers no second run while one is current", async ({ context, page }) => {
    await signIn(context, { scenario: "importProcessing" })
    await page.goto(surface)

    await expect(page.getByTestId("import-prepare")).toHaveCount(0)
  })

  test("cannot be asked to reextract through a direct call", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "importAbsent" })
    await page.goto(surface)

    const form = page.locator('form[action="/api/imports/prepare"]')
    const fields = {
      csrfToken: await form.locator('input[name="csrfToken"]').inputValue(),
      repositoryId: await form.locator('input[name="repositoryId"]').inputValue(),
      idempotencyKey: await form.locator('input[name="idempotencyKey"]').inputValue(),
      range: "ENTIRE_HISTORY",
      mode: "reextract",
    }

    await page.evaluate(async (payload: Record<string, string>) => {
      await fetch("/api/imports/prepare", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(payload).toString(),
      })
    }, fields)

    await page.goto(surface)
    // The contract admits no mode field, so the injected one reached nothing
    // and the run is the ordinary missing-only one.
    await expect(page.getByTestId("import-status")).toContainText(
      "Pull requests not already held",
    )
  })
})

test.describe("all_backend_states", () => {
  const states: readonly [StubScenarioName, string][] = [
    ["importPlanning", "Preparing import"],
    ["importDiscovering", "Discovering PR history"],
    ["importAwaitingApproval", "Ready for extraction"],
    ["importProcessing", "Extracting Engineering Memory"],
    ["importPaused", "Import paused"],
    ["importCompleted", "Import complete"],
    ["importFailed", "Import failed"],
    ["importCancelled", "Import cancelled"],
  ]

  for (const [scenario, label] of states) {
    test(`renders ${scenario} as ${label}`, async ({ context, page }) => {
      await signIn(context, { scenario })
      await page.goto(surface)

      await expect(page.getByTestId("import-status")).toContainText(label)
    })
  }

  test("keeps the run status and the authorization apart when they disagree", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "importAwaitingAuthorization" })
    await page.goto(surface)

    // The run is processing, so a surface reading status alone would claim
    // extraction is under way rather than naming the wait.
    await expect(page.getByTestId("import-status")).toContainText(
      "Extracting Engineering Memory",
    )
    await expect(page.getByTestId("import-authorization")).toContainText(
      "Waiting for Evirion authorization",
    )
  })
})

test.describe("approve_with_explicit_warning", () => {
  test("tells the two waits apart and offers an action for only one", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "importAwaitingApproval" })
    await page.goto(surface)

    const authorization = page.getByTestId("import-authorization")
    await expect(authorization).toHaveAttribute("data-waiting-on", "customer")
    await expect(authorization).toContainText("Waiting for your approval")
    await expect(page.getByTestId("import-approve")).toBeVisible()
  })

  test("offers nothing at all while Evirion is the one being waited on", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "importAwaitingAuthorization" })
    await page.goto(surface)

    const authorization = page.getByTestId("import-authorization")
    await expect(authorization).toHaveAttribute("data-waiting-on", "evirion")
    await expect(authorization).toContainText("no action for you to take")
    await expect(page.getByTestId("import-approve")).toHaveCount(0)
    await expect(page.getByRole("button", { name: /approve/i })).toHaveCount(0)
  })

  test("warns that extraction is paid before the control is used", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "importAwaitingApproval" })
    await page.goto(surface)

    const approve = page.getByTestId("import-approve")
    await expect(approve).toContainText("authorizes paid model calls")
    await expect(approve).toContainText("Eligible pull requests")
    await expect(approve).toContainText("Prepared source envelopes")
  })

  test("consent does not satisfy the Evirion gate", async ({ context, page }) => {
    await signIn(context, { scenario: "importAwaitingApproval" })
    await page.goto(surface)

    await page.getByLabel("Cost budget in USD").fill("25")
    await page.getByRole("button", { name: "Approve extraction" }).click()

    await expect(page.getByText("Done.")).toBeVisible()
    // The whole point: approving recorded consent and the run now waits on
    // Evirion. It never becomes authorized through a customer action.
    const authorization = page.getByTestId("import-authorization")
    await expect(authorization).toHaveAttribute("data-waiting-on", "evirion")
    await expect(authorization).not.toContainText("Authorized")
    await expect(page.getByTestId("import-approve")).toHaveCount(0)
  })

  test("refuses a stale expected status exactly as a stale version", async ({
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
      importId: await form.locator('input[name="importId"]').inputValue(),
      expectedStatus: "PROCESSING",
      costBudgetUsd: "25",
    }

    await page.evaluate(async (payload: Record<string, string>) => {
      await fetch("/api/imports/approve", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(payload).toString(),
      })
    }, fields)

    await page.goto(`${surface}?result=VERSION_CONFLICT`)
    await expect(page.getByText("VERSION_CONFLICT")).toBeVisible()
    // Nothing moved: the run is still waiting for the customer.
    await expect(page.getByTestId("import-authorization")).toHaveAttribute(
      "data-waiting-on",
      "customer",
    )
  })

  test("replays a duplicate approval rather than approving twice", async ({
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
      importId: await form.locator('input[name="importId"]').inputValue(),
      expectedStatus: await form.locator('input[name="expectedStatus"]').inputValue(),
      costBudgetUsd: "25",
    }

    const send = (payload: Record<string, string>): Promise<string> =>
      page.evaluate(async (body: Record<string, string>) => {
        const response = await fetch("/api/imports/approve", {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams(body).toString(),
        })
        return response.url
      }, payload)

    // Same key and same body is the stored receipt, which is a success and not
    // a conflict. A double click must not be reported as an error.
    expect(await send(fields)).toContain("result=applied")
    expect(await send(fields)).toContain("result=applied")

    // Same key with a different body is the conflict, and it has no effect.
    expect(await send({ ...fields, costBudgetUsd: "99" })).toContain(
      "result=IDEMPOTENCY_KEY_REUSED",
    )
  })
})

test.describe("progress_outcomes_and_cost", () => {
  test("reports work and machine outcomes as separate counts", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "importCompleted" })
    await page.goto(surface)

    const work = page.getByTestId("import-work-counts")
    const outcomes = page.getByTestId("import-disposition-counts")

    await expect(work).toContainText("Discovered")
    await expect(work).toContainText("Failed")
    await expect(outcomes).toContainText("Accepted")
    await expect(outcomes).toContainText("Rejected")
    await expect(outcomes).toContainText("Quarantined")
    await expect(page.getByTestId("import-progress-summary")).toContainText(
      "21 completed and 0 failed of 24 discovered",
    )
  })

  test("never renders an unresolved cost as zero", async ({ context, page }) => {
    await signIn(context, { scenario: "importFailed" })
    await page.goto(surface)

    const cost = page.getByTestId("import-cost")
    await expect(cost).toHaveAttribute("data-cost-completeness", "UNRESOLVED")
    await expect(page.getByTestId("cost-headline")).toHaveText("No amount to show")
    await expect(cost).toContainText("Pending reconciliation")
  })

  test("shows a settled amount and names it as not an invoice", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "importCompleted" })
    await page.goto(surface)

    await expect(page.getByTestId("cost-headline")).toHaveText("USD 18.400000")
    await expect(page.getByTestId("import-cost")).toContainText("not an invoice")
  })

  test("distinguishes all four cost states across the published runs", async ({
    context,
    page,
  }) => {
    const expected: readonly [StubScenarioName, string][] = [
      ["importPlanning", "NOT_APPLICABLE"],
      ["importProcessing", "RESERVED"],
      ["importCompleted", "MEASURED"],
      ["importFailed", "UNRESOLVED"],
    ]

    for (const [scenario, completeness] of expected) {
      await signIn(context, { scenario })
      await page.goto(surface)
      await expect(page.getByTestId("import-cost")).toHaveAttribute(
        "data-cost-completeness",
        completeness,
      )
    }
  })
})

test.describe("journey_prepare_and_approve_historical_import", () => {
  test("walks prepare, wait, approve and the Evirion wait", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "importAwaitingApproval" })
    await page.goto(surface)

    // Ready for extraction, waiting on the customer, with the workload shown.
    await expect(page.getByTestId("import-status")).toContainText(
      "Ready for extraction",
    )
    await expect(page.getByTestId("import-authorization")).toHaveAttribute(
      "data-waiting-on",
      "customer",
    )

    await page.getByLabel("Cost budget in USD").fill("25")
    await page.getByRole("button", { name: "Approve extraction" }).click()

    // The backend rechecks and reports the operational gate. No provider was
    // called and the customer is offered nothing further.
    await expect(page.getByTestId("import-authorization")).toContainText(
      "Waiting for Evirion authorization",
    )
    await expect(page.getByRole("button", { name: /approve/i })).toHaveCount(0)
    await expect(page.getByTestId("import-cost")).toContainText("USD 25.000000")
  })
})

test.describe("import recovery is only what the projection declares", () => {
  test("renders no generic Retry, Resume and Support call to action", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "importFailed" })
    await page.goto(surface)

    // `PROC-002` belongs to `/processing`, owned by EEM-9/06. Scoped to this
    // page's own content: the shell navigation links to `/processing` because
    // EEM-9/02 owns that entry, and a nav link is not a recovery call to
    // action.
    const owned = page.getByTestId("import-surface")
    await expect(owned.getByText("Retry, Resume and Support")).toHaveCount(0)
    await expect(owned.getByRole("link", { name: /processing/i })).toHaveCount(0)
    // The only retry on this page is the per-job one the projection declared.
    const retries = owned.getByRole("button", { name: /retry/i })
    await expect(retries).toHaveCount(1)
    await expect(retries).toHaveText("Retry this work")
  })

  test("offers a retry only for work the backend declared retryable", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "importFailed" })
    await page.goto(surface)

    const failures = page.getByTestId("import-failure")
    await expect(failures).toHaveCount(2)
    await expect(
      page.locator('[data-testid="import-failure"][data-retryable="yes"]'),
    ).toHaveCount(1)
    await expect(page.locator('form[action="/api/imports/retry"]')).toHaveCount(1)
    await expect(page.getByTestId("import-failures")).toContainText(
      "declared this work not retryable",
    )
  })

  test("retries the declared-retryable job and drops it from the list", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "importFailed" })
    await page.goto(surface)

    await page.getByRole("button", { name: "Retry this work" }).click()

    await expect(page.getByText("Done.")).toBeVisible()
    await expect(page.getByTestId("import-failure")).toHaveCount(1)
    await expect(page.locator('form[action="/api/imports/retry"]')).toHaveCount(0)
  })

  test("reports a blocked resume as a completed command, not an unknown one", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "importResumeBlocked" })
    await page.goto(surface)

    await page.getByRole("button", { name: "Resume import" }).click()

    // Source work is still held back, so the backend forces the run back to
    // paused and answers with its own receipt code. State changed, so calling
    // it unknown would tell the customer nothing happened when something did.
    await expect(page.getByTestId("import-outcome-resume-blocked")).toBeVisible()
    await expect(page.getByTestId("import-outcome-resume-blocked")).toContainText(
      "Resume was applied",
    )
    await expect(page.getByText("The outcome is not known yet.")).toHaveCount(0)
    await expect(page.getByTestId("import-status")).toContainText("Import paused")
    await expect(page.getByRole("button", { name: "Resume import" })).toBeVisible()
  })

  test("pauses and resumes only where the projection permits", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "importProcessing" })
    await page.goto(surface)

    await expect(page.getByRole("button", { name: "Pause import" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Resume import" })).toHaveCount(0)

    await page.getByRole("button", { name: "Pause import" }).click()

    await expect(page.getByTestId("import-status")).toContainText("Import paused")
    await expect(page.getByRole("button", { name: "Resume import" })).toBeVisible()
  })
})

test.describe("polling is bounded", () => {
  test("polls only while the backend is moving the run on its own", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "importProcessing" })
    await page.goto(surface)
    await expect(page.getByTestId("import-poll")).toHaveAttribute(
      "data-polling",
      "running",
    )

    // Terminal: nothing further to report.
    await signIn(context, { scenario: "importCompleted" })
    await page.goto(surface)
    await expect(page.getByTestId("import-poll")).toHaveCount(0)

    // Waiting on the customer: refreshing under someone filling in a budget
    // would discard what they typed, and nothing would have changed anyway.
    await signIn(context, { scenario: "importAwaitingApproval" })
    await page.goto(surface)
    await expect(page.getByTestId("import-poll")).toHaveCount(0)
    await expect(page.getByTestId("import-approve")).toBeVisible()

    // Waiting on Evirion: the backend can still move this one.
    await signIn(context, { scenario: "importAwaitingAuthorization" })
    await page.goto(surface)
    await expect(page.getByTestId("import-poll")).toHaveAttribute(
      "data-polling",
      "running",
    )
  })
})
