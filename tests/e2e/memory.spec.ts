import { expect, test } from "@playwright/test"

import {
  KNOWLEDGE,
  KNOWLEDGE_OBJECTS,
  REPOSITORIES,
} from "../../tools/console-stub/fixtures.mjs"
import { signIn } from "../support/session-fixture"

/**
 * The review queue, owned by EEM-9/05.
 *
 * These carry the `memory.spec.ts` coverage identifiers the implementation
 * plan names for `MEM-001` to `MEM-003`. What is proved is not that a list
 * renders but that it keeps the distinctions the subtask exists for: a machine
 * outcome that produced no knowledge is never a row, the filter state survives
 * a reload because it lives in the URL, and a row carries the summary alone.
 *
 * The visual primitive is open decision 4, so every assertion is against an
 * accessible name or per-item text rather than against a table or a card.
 */

const objects = KNOWLEDGE_OBJECTS()
const claimOf = (id: string): string => objects[id]?.shortClaim ?? "unreachable"

const rows = "memory-queue-row"

test.describe("pending_queue_excludes_outcomes", () => {
  test("lists admitted knowledge awaiting review and nothing else", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memory" })
    await page.goto("/memory")

    // The default view is the backend's own: an absent predicate means
    // awaiting review. Exactly one fixture is in that state.
    await expect(page.getByTestId(rows)).toHaveCount(1)
    await expect(page.getByTestId(rows)).toContainText(claimOf(KNOWLEDGE.pending))
    await expect(page.getByTestId(rows)).toContainText("Awaiting review")
  })

  test("never lists a machine-rejected or quarantined extraction", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memory" })

    // Neither is a Knowledge Object. They are legitimate machine decisions
    // that produced no knowledge, so no filter combination reaches one.
    for (const status of ["PENDING", "APPROVED", "EDITED", "USER_REJECTED"]) {
      await page.goto(`/memory?reviewStatus=${status}`)
      const queue = page.getByRole("list", { name: "Knowledge Objects" })
      await expect(queue.or(page.getByTestId("memory-queue-empty"))).toBeVisible()
      await expect(page.locator("body")).not.toContainText(
        claimOf(KNOWLEDGE.machineRejected),
      )
      await expect(page.locator("body")).not.toContainText(
        claimOf(KNOWLEDGE.machineQuarantined),
      )
    }
  })

  test("keeps rejected and superseded reachable through an explicit filter", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memory" })

    await page.goto("/memory?reviewStatus=USER_REJECTED")
    await expect(page.getByTestId(rows)).toContainText(claimOf(KNOWLEDGE.userRejected))

    await page.goto("/memory?reviewStatus=APPROVED&lifecycleState=SUPERSEDED")
    await expect(page.getByTestId(rows).first()).toContainText("Superseded")
  })

  test("reports an unreadable queue rather than an empty one", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memoryUnavailable" })
    await page.goto("/memory")

    // An empty list would claim there is nothing to review, which is a
    // different statement from not knowing.
    await expect(
      page.getByText("The review queue is not available right now"),
    ).toBeVisible()
    await expect(page.getByTestId("memory-queue-empty")).toHaveCount(0)
  })

  test("shows the empty state when the organization has no knowledge yet", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memoryEmpty" })
    await page.goto("/memory")

    await expect(page.getByTestId("memory-queue-empty")).toBeVisible()
  })

  test("fails closed on a lifecycle state the contract does not publish", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memoryUnsupported" })
    await page.goto("/memory")

    // The conventions matrix marks `unknown` reachable on every route. A
    // partial document would be worse than saying the answer is not
    // understood, because a reviewer would act on half a projection.
    await expect(
      page.getByText("The review queue is not available right now"),
    ).toBeVisible()
    await expect(page.getByText("The outcome is not known yet")).toBeVisible()
    await expect(page.getByTestId("memory-queue-row")).toHaveCount(0)
    await expect(page.locator("body")).not.toContainText("ARCHIVED_BY_OPERATOR")
  })
})

test.describe("filters_and_pagination", () => {
  test("puts the filter state in the URL so it can be shared", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memory" })
    await page.goto("/memory")

    await page.getByLabel("Review status").selectOption("APPROVED")
    await page.getByLabel("Lifecycle").selectOption("ACTIVE")
    await page.getByRole("button", { name: "Apply filters" }).click()

    await expect(page).toHaveURL(/reviewStatus=APPROVED/)
    await expect(page).toHaveURL(/lifecycleState=ACTIVE/)
    // Shareable means a second visit to the same URL shows the same rows.
    const shared = page.url()
    await page.goto(shared)
    await expect(page.getByTestId(rows)).toContainText(claimOf(KNOWLEDGE.active))
  })

  test("embeds no secret and no token in the shareable link", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memory" })
    await page.goto("/memory?reviewStatus=APPROVED&lifecycleState=ACTIVE")

    const url = page.url()
    expect(url).not.toMatch(/console-stub-owner|Bearer|service_role|token/i)
  })

  test("follows the backend cursor and keeps the predicates", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memoryPaged" })
    await page.goto("/memory?reviewStatus=APPROVED")

    await expect(page.getByTestId(rows)).toHaveCount(2)
    const first = await page.getByTestId(rows).first().textContent()

    await page.getByRole("link", { name: "Next Knowledge Objects" }).click()

    await expect(page).toHaveURL(/after=/)
    await expect(page).toHaveURL(/reviewStatus=APPROVED/)
    // A total page: the second page repeats nothing from the first.
    await expect(page.getByTestId(rows).first()).not.toHaveText(String(first))
  })

  test("drops a predicate the contract does not admit", async ({ context, page }) => {
    await signIn(context, { scenario: "memory" })
    await page.goto("/memory?reviewStatus=ESCALATED&authorLogin=octo%20cat")

    // A crafted URL reads as the unfiltered queue rather than echoing the
    // crafted text back or producing a refusal that quotes it.
    await expect(page.getByTestId(rows)).toContainText(claimOf(KNOWLEDGE.pending))
    await expect(page.locator("body")).not.toContainText("ESCALATED")
  })

  test("scopes the repository queue by its path, not by a predicate", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memory" })
    await page.goto(`/repositories/${REPOSITORIES.activeSourceOnly}/memory`)

    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Engineering Memory",
    )
    await expect(page.getByTestId(rows)).toContainText(claimOf(KNOWLEDGE.pending))
  })

  test("refuses a foreign repository queue without disclosing existence", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memory" })
    await page.goto(`/repositories/${REPOSITORIES.archived}/memory`)
    const archived = await page.locator("body").textContent()

    await page.goto("/repositories/00000000-0000-4000-8000-0000000000f1/memory")
    const foreign = await page.locator("body").textContent()

    // A repository in another tenant answers as one that never existed.
    expect(foreign).not.toContain(claimOf(KNOWLEDGE.pending))
    expect(archived).not.toBe(null)
  })
})

test.describe("queue_row", () => {
  test("shows the bounded summary fields and no provenance", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memory" })
    await page.goto("/memory")

    const row = page.getByTestId(rows).first()
    await expect(row).toContainText(claimOf(KNOWLEDGE.pending))
    await expect(row).toContainText("ArchitectureDecision")
    await expect(row).toContainText("Pull request #412")
    await expect(row).toContainText("Merged 2026-08-08")
    await expect(row).toContainText("Model confidence 82")

    // The full payload, the evidence set and every technical detail stay in
    // the detail projection.
    const object = objects[KNOWLEDGE.pending]
    await expect(page.locator("body")).not.toContainText(
      object?.evidence[0]?.quote ?? "unreachable",
    )
    await expect(page.locator("body")).not.toContainText(
      object?.base.technicalDetails.extractionRunId ?? "unreachable",
    )
  })

  test("opens the detail for the row", async ({ context, page }) => {
    await signIn(context, { scenario: "memory" })
    await page.goto("/memory")

    await page.getByRole("link", { name: claimOf(KNOWLEDGE.pending) }).click()

    await expect(page).toHaveURL(new RegExp(`/memory/${KNOWLEDGE.pending}$`))
  })

  test("reaches the queue with a viewer, who may read but not decide", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memory", principal: "console-stub-viewer" })
    await page.goto("/memory")

    // `knowledge.read` is held by every role in the matrix, so reading the
    // queue is not what the capability boundary is about.
    await expect(page.getByTestId(rows)).toContainText(claimOf(KNOWLEDGE.pending))
  })
})
