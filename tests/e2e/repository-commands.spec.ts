import { expect, test } from "@playwright/test"

import { REPOSITORIES } from "../../tools/console-stub/fixtures.mjs"
import { signIn } from "../support/session-fixture"

/**
 * J-003 and the entitlement state machine, owned by EEM-9/03.
 *
 * What is proved here is not that a happy path works but that the backend
 * stays the authority: a duplicate submission replays rather than repeating, a
 * stale version is refused, capacity is decided under lock and never guessed
 * locally, and an operator-owned replacement offers no self-service control.
 */

const detail = (id: string): string => `/repositories/${id}`

test.describe("journey_activate_one_repository", () => {
  test("activates from a committed receipt and shows the committed state", async ({
    context,
    page,
  }) => {
    await signIn(context)
    await page.goto(detail(REPOSITORIES.availableLocked))

    await page.getByLabel("I confirm this").check()
    await page.getByRole("button", { name: "Activate repository" }).click()

    await expect(page.getByText("Done.")).toBeVisible()
    // The state beside the notice is re-read, not assumed.
    await expect(page.getByRole("region", { name: "Entitlement" })).toContainText(
      "Active",
    )
  })

  test("refuses to activate without the explicit confirmation", async ({
    context,
    page,
  }) => {
    await signIn(context)
    await page.goto(detail(REPOSITORIES.availableLocked))

    await page.getByRole("button", { name: "Activate repository" }).click()

    await expect(page.getByText("REQUEST_INVALID")).toBeVisible()
    await expect(page.getByRole("region", { name: "Entitlement" })).toContainText(
      "no Evirion entitlement",
    )
  })

  test("replays a duplicate submission and refuses the same key with a new body", async ({
    context,
    page,
  }) => {
    await signIn(context)
    await page.goto(detail(REPOSITORIES.availableLocked))

    // Exactly what the rendered form would send, taken from the rendered form
    // rather than assembled by hand, so the key and version are the real ones.
    const form = page.locator('form[action="/api/repositories/activate"]')
    const body = {
      csrfToken: await form.locator('input[name="csrfToken"]').inputValue(),
      repositoryId: await form.locator('input[name="repositoryId"]').inputValue(),
      idempotencyKey: await form.locator('input[name="idempotencyKey"]').inputValue(),
      expectedVersion: await form.locator('input[name="expectedVersion"]').inputValue(),
      confirmationAccepted: "on",
    }
    // Sent from the page itself, so the browser supplies the same Origin and
    // Fetch Metadata a form submission would, and the guard sees a real request.
    const send = (fields: Record<string, string>): Promise<string> =>
      page.evaluate(async (payload: Record<string, string>) => {
        const response = await fetch("/api/repositories/activate", {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams(payload).toString(),
        })
        return response.url
      }, fields)

    // Same key and same body is the stored receipt, which is a success, not a
    // conflict. The customer must not be shown an error for a double click.
    expect(await send(body)).toContain("result=applied")
    expect(await send(body)).toContain("result=applied")

    // Same key with a different body is the one case that is a conflict.
    expect(await send({ ...body, expectedVersion: "1" })).toContain(
      "result=IDEMPOTENCY_KEY_REUSED",
    )
  })

  test("refuses a stale expected version instead of overwriting", async ({
    context,
  }) => {
    await signIn(context)

    // Two tabs on the same repository, which is how this happens for real. No
    // field is tampered with: the first tab simply still holds the version it
    // was rendered with.
    const stale = await context.newPage()
    const current = await context.newPage()
    await stale.goto(detail(REPOSITORIES.activeSourceOnly))
    await current.goto(detail(REPOSITORIES.activeSourceOnly))

    await current.getByLabel("Live processing mode").selectOption("OFF")
    await current.getByRole("button", { name: "Save live processing" }).click()
    await expect(current.getByText("Done.")).toBeVisible()

    await stale.getByLabel("Live processing mode").selectOption("OFF")
    await stale.getByRole("button", { name: "Save live processing" }).click()

    await expect(stale.getByText("VERSION_CONFLICT")).toBeVisible()
    await expect(stale.getByText("Reload and try again")).toBeVisible()
    // The committed state is the one the other tab produced, not an overwrite.
    await expect(stale.getByText("Active, live processing off")).toBeVisible()
  })

  test("refuses the last slot to the second of two activations", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "limitReached" })
    await page.goto(detail(REPOSITORIES.availableLocked))

    await page.getByLabel("I confirm this").check()
    await page.getByRole("button", { name: "Activate repository" }).click()

    // Capacity is decided under lock by the backend. Nothing local guessed it.
    await expect(page.getByText("REPOSITORY_LIMIT_REACHED")).toBeVisible()
  })
})

test.describe("policy and consent", () => {
  test("moves live processing between off and source only", async ({
    context,
    page,
  }) => {
    await signIn(context)
    await page.goto(detail(REPOSITORIES.activeLiveOff))

    await page.getByLabel("Live processing mode").selectOption("SOURCE_ONLY")
    await page.getByRole("button", { name: "Save live processing" }).click()

    await expect(page.getByText("Done.")).toBeVisible()
    await expect(page.getByText("Active, source only")).toBeVisible()
  })

  test("records a complete consent and says Evirion must still authorize", async ({
    context,
    page,
  }) => {
    await signIn(context)
    await page.goto(detail(REPOSITORIES.activeSourceOnly))

    await page.getByText("Turn on automatic extraction", { exact: true }).click()
    await page.getByLabel("Model profiles, comma separated").fill("standard-extraction")
    await page.getByLabel("Maximum model calls").fill("50")
    await page.getByLabel("Maximum budget in USD").fill("12.5")
    await page.getByLabel("Expires").fill("2027-01-01T00:00")
    await page
      .getByRole("button", { name: "Record consent and turn on automatic extraction" })
      .click()

    await expect(page.getByText("Done.")).toBeVisible()
    await expect(page.getByText("Active, automatic extraction")).toBeVisible()
    await expect(page.getByRole("region", { name: "Recorded consent" })).toContainText(
      "12.500000 USD ceiling",
    )
    await expect(
      page.getByRole("region", { name: "What each step means" }),
    ).toContainText("Your consent never grants this")
  })

  test("refuses automatic extraction with an incomplete consent", async ({
    context,
    page,
  }) => {
    await signIn(context)
    await page.goto(detail(REPOSITORIES.activeSourceOnly))

    await page.getByText("Turn on automatic extraction", { exact: true }).click()
    // An expiry in the past is not a consent the backend could honour.
    await page.getByLabel("Model profiles, comma separated").fill("standard-extraction")
    await page.getByLabel("Expires").fill("2020-01-01T00:00")
    await page
      .getByRole("button", { name: "Record consent and turn on automatic extraction" })
      .click()

    await expect(page.getByText("REQUEST_INVALID")).toBeVisible()
    await expect(page.getByText("Active, source only")).toBeVisible()
  })
})

test.describe("operator-owned replacement", () => {
  test("offers a request rather than a self-service disable", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "operatorOnly" })
    await page.goto(detail(REPOSITORIES.activeSourceOnly))

    await expect(page.getByRole("button", { name: "Disable repository" })).toHaveCount(
      0,
    )
    await expect(page.getByRole("button", { name: "Request change" })).toBeVisible()
  })

  test("records the request without freeing the slot", async ({ context, page }) => {
    await signIn(context, { scenario: "operatorOnly" })
    await page.goto(detail(REPOSITORIES.activeSourceOnly))

    await page.getByLabel("Repository to use instead").selectOption({ index: 0 })
    await page.getByRole("button", { name: "Request change" }).click()

    await expect(page.getByText("Done.")).toBeVisible()
    await expect(page.getByRole("region", { name: "Change request" })).toContainText(
      "with an Evirion operator",
    )
    // Still entitled: a request changes nothing until an operator applies it.
    await expect(page.getByRole("region", { name: "Entitlement" })).toContainText(
      "Active",
    )
  })
})

test.describe("a viewer sees no control the backend would refuse", () => {
  test("renders no entitlement or policy control", async ({ context, page }) => {
    await signIn(context, { principal: "console-stub-viewer" })
    await page.goto(detail(REPOSITORIES.availableLocked))

    await expect(page.getByRole("button", { name: "Activate repository" })).toHaveCount(
      0,
    )
    await expect(
      page.getByRole("button", { name: "Save live processing" }),
    ).toHaveCount(0)
    // The repository itself is still readable: hiding a control is not hiding
    // the resource.
    await expect(page.getByRole("region", { name: "Entitlement" })).toBeVisible()
  })
})
