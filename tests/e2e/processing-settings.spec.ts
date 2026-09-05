import { expect, test } from "@playwright/test"

import { REPOSITORIES } from "../../tools/console-stub/fixtures.mjs"
import { signIn } from "../support/session-fixture"

test.describe("goal_operational_transparency_uses_safe_projections", () => {
  test("shows safe processing, usage and metrics projections", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "processingSettings" })
    await page.goto("/processing")
    await expect(page.getByTestId("processing-activity-table")).toBeVisible()
    await expect(page.getByTestId("processing-row").first()).toBeVisible()

    await page.goto("/settings/usage")
    await expect(page.getByLabel("Operational usage")).toBeVisible()
    await expect(page.getByLabel("Alpha metrics")).toBeVisible()
    await expect(page.getByText("Operational figures, not an invoice")).toBeVisible()
  })
})

test.describe("processing_detail_offers_no_recovery_action", () => {
  test("offers no retry, resume or replay control on failed processing rows", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "processingSettings" })
    await page.goto("/processing")

    const content = await page.content()
    expect(content).not.toMatch(/>\s*Retry\s*</i)
    expect(content).not.toMatch(/>\s*Resume\s*</i)
    expect(content).not.toMatch(/recoveryAction/i)

    await expect(page.getByTestId("processing-support-copy").first()).toBeVisible()
  })

  test("never derives retryability from paid authorization waits", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "processingSettings" })
    await page.goto("/processing")

    const evirionWait = page
      .locator('[data-paid-authorization="AWAITING_OPERATIONAL_AUTHORIZATION"]')
      .first()
    await expect(evirionWait).toBeVisible()
    await expect(evirionWait).toContainText("Waiting for Evirion authorization")
    await expect(evirionWait.locator("button")).toHaveCount(0)
  })
})

test.describe("journey_investigate_processing_outcome", () => {
  test("walks processing activity read-only with distinct failure kinds", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "processingSettings" })
    await page.goto("/processing")

    await page
      .getByLabel("Filter by repository")
      .selectOption(REPOSITORIES.activeAutoExtract)
    await page.getByRole("button", { name: "Apply filter" }).click()

    await expect(
      page
        .getByTestId("processing-outcome")
        .filter({ hasText: "Rejected by admission" }),
    ).toBeVisible()
    await expect(
      page.getByTestId("processing-outcome").filter({ hasText: "Quarantined" }),
    ).toBeVisible()
    await expect(
      page
        .getByTestId("processing-outcome")
        .filter({ hasText: "Infrastructure failure" }),
    ).toBeVisible()
    await expect(page.getByTestId("processing-error-code").first()).toBeVisible()
  })
})

test.describe("journey_manage_members_with_owner_guard", () => {
  test("lists members and offers invite controls for owners", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "processingSettings" })
    await page.goto("/settings/members")

    await expect(page.getByTestId("member-row")).toHaveCount(3)
    await expect(page.getByTestId("invite-member-button")).toBeVisible()
    await expect(page.getByTestId("invitation-row")).toHaveCount(1)
    await expect(page.getByTestId("members-mutation-blocked")).toHaveCount(0)
  })

  test("invites a member and reports the committed receipt", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "processingSettings" })
    await page.goto("/settings/members")

    await page.getByLabel("Invitation email").fill("new.member@acme.example")
    await page.getByLabel("Invitation role").selectOption("reviewer")
    await page.getByTestId("invite-member-button").click()

    await expect(
      page.getByTestId("membership-outcome-ORGANIZATION_INVITATION_CREATED"),
    ).toBeVisible()
    await expect(page.getByTestId("invitation-row")).toHaveCount(2)
    await expect(page.getByText("new.member@acme.example")).toBeVisible()
  })

  test("resends and revokes a pending invitation", async ({ context, page }) => {
    await signIn(context, { scenario: "processingSettings" })
    await page.goto("/settings/members")

    await page.getByRole("button", { name: "Resend invitation" }).click()
    await expect(
      page.getByTestId("membership-outcome-ORGANIZATION_INVITATION_RESEND_REQUESTED"),
    ).toBeVisible()

    await page.getByRole("button", { name: "Revoke invitation" }).click()
    await expect(
      page.getByTestId("membership-outcome-ORGANIZATION_INVITATION_REVOKED"),
    ).toBeVisible()
    await expect(page.getByTestId("invitation-row")).toHaveCount(0)
    await expect(page.getByText("No pending invitations.")).toBeVisible()
  })

  test("changes a member role and never offers one for the owner", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "processingSettings" })
    await page.goto("/settings/members")

    const owner = page
      .getByTestId("member-row")
      .filter({ hasText: "owner@acme.example" })
    await expect(owner.getByRole("button", { name: "Update role" })).toHaveCount(0)

    const admin = page
      .getByTestId("member-row")
      .filter({ hasText: "admin@acme.example" })
    await page.getByLabel("Role for admin@acme.example").selectOption("viewer")
    await admin.getByRole("button", { name: "Update role" }).click()

    await expect(
      page.getByTestId("membership-outcome-ORGANIZATION_MEMBERSHIP_ROLE_CHANGED"),
    ).toBeVisible()
  })

  test("refuses a membership mutation that carries a stale version", async ({
    context,
  }) => {
    // Two open tabs of one session. The first commits and moves the version;
    // the second still holds the version it rendered with, which is the only
    // way a customer meets this refusal.
    await signIn(context, { scenario: "processingSettings" })
    const first = await context.newPage()
    const second = await context.newPage()
    await first.goto("/settings/members")
    await second.goto("/settings/members")

    await first.getByRole("button", { name: "Resend invitation" }).click()
    await expect(
      first.getByTestId("membership-outcome-ORGANIZATION_INVITATION_RESEND_REQUESTED"),
    ).toBeVisible()

    await second.getByRole("button", { name: "Resend invitation" }).click()
    await expect(second.getByText("VERSION_CONFLICT")).toBeVisible()
  })

  test("refuses an invitation the surface can judge before any backend call", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "processingSettings" })
    await page.goto("/settings/members")

    // `novalidate` keeps the browser from stopping the submit, so the refusal
    // proved here is the server's rather than the input type's.
    await page.getByTestId("invite-member-form").evaluate((form) => {
      form.setAttribute("novalidate", "novalidate")
    })
    await page.getByLabel("Invitation email").fill("not-an-address")
    await page.getByTestId("invite-member-button").click()

    await expect(page.getByText("REQUEST_INVALID")).toBeVisible()
    await expect(page.getByTestId("invitation-row")).toHaveCount(1)
  })
})

test.describe("journey_recover_failed_or_paused_work", () => {
  test("processing half offers no customer action while import recovery remains elsewhere", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "processingSettings" })
    await page.goto("/processing")
    await expect(page.getByTestId("processing-support-copy").first()).toBeVisible()

    await page.goto(`/repositories/${REPOSITORIES.activeSourceOnly}/import`)
    await expect(page.getByTestId("import-retry-job")).toHaveCount(0)
  })
})

test.describe("journey_request_and_observe_offboarding", () => {
  test("observes offboarding status and offers request without execute controls", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "processingSettings" })
    await page.goto("/settings/members")

    await expect(page.getByLabel("Offboarding status")).toBeVisible()
    await expect(page.getByText("No offboarding request is on record.")).toBeVisible()
    await expect(page.getByTestId("offboarding-request-button")).toBeVisible()
    await expect(
      page.getByRole("button", { name: /execute offboarding/i }),
    ).toHaveCount(0)
  })

  test("refuses the request until the customer confirms it", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "processingSettings" })
    await page.goto("/settings/members")

    await page.getByTestId("offboarding-request-button").click()

    await expect(page.getByText("REQUEST_INVALID")).toBeVisible()
    await expect(page.getByText("No offboarding request is on record.")).toBeVisible()
  })

  test("records a confirmed request and says Evirion still owns execution", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "processingSettings" })
    await page.goto("/settings/members")

    await page.getByTestId("offboarding-confirmation").check()
    await page.getByTestId("offboarding-request-button").click()

    await expect(
      page.getByTestId("membership-outcome-ORGANIZATION_OFFBOARDING_REQUESTED"),
    ).toBeVisible()
    await expect(page.getByText("Status: Requested")).toBeVisible()
    await expect(page.getByTestId("offboarding-request-button")).toHaveCount(0)
    await expect(
      page.getByRole("button", { name: /execute offboarding/i }),
    ).toHaveCount(0)
  })
})

test.describe("PROC-003 pull request detail", () => {
  test("reaches PR detail from a processing row and explains a quarantine", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "processingSettings" })
    await page.goto("/processing")

    await page
      .getByTestId("processing-row")
      .filter({ hasText: "Schema drift guard" })
      .getByTestId("processing-pr-link")
      .click()

    await expect(page).toHaveURL(
      new RegExp(`/repositories/${REPOSITORIES.activeAutoExtract}/pull-requests/402$`),
    )
    await expect(page.getByText("acme/extraction #402")).toBeVisible()
    await expect(
      page.getByTestId("pull-request-run").filter({ hasText: "QUARANTINED" }),
    ).toBeVisible()
    await expect(page.getByText("EVIDENCE_QUOTE_NOT_A_SUBSTRING")).toBeVisible()
  })

  test("offers no recovery action on the detail either", async ({ context, page }) => {
    await signIn(context, { scenario: "processingSettings" })
    await page.goto(`/repositories/${REPOSITORIES.activeAutoExtract}/pull-requests/403`)

    await expect(page.getByText("Provider timeout path")).toBeVisible()
    const content = await page.content()
    expect(content).not.toMatch(/>\s*Retry\s*</i)
    expect(content).not.toMatch(/>\s*Resume\s*</i)
  })
})

test.describe("processing reads fail closed", () => {
  test("says the activity is unavailable rather than showing an empty list", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "processingUnavailable" })
    await page.goto("/processing")

    await expect(page.getByText("DEPENDENCY_UNAVAILABLE")).toBeVisible()
    await expect(page.getByTestId("processing-activity-table")).toHaveCount(0)
  })
})

test.describe("github and usage settings", () => {
  test("separates accessible and entitled repository counts", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "processingSettings" })
    await page.goto("/settings/github")

    await expect(
      page.getByText("Accessible repositories", { exact: true }),
    ).toBeVisible()
    await expect(
      page.getByText("Active entitled repositories", { exact: true }),
    ).toBeVisible()
  })

  test("renders unresolved cost without a measured zero", async ({ context, page }) => {
    await signIn(context, { scenario: "processingSettings" })
    await page.goto("/processing")

    const unresolved = page
      .locator('[data-processing-state="FAILED"]')
      .locator('[data-testid="processing-cost"]')
    await expect(unresolved).toContainText("No amount yet")
    await expect(unresolved).toContainText("Pending reconciliation")
  })
})
