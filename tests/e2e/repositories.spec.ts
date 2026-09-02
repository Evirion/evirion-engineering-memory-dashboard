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
