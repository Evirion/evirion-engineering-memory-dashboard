import { expect, test } from "@playwright/test"

import { signIn } from "../support/session-fixture"

/**
 * J-002 and J-009, owned by EEM-9/03.
 *
 * No GitHub App is connected and no GitHub API is called: the handoff stops at
 * the redirect the Console issues. What is proved is that connecting creates
 * no entitlement, that a partial traversal never reads as lost access, and
 * that a suspended installation is visible and recoverable.
 */

test.describe("journey_connect_github", () => {
  test("offers the connection first and promises nothing more", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "notConnected" })
    await page.goto("/onboarding")

    const connection = page.getByRole("region", { name: "GitHub connection" })
    await expect(connection).toContainText("Not connected")
    await expect(connection).toContainText("activates nothing and starts no processing")
    // Nothing to synchronize until an installation exists.
    await expect(
      connection.getByRole("button", { name: "Synchronize repositories" }),
    ).toHaveCount(0)
  })

  test("hands off to GitHub with a one-time state and no credential", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "notConnected" })
    await page.goto("/onboarding")

    // Read the handoff from the redirect the Console issued. The browser
    // cannot reach GitHub at all: the harness maps that host to loopback, so
    // the navigation dies locally and no request leaves this machine.
    let handoff: string | undefined
    page.on("response", (response) => {
      if (response.url().endsWith("/api/github/connect")) {
        handoff = response.headers()["location"]
      }
    })
    await page.getByRole("button", { name: "Connect GitHub" }).click()
    await expect.poll(() => handoff).toBeDefined()

    const destination = new URL(handoff as string)
    expect(destination.origin).toBe("https://github.com")
    expect(destination.searchParams.get("state")).toMatch(/^[0-9a-f]{64}$/)
    // A nonce, and nothing else. No App identity travels through the browser.
    expect([...destination.searchParams.keys()]).toEqual(["state"])
  })

  test("creates no entitlement by connecting", async ({ context, page }) => {
    await signIn(context, { scenario: "notConnected" })
    await page.goto("/repositories")

    await expect(
      page.getByRole("region", { name: "Repository capacity" }),
    ).toContainText("Active in Evirion")
    await expect(page.getByText("No repository is accessible yet")).toBeVisible()
  })
})

test.describe("repository synchronization", () => {
  test("reports a completed traversal with its counts", async ({ context, page }) => {
    await signIn(context)
    await page.goto("/repositories")

    await expect(page.getByRole("region", { name: "GitHub connection" })).toContainText(
      "Last synchronization completed",
    )
  })

  test("never reads a running traversal as lost access", async ({ context, page }) => {
    await signIn(context, { scenario: "syncRunning" })
    await page.goto("/repositories")

    const connection = page.getByRole("region", { name: "GitHub connection" })
    await expect(connection).toContainText("Synchronization is running")
    await expect(connection).toContainText(
      "the inventory below is the last complete one",
    )
    // The eight repositories are still listed while the traversal continues.
    await expect(page.getByRole("listitem")).toHaveCount(8)
  })

  test("queues a run and returns a receipt rather than the traversal", async ({
    context,
    page,
  }) => {
    await signIn(context)
    await page.goto("/repositories")

    await page.getByRole("button", { name: "Synchronize repositories" }).click()

    await expect(page.getByText("Done.")).toBeVisible()
    await expect(page.getByRole("region", { name: "GitHub connection" })).toContainText(
      "Synchronization is queued",
    )
  })
})

test.describe("journey_reconnect_installation", () => {
  test("shows a suspended installation as blocking and recoverable", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "installationSuspended" })
    await page.goto("/repositories")

    const connection = page.getByRole("region", { name: "GitHub connection" })
    await expect(connection).toContainText("Suspended for acme")
    await expect(connection).toContainText("New source work is blocked")
    await expect(connection).toContainText("no entitlement or history is lost")
    await expect(
      connection.getByRole("button", { name: "Reconnect GitHub" }),
    ).toBeVisible()
  })

  test("keeps entitlements while the installation is suspended", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "installationSuspended" })
    await page.goto("/repositories")

    // Access and entitlement are separate axes: losing one is not losing both.
    await expect(
      page.getByRole("listitem").filter({ hasText: "acme/console" }),
    ).toContainText("Active")
  })
})
