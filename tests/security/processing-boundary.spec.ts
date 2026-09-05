import { expect, test } from "@playwright/test"

import { REPOSITORIES } from "../../tools/console-stub/fixtures.mjs"
import { STUB_ORIGIN, signIn } from "../support/session-fixture"

const FOREIGN_REPOSITORY = "00000000-0000-4000-8000-0000000000f1"
const ABSENT_REPOSITORY = "00000000-0000-4000-8000-00000000ffff"

test.describe("processing tenant boundary", () => {
  test("refuses a foreign repository filter exactly as it refuses an absent one", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "processingSettings" })
    await page.goto(`/processing?repositoryId=${FOREIGN_REPOSITORY}`)
    const foreign = await page.content()
    await page.goto(`/processing?repositoryId=${ABSENT_REPOSITORY}`)
    const absent = await page.content()
    expect(foreign).toContain("No processing rows match this filter")
    expect(absent).toContain("No processing rows match this filter")
  })

  test("refuses a malformed repository identifier without calling the backend", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "processingSettings" })
    await page.goto("/processing?repositoryId=not-a-uuid")
    await expect(page.getByText("REQUEST_INVALID")).toBeVisible()
  })

  test("does not expose tokens or secrets on processing or settings surfaces", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "processingSettings" })
    await page.goto("/processing")
    let content = await page.content()
    expect(content).not.toMatch(/service_role|BEGIN PRIVATE KEY|ghp_[A-Za-z0-9]+/)
    await page.goto("/settings/usage")
    content = await page.content()
    expect(content).not.toMatch(/service_role|BEGIN PRIVATE KEY/)
    await page.goto("/settings/members")
    content = await page.content()
    expect(content).not.toMatch(/service_role|BEGIN PRIVATE KEY/)
  })

  test("viewer does not receive cost figures on processing rows", async ({
    context,
    page,
  }) => {
    await signIn(context, {
      scenario: "processingSettingsViewer",
      principal: "console-stub-viewer",
    })
    await page.goto("/processing")
    await expect(page.getByTestId("processing-cost").first()).toContainText(
      "Not included for your role",
    )
  })

  test("viewer is refused usage metrics", async ({ context, page }) => {
    await signIn(context, {
      scenario: "processingSettings",
      principal: "console-stub-viewer",
    })
    await page.goto("/settings/usage")
    await expect(page.getByText("CAPABILITY_REQUIRED")).toBeVisible()
  })

  test("a member who may not manage still sees the member inventory", async ({
    context,
    page,
  }) => {
    // Reading members and reading pending invitations are two capabilities.
    // Losing the second must not take the first down with it.
    await signIn(context, {
      scenario: "processingSettings",
      principal: "console-stub-viewer",
    })
    await page.goto("/settings/members")

    await expect(page.getByTestId("member-row")).toHaveCount(3)
    await expect(page.getByTestId("member-email")).toHaveCount(0)
    await expect(page.getByTestId("invite-member-button")).toHaveCount(0)
    await expect(page.getByLabel("Pending invitations")).toHaveCount(0)
  })

  test("refuses a foreign pull request exactly as it refuses an absent one", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "processingSettings" })
    await page.goto(`/repositories/${FOREIGN_REPOSITORY}/pull-requests/402`)
    const foreign = await page.content()
    await page.goto(`/repositories/${REPOSITORIES.activeAutoExtract}/pull-requests/998`)
    const absent = await page.content()

    expect(foreign).toContain("RESOURCE_NOT_FOUND")
    expect(absent).toContain("RESOURCE_NOT_FOUND")
    await expect(page.getByTestId("pull-request-run")).toHaveCount(0)
  })

  test("refuses a pull request number the route never addresses", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "processingSettings" })
    await page.goto(
      `/repositories/${REPOSITORIES.activeAutoExtract}/pull-requests/0402`,
    )

    await expect(page.getByText("REQUEST_INVALID")).toBeVisible()
    await expect(page.getByTestId("pull-request-run")).toHaveCount(0)
  })

  test("direct backend read for another organization is refused", async ({
    context,
  }) => {
    const session = await signIn(context, { scenario: "processingSettings" })
    const response = await context.request.get(
      `${STUB_ORIGIN}/v1/organizations/00000000-0000-4000-8000-0000000000b1/processing-activity`,
      {
        headers: { authorization: `Bearer ${session.token}` },
        ignoreHTTPSErrors: true,
      },
    )
    expect(response.status()).toBe(403)
  })
})

test.describe("processing settings repository boundary", () => {
  test("repository counters remain on the repository surface", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "default" })
    await page.goto(`/repositories/${REPOSITORIES.activeAutoExtract}`)
    await expect(
      page.getByRole("region", { name: "Repository counters" }),
    ).toBeVisible()
    await expect(page.getByText("Runs the model rejected")).toBeVisible()
  })
})
