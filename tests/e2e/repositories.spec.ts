import { expect, test } from "@playwright/test"

import { signIn } from "../support/session-fixture"

/**
 * J-002 and J-003, owned by EEM-9/03.
 *
 * The journey runs against the Console and its BFF over the pinned HTTPS
 * origin, with the Console API double standing in for the backend. No GitHub
 * App is connected, no GitHub API is called and no paid path exists here.
 */

test.describe("journey_review_repository_inventory", () => {
  test.beforeEach(async ({ context }) => {
    await signIn(context)
  })

  test("shows GitHub access, entitlement and policy as three separate answers", async ({
    page,
  }) => {
    await page.goto("/repositories")

    await expect(page.getByRole("heading", { name: "Repositories" })).toBeVisible()

    const locked = page.getByRole("listitem").filter({ hasText: "acme/payments" })
    // Accessible, not entitled, no policy: three answers, not one chip.
    await expect(locked.getByText("Accessible", { exact: true })).toBeVisible()
    await expect(locked.getByText("Not activated", { exact: true })).toBeVisible()
    await expect(locked.getByText("None", { exact: true })).toBeVisible()
  })

  test("distinguishes an available repository from an active one", async ({ page }) => {
    await page.goto("/repositories")

    const available = page.getByRole("listitem").filter({ hasText: "acme/payments" })
    const active = page.getByRole("listitem").filter({ hasText: "acme/console" })

    await expect(available).toContainText("Available, not activated")
    await expect(active).toContainText("Active, source only")
  })

  test("reports accessible and active as separate counts", async ({ page }) => {
    await page.goto("/repositories")

    const capacity = page.getByRole("region", { name: "Repository capacity" })
    await expect(capacity).toContainText("Accessible on GitHub")
    await expect(capacity).toContainText("Active in Evirion")
    await expect(capacity).toContainText("of 5 active")
  })

  test("renders a disabled entitlement and lost access as different states", async ({
    page,
  }) => {
    await page.goto("/repositories")

    await expect(
      page.getByRole("listitem").filter({ hasText: "acme/billing" }),
    ).toContainText("Entitlement disabled")
    await expect(
      page.getByRole("listitem").filter({ hasText: "acme/removed-service" }),
    ).toContainText("Not accessible")
  })

  test("says automatic extraction still waits on Evirion authorization", async ({
    page,
  }) => {
    await page.goto("/repositories")

    await expect(
      page.getByRole("listitem").filter({ hasText: "acme/extraction" }),
    ).toContainText("Evirion operational authorization is still required")
  })
})

test.describe("repository inventory states", () => {
  test("renders no accessible repository as an empty state", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "empty" })

    await page.goto("/repositories")

    await expect(page.getByText("No repository is accessible yet")).toBeVisible()
  })

  test("renders an unprovisioned allowance as a refusal, never as zero", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "limitNotProvisioned" })

    await page.goto("/repositories")

    await expect(page.getByText("ORGANIZATION_LIMIT_NOT_PROVISIONED")).toBeVisible()
    await expect(page.getByText("No, not by retrying")).toBeVisible()
  })

  test("follows the backend cursor rather than inventing pagination", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "paged" })

    await page.goto("/repositories")
    await expect(page.getByRole("listitem")).toHaveCount(2)

    await page.getByRole("link", { name: "Next repositories" }).click()
    await expect(page).toHaveURL(/\/repositories\?after=/)
    await expect(page.getByRole("listitem")).toHaveCount(2)
  })

  test("says replacement is an operator action where the organization says so", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "operatorOnly" })

    await page.goto("/repositories")

    await expect(
      page.getByRole("region", { name: "Repository capacity" }),
    ).toContainText("Evirion operator action")
  })
})

test.describe("journey_open_one_repository", () => {
  test("reaches the detail page from the list and keeps the axes apart", async ({
    context,
    page,
  }) => {
    await signIn(context)

    await page.goto("/repositories")
    await page.getByRole("link", { name: "acme/extraction" }).click()

    await expect(page.getByRole("heading", { name: "acme/extraction" })).toBeVisible()
    await expect(page.getByRole("region", { name: "Entitlement" })).toContainText(
      "Active",
    )
    await expect(page.getByRole("region", { name: "Recorded consent" })).toContainText(
      "standard-extraction",
    )
  })

  test("keeps the four gates separate and says who decides each", async ({
    context,
    page,
  }) => {
    await signIn(context)

    await page.goto("/repositories")
    await page.getByRole("link", { name: "acme/console" }).click()

    const gates = page.getByRole("region", { name: "What each step means" })
    await expect(gates).toContainText("Source work")
    await expect(gates).toContainText("Your consent")
    await expect(gates).toContainText("Evirion authorization")
    await expect(gates).toContainText("Paid execution")
    // Consent is never presented as satisfying Evirion authorization.
    await expect(gates).toContainText("Your consent never grants this")
  })

  test("shows an outstanding change request as a wait with no action", async ({
    context,
    page,
  }) => {
    await signIn(context)

    await page.goto("/repositories")
    await page.getByRole("link", { name: "acme/search" }).click()

    const notice = page.getByRole("region", { name: "Change request" })
    await expect(notice).toContainText("with an Evirion operator")
    await expect(notice.getByRole("button")).toHaveCount(0)
  })

  test("shows no repository counters, because the contract publishes none", async ({
    context,
    page,
  }) => {
    await signIn(context)

    await page.goto("/repositories")
    await page.getByRole("link", { name: "acme/console" }).click()

    // Open decision 6 is blocked on a contract gap. Nothing here may invent a
    // count, and an unavailable aggregate must never render as zero.
    await expect(page.getByText(/merged pull requests discovered/i)).toHaveCount(0)
    await expect(page.getByText(/knowledge objects/i)).toHaveCount(0)
  })
})

test.describe("repository tenant boundary", () => {
  test("sends an unauthenticated caller to sign-in", async ({ page }) => {
    await page.goto("/repositories")

    await expect(page).toHaveURL(/\/auth\/sign-in/)
  })

  test("drops a cursor that is not a repository identifier", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "default" })

    await page.goto("/repositories?after=../../internal/console/v1/session")

    // The list still renders its first page rather than forwarding the value.
    await expect(page.getByRole("heading", { name: "Repositories" })).toBeVisible()
    await expect(page.getByRole("listitem").first()).toBeVisible()
  })
})
