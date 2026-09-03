import type { Page } from "@playwright/test"
import { expect, test } from "@playwright/test"

import { KNOWLEDGE, KNOWLEDGE_OBJECTS } from "../../tools/console-stub/fixtures.mjs"
import { STUB_ORIGIN, signIn } from "../support/session-fixture"

/**
 * Human review and lifecycle, owned by EEM-9/05.
 *
 * These carry the `memory-review.spec.ts` coverage identifiers the
 * implementation plan names for `G-004`, `G-005`, `J-005`, `J-006`, `REV-001`
 * to `REV-005` and `LIFE-001` to `LIFE-005`.
 *
 * The distinctions under test are the ones the subtask exists for: a human
 * decision never changes the machine provenance, review and lifecycle move on
 * two independent axes, each optimistic token can go stale on its own, and a
 * committed command is reported as committed rather than as an unknown
 * outcome.
 */

const objects = KNOWLEDGE_OBJECTS()
const detailOf = (id: string): string => `/memory/${id}`

const ORGANIZATION = "00000000-0000-4000-8000-0000000000a1"

/**
 * Post to the BFF from inside the browser.
 *
 * Only Chromium resolves the Console hostname, and only the browser attaches
 * the host-scoped session cookies and the Fetch Metadata the mutation guard
 * requires. A Node-side request context would fail DNS before reaching any of
 * the boundary this is meant to exercise.
 */
const postToBff = (page: Page, payload: Record<string, string>): Promise<string> =>
  page.evaluate(async (body: Record<string, string>) => {
    const response = await fetch("/api/memory/reviews", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body).toString(),
    })
    return response.url
  }, payload)

/** The proof the proxy minted for this session, from whichever form carries it. */
const csrfFrom = (page: Page): Promise<string> =>
  page.locator('input[name="csrfToken"]').first().inputValue()

test.describe("approve_original", () => {
  test("records an approval and says the lifecycle did not move", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memory" })
    await page.goto(detailOf(KNOWLEDGE.pending))

    await page.getByRole("button", { name: "Approve the original" }).click()

    // A committed receipt, not a published error code. Routing it through the
    // shared reader would report an unknown outcome for a command that
    // changed state.
    await expect(
      page.getByTestId("knowledge-outcome-KNOWLEDGE_REVIEW_RECORDED"),
    ).toBeVisible()
    await expect(page.getByText("Your review is recorded.")).toBeVisible()
    await expect(page.getByTestId("knowledge-states")).toContainText("Approved")
    await expect(page.getByTestId("knowledge-states")).toContainText("Unresolved")
  })

  test("appends the decision to the history rather than replacing one", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memory" })
    await page.goto(detailOf(KNOWLEDGE.approved))

    const before = await page.getByTestId("review-history-entry").count()
    await page.getByRole("button", { name: "Record the edit" }).click()

    await expect(page.getByTestId("review-history-entry")).toHaveCount(before + 1)
    // The earlier decision is still there.
    await expect(page.getByTestId("review-history-entry").first()).toContainText(
      "Approved the original",
    )
  })

  test("replays a duplicate submission instead of recording twice", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memory" })
    await page.goto(detailOf(KNOWLEDGE.pending))

    // The rendered form carries one minted key. Submitting the same bytes
    // twice is the response-loss case, and it must not append two reviews.
    const form = page.getByTestId("review-approve")
    const payload = {
      csrfToken: await csrfFrom(page),
      knowledgeObjectId: KNOWLEDGE.pending,
      idempotencyKey: await form.locator('input[name="idempotencyKey"]').inputValue(),
      action: "APPROVE",
      expectedReviewSequence: "0",
      expectedLifecycleVersion: "0",
    }

    const first = await postToBff(page, payload)
    const second = await postToBff(page, payload)

    // Both land on the committed receipt, and only one review exists.
    expect(first).toContain("KNOWLEDGE_REVIEW_RECORDED")
    expect(second).toContain("KNOWLEDGE_REVIEW_RECORDED")

    await page.goto(detailOf(KNOWLEDGE.pending))
    await expect(page.getByTestId("review-history-entry")).toHaveCount(1)
  })

  test("offers no review control to a viewer", async ({ context, page }) => {
    await signIn(context, { scenario: "memory", principal: "console-stub-viewer" })
    await page.goto(detailOf(KNOWLEDGE.pending))

    // Hiding is a convenience. The refusal is still rendered, and the backend
    // refuses the request either way.
    await expect(page.getByTestId("review-actions-none")).toBeVisible()
    await expect(page.getByTestId("review-approve")).toHaveCount(0)
    await expect(page.getByTestId("review-edit")).toHaveCount(0)
  })
})

test.describe("edit_with_evidence_warning", () => {
  test("says the evidence was not re-extracted for the edited words", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memory" })
    await page.goto(detailOf(KNOWLEDGE.pending))

    await expect(page.getByTestId("review-edit")).toContainText(
      "The evidence is not re-extracted",
    )
  })

  test("keeps the machine extraction after an edit is recorded", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memory" })
    await page.goto(detailOf(KNOWLEDGE.pending))

    const original = objects[KNOWLEDGE.pending]?.base.originalPayload["knowledge"]
    await page
      .getByLabel("Knowledge", { exact: true })
      .fill("A reviewer's restatement of the same claim.")
    await page.getByRole("button", { name: "Record the edit" }).click()

    await expect(page.getByTestId("knowledge-edited")).toContainText(
      "A reviewer's restatement of the same claim.",
    )
    // The original is still on the page and still says what it always said.
    await expect(page.getByTestId("knowledge-original")).toContainText(String(original))
    await expect(page.getByTestId("knowledge-states")).toContainText(
      "Edited by a reviewer",
    )
  })

  test("accepts an edit whose lists are legitimately empty", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memory" })
    await page.goto(detailOf(KNOWLEDGE.pending))

    // The schema puts no lower bound on the seven arrays, so a claim that
    // documents no trade-off must be editable exactly like one that does.
    for (const label of [
      "Documented trade-offs",
      "Explicit alternatives",
      "Constraints",
      "Invariants",
      "Failure modes",
      "Affected systems",
      "Answerable questions",
    ]) {
      await page.getByLabel(label).fill("")
    }
    await page.getByRole("button", { name: "Record the edit" }).click()

    await expect(page.getByText("Your review is recorded.")).toBeVisible()
    await expect(page.getByTestId("knowledge-states")).toContainText(
      "Edited by a reviewer",
    )
  })

  test("starts a second edit from the current derivative, not the original", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memory" })
    await page.goto(detailOf(KNOWLEDGE.edited))

    // Prefilling from the machine extraction would silently discard the words
    // the previous reviewer chose the moment a second edit is opened.
    const derivative =
      objects[KNOWLEDGE.edited]?.reviews.at(-1)?.editedPayload?.["knowledge"]
    await expect(
      page.getByTestId("review-edit").getByLabel("Knowledge", { exact: true }),
    ).toHaveValue(String(derivative))
  })

  test("lets a reviewer change the classification the contract allows", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memory" })
    await page.goto(detailOf(KNOWLEDGE.pending))

    // `REV-002` lists both enums among the thirteen editable keys, so neither
    // is carried through as a fixed hidden value.
    await page.getByLabel("Knowledge type").selectOption("SecurityBehavior")
    await page.getByLabel("Implementation status").selectOption("proposed")
    await page.getByRole("button", { name: "Record the edit" }).click()

    await expect(page.getByText("Your review is recorded.")).toBeVisible()
    await expect(page.getByTestId("knowledge-edited")).toContainText("SecurityBehavior")
  })

  test("refuses an incomplete derivative rather than completing it", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memory" })
    await page.goto(detailOf(KNOWLEDGE.pending))

    // `REV-002` defines an edit as a full reviewed derivative. A partial body
    // is refused here rather than completed with a value this route invented.
    const url = await postToBff(page, {
      csrfToken: await csrfFrom(page),
      knowledgeObjectId: KNOWLEDGE.pending,
      idempotencyKey: await page
        .getByTestId("review-edit")
        .locator('input[name="idempotencyKey"]')
        .inputValue(),
      action: "EDIT",
      expectedReviewSequence: "0",
      expectedLifecycleVersion: "0",
      issueSeverity: "MINOR",
      knowledge: "Only one field",
    })

    expect(url).toContain("REQUEST_INVALID")
    await page.goto(detailOf(KNOWLEDGE.pending))
    await expect(page.getByTestId("review-history-entry")).toHaveCount(0)
  })
})

test.describe("reject_reason", () => {
  test("records a structured reason and a severity", async ({ context, page }) => {
    await signIn(context, { scenario: "memory" })
    await page.goto(detailOf(KNOWLEDGE.pending))

    await page.getByLabel("Reason").selectOption("TOO_VAGUE")
    await page
      .getByTestId("review-reject")
      .getByLabel("Issue severity")
      .selectOption("MAJOR")
    await page.getByRole("button", { name: "Reject", exact: true }).click()

    await expect(page.getByText("Your review is recorded.")).toBeVisible()
    await expect(page.getByTestId("review-history-entry")).toContainText("TOO_VAGUE")
    await expect(page.getByTestId("review-history-entry")).toContainText("MAJOR")
  })

  test("keeps the original knowledge and its evidence after a rejection", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memory" })
    await page.goto(detailOf(KNOWLEDGE.pending))
    const quote = objects[KNOWLEDGE.pending]?.evidence[0]?.quote ?? "unreachable"

    await page.getByLabel("Reason").selectOption("INCORRECT")
    await page.getByRole("button", { name: "Reject", exact: true }).click()

    // A rejection is a human decision. It changes no machine provenance.
    await expect(page.getByTestId("knowledge-original")).toBeVisible()
    await expect(page.getByTestId("knowledge-evidence")).toContainText(quote)
    await expect(page.getByTestId("knowledge-states")).toContainText(
      "Rejected by a reviewer",
    )
  })

  test("refuses a reason the contract does not publish", async ({ context, page }) => {
    await signIn(context, { scenario: "memory" })
    await page.goto(detailOf(KNOWLEDGE.pending))

    const url = await postToBff(page, {
      csrfToken: await csrfFrom(page),
      knowledgeObjectId: KNOWLEDGE.pending,
      idempotencyKey: await page
        .getByTestId("review-reject")
        .locator('input[name="idempotencyKey"]')
        .inputValue(),
      action: "USER_REJECT",
      expectedReviewSequence: "0",
      expectedLifecycleVersion: "0",
      rejectReasonCode: "BECAUSE_I_SAID_SO",
      issueSeverity: "MINOR",
    })

    expect(url).toContain("REQUEST_INVALID")
  })

  test("offers no normal reject once the object is active", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memory" })
    await page.goto(detailOf(KNOWLEDGE.active))

    // `12.1`: normal Reject exists only while the lifecycle is unresolved.
    // Correcting an active object is the operator workflow instead.
    await expect(page.getByTestId("review-reject")).toHaveCount(0)
    await expect(page.getByTestId("review-edit")).toBeVisible()
  })
})

test.describe("stale_review_conflict", () => {
  /** An edit against the approved object, with exactly one token disturbed. */
  const submit = async (
    page: Page,
    tokens: { review: string; lifecycle: string },
  ): Promise<string> =>
    postToBff(page, {
      csrfToken: await csrfFrom(page),
      knowledgeObjectId: KNOWLEDGE.approved,
      idempotencyKey: crypto.randomUUID(),
      action: "EDIT",
      expectedReviewSequence: tokens.review,
      expectedLifecycleVersion: tokens.lifecycle,
      issueSeverity: "MINOR",
      ...Object.fromEntries(
        Object.entries(
          KNOWLEDGE_OBJECTS()[KNOWLEDGE.approved]?.base.originalPayload ?? {},
        ).map(([key, value]) => [
          key,
          Array.isArray(value) ? value.join("\n") : String(value),
        ]),
      ),
    })

  test("reports a stale review sequence on its own", async ({ context, page }) => {
    await signIn(context, { scenario: "memory" })
    await page.goto(detailOf(KNOWLEDGE.approved))

    // The object is at review sequence 1 and lifecycle version 0. Only the
    // review token is wrong.
    expect(await submit(page, { review: "0", lifecycle: "0" })).toContain(
      "REVIEW_VERSION_CONFLICT",
    )
  })

  test("reports a stale lifecycle version on its own", async ({ context, page }) => {
    await signIn(context, { scenario: "memory" })
    await page.goto(detailOf(KNOWLEDGE.approved))

    // Only the lifecycle token is wrong. The two go stale independently, so
    // one conflicting must not be reported as the other.
    expect(await submit(page, { review: "1", lifecycle: "7" })).toContain(
      "LIFECYCLE_VERSION_CONFLICT",
    )
  })

  test("records nothing when either token is stale", async ({ context, page }) => {
    await signIn(context, { scenario: "memory" })
    await page.goto(detailOf(KNOWLEDGE.approved))
    const before = await page.getByTestId("review-history-entry").count()

    await submit(page, { review: "0", lifecycle: "0" })
    await submit(page, { review: "1", lifecycle: "7" })

    await page.goto(detailOf(KNOWLEDGE.approved))
    await expect(page.getByTestId("review-history-entry")).toHaveCount(before)
  })

  test("explains a conflict as something to reload rather than as a failure", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memory" })
    await page.goto(`${detailOf(KNOWLEDGE.approved)}?result=REVIEW_VERSION_CONFLICT`)

    await expect(
      page.getByText("This changed while you were working. Reload and try again."),
    ).toBeVisible()
  })

  test("forwards a token the page rendered and never one it invented", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memory" })
    await page.goto(detailOf(KNOWLEDGE.pending))

    const form = page.getByTestId("review-approve")
    // Sequence zero is PENDING and version zero is UNRESOLVED. Both must be
    // present as themselves rather than omitted for being falsy.
    await expect(form.locator('input[name="expectedReviewSequence"]')).toHaveValue("0")
    await expect(form.locator('input[name="expectedLifecycleVersion"]')).toHaveValue(
      "0",
    )
  })
})

test.describe("revert_is_explicit", () => {
  test("offers no generic approve on an edited object", async ({ context, page }) => {
    await signIn(context, { scenario: "memory" })
    await page.goto(detailOf(KNOWLEDGE.edited))

    // `REV-005`: an edit is already a completed human decision, so there is no
    // generic edited-to-approved transition that would discard it silently.
    await expect(page.getByTestId("review-approve")).toHaveCount(0)
    await expect(page.getByTestId("review-revert")).toBeVisible()
  })

  test("says the edit is kept when reverting", async ({ context, page }) => {
    await signIn(context, { scenario: "memory" })
    await page.goto(detailOf(KNOWLEDGE.edited))

    await expect(page.getByTestId("review-revert")).toContainText(
      "The earlier edit is kept in the history and is not deleted",
    )
  })

  test("appends the revert and keeps the edit in the timeline", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memory" })
    await page.goto(detailOf(KNOWLEDGE.edited))
    const before = await page.getByTestId("review-history-entry").count()

    await page
      .getByRole("button", { name: "Revert to the original and approve" })
      .click()

    await expect(page.getByTestId("review-history-entry")).toHaveCount(before + 1)
    await expect(page.getByTestId("review-history")).toContainText(
      "Recorded an edited derivative",
    )
    await expect(page.getByTestId("review-history")).toContainText(
      "Reverted to the original and approved",
    )
    // The derivative panel is gone because the effective review is no longer
    // an edit, and the machine extraction is where it always was.
    await expect(page.getByTestId("knowledge-edited")).toHaveCount(0)
    await expect(page.getByTestId("knowledge-original")).toBeVisible()
  })

  test("renders the history as a timeline with no delete and no amend", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memory" })
    await page.goto(detailOf(KNOWLEDGE.userRejected))

    const history = page.getByTestId("review-history")
    // Thirteen appended decisions, oldest first, none of them editable.
    await expect(page.getByTestId("review-history-entry")).toHaveCount(13)
    await expect(history).toContainText("Sequence 1 on")
    await expect(history).toContainText("Sequence 13 on")
    await expect(history.getByRole("button")).toHaveCount(0)
  })
})

test.describe("unresolved_state", () => {
  test("LIFE-001: an object with no lifecycle event is unresolved", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memory" })
    await page.goto(detailOf(KNOWLEDGE.pending))

    // Derived from the absence of an event, not stored, and not unknown.
    await expect(page.getByTestId("knowledge-states")).toContainText("Unresolved")
    await expect(page.getByTestId("knowledge-states")).toContainText(
      "No, retrieval cannot return this",
    )
  })

  test("offers no lifecycle action before the object is reviewed", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memory" })
    await page.goto(detailOf(KNOWLEDGE.pending))

    // `LIFE-002` requires a current APPROVED or EDITED review, so a pending
    // object has nothing to activate and the backend says so.
    await expect(page.getByTestId("lifecycle-actions-none")).toBeVisible()
    await expect(page.getByTestId("lifecycle-activate")).toHaveCount(0)
  })

  test("keeps lifecycle unmoved when a review is recorded", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memory" })
    await page.goto(detailOf(KNOWLEDGE.pending))

    await page.getByRole("button", { name: "Approve the original" }).click()

    // The two axes are independent: approving does not activate.
    await expect(page.getByTestId("knowledge-states")).toContainText("Approved")
    await expect(page.getByTestId("knowledge-states")).toContainText("Unresolved")
  })

  test("offers no lifecycle action to a viewer", async ({ context, page }) => {
    await signIn(context, { scenario: "memory", principal: "console-stub-viewer" })
    await page.goto(detailOf(KNOWLEDGE.approved))

    await expect(page.getByTestId("lifecycle-actions-none")).toBeVisible()
    await expect(page.getByTestId("lifecycle-activate")).toHaveCount(0)
  })
})

test.describe("mark_active", () => {
  test("LIFE-002: activating puts the object in trusted memory", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memory" })
    await page.goto(detailOf(KNOWLEDGE.approved))

    await page.getByRole("button", { name: "Mark active" }).click()

    await expect(
      page.getByTestId("knowledge-outcome-KNOWLEDGE_MARKED_ACTIVE"),
    ).toBeVisible()
    await expect(page.getByTestId("knowledge-states")).toContainText("Active")
    await expect(page.getByTestId("knowledge-states")).toContainText(
      "Yes, retrieval can return this",
    )
  })

  test("leaves the review state untouched", async ({ context, page }) => {
    await signIn(context, { scenario: "memory" })
    await page.goto(detailOf(KNOWLEDGE.approved))
    const before = await page.getByTestId("review-history-entry").count()

    await page.getByRole("button", { name: "Mark active" }).click()

    await expect(page.getByTestId("review-history-entry")).toHaveCount(before)
    await expect(page.getByTestId("knowledge-states")).toContainText("Approved")
  })

  test("states that the action may require signing in again", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memory" })
    await page.goto(detailOf(KNOWLEDGE.approved))

    // The contract names recent reauthentication as a precondition on this
    // operation. No session field reports whether it is satisfied, so the
    // control states the precondition rather than claiming to know.
    await expect(
      page.getByTestId("lifecycle-activate").getByTestId("lifecycle-reauth-notice"),
    ).toBeVisible()
  })

  test("refuses a stale lifecycle version and records nothing", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memory" })
    await page.goto(detailOf(KNOWLEDGE.approved))

    const url = await page.evaluate(
      async (payload: Record<string, string>) => {
        const response = await fetch("/api/memory/activate", {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams(payload).toString(),
        })
        return response.url
      },
      {
        csrfToken: await csrfFrom(page),
        knowledgeObjectId: KNOWLEDGE.approved,
        idempotencyKey: crypto.randomUUID(),
        expectedReviewSequence: "1",
        expectedLifecycleVersion: "9",
      },
    )

    expect(url).toContain("LIFECYCLE_VERSION_CONFLICT")
    await page.goto(detailOf(KNOWLEDGE.approved))
    await expect(page.getByTestId("knowledge-states")).toContainText("Unresolved")
  })
})

test.describe("supersede_direction", () => {
  test("LIFE-003: states NEW supersedes OLD in words before recording", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memory" })
    await page.goto(detailOf(KNOWLEDGE.approved))

    await page
      .getByLabel("Replacement")
      .selectOption(objects[KNOWLEDGE.active]?.base.knowledgeObjectId ?? "")
    await page.getByRole("button", { name: "Review the direction" }).click()

    // The direction is stated, not implied by layout or by field order.
    const direction = page.getByTestId("supersede-direction")
    await expect(direction).toBeVisible()
    await expect(direction).toContainText("supersedes")
    await expect(direction).toContainText(
      objects[KNOWLEDGE.approved]?.base.knowledge ?? "",
    )
  })

  test("records the relation and does not activate the newer object", async ({
    context,
    page,
  }) => {
    const session = await signIn(context, { scenario: "memory" })
    await page.goto(detailOf(KNOWLEDGE.approved))

    await page.getByLabel("Replacement").selectOption(KNOWLEDGE.active)
    await page.getByRole("button", { name: "Review the direction" }).click()
    await page
      .getByRole("button", {
        name: "Record that the newer object supersedes this one",
      })
      .click()

    await expect(
      page.getByTestId("knowledge-outcome-KNOWLEDGE_MARKED_SUPERSEDED"),
    ).toBeVisible()
    await expect(page.getByTestId("knowledge-states")).toContainText("Superseded")

    // The newer object keeps whatever lifecycle it already had. Supersession
    // is not an activation.
    const newer = await context.request.get(
      `${STUB_ORIGIN}/v1/organizations/${ORGANIZATION}/knowledge/${KNOWLEDGE.active}/lifecycle-state`,
      {
        headers: { authorization: `Bearer ${session.token}` },
        ignoreHTTPSErrors: true,
      },
    )
    expect((await newer.json()).data.lifecycleState).toBe("ACTIVE")
  })

  test("carries four tokens, two per object, all rendered on the confirm step", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memory" })
    await page.goto(`${detailOf(KNOWLEDGE.approved)}?supersedeWith=${KNOWLEDGE.active}`)

    const form = page.getByTestId("lifecycle-supersede-confirm")
    await expect(form.locator('input[name="expectedOldReviewSequence"]')).toHaveValue(
      "1",
    )
    await expect(form.locator('input[name="expectedOldLifecycleVersion"]')).toHaveValue(
      "0",
    )
    await expect(form.locator('input[name="expectedNewReviewSequence"]')).toHaveValue(
      "1",
    )
    await expect(form.locator('input[name="expectedNewLifecycleVersion"]')).toHaveValue(
      "1",
    )
  })

  test("refuses a relation that would close a cycle, without mutating", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memory" })
    const fourth = "00000000-0000-4000-8000-000000000214"
    const third = "00000000-0000-4000-8000-000000000213"
    await page.goto(`${detailOf(fourth)}?supersedeWith=${third}`)

    await page
      .getByRole("button", {
        name: "Record that the newer object supersedes this one",
      })
      .click()

    await expect(page).toHaveURL(/SUPERSESSION_INVALID/)
    await expect(page.getByTestId("knowledge-states")).toContainText("Unresolved")
  })

  test("fails closed when the graph walk exhausts its bound", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memory" })
    const fourth = "00000000-0000-4000-8000-000000000214"
    const first = "00000000-0000-4000-8000-000000000211"
    await page.goto(`${detailOf(fourth)}?supersedeWith=${first}`)

    await page
      .getByRole("button", {
        name: "Record that the newer object supersedes this one",
      })
      .click()

    // Exhausting the bound is a refusal with no mutation, not a partial write.
    await expect(page).toHaveURL(/SUPERSESSION_TRAVERSAL_LIMIT/)
    await expect(page.getByTestId("knowledge-states")).toContainText("Unresolved")
  })

  test("refuses superseding an object by itself", async ({ context, page }) => {
    await signIn(context, { scenario: "memory" })
    await page.goto(`${detailOf(KNOWLEDGE.approved)}?supersedeWith=${KNOWLEDGE.active}`)

    const url = await page.evaluate(
      async (payload: Record<string, string>) => {
        const response = await fetch("/api/memory/supersede", {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams(payload).toString(),
        })
        return response.url
      },
      {
        csrfToken: await csrfFrom(page),
        knowledgeObjectId: KNOWLEDGE.approved,
        newKnowledgeObjectId: KNOWLEDGE.approved,
        idempotencyKey: crypto.randomUUID(),
        expectedOldReviewSequence: "1",
        expectedOldLifecycleVersion: "0",
        expectedNewReviewSequence: "1",
        expectedNewLifecycleVersion: "0",
      },
    )

    expect(url).toContain("REQUEST_INVALID")
  })
})

test.describe("correction_history", () => {
  test("LIFE-005: shows every request status without an operator control", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memory" })
    await page.goto(detailOf(KNOWLEDGE.correctionOpen))

    const requests = page.getByTestId("correction-request")
    await expect(requests).toHaveCount(5)

    // The customer creates and reads. Executing, declining and retrying are
    // Evirion operations, so this is a status list and not an action list.
    await expect(
      page.getByTestId("correction-requests").getByRole("button"),
    ).toHaveCount(0)
    await expect(
      page.getByRole("button", { name: /execute|decline|retry/i }),
    ).toHaveCount(0)
  })

  test("shows a failed request as bounded support status", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memory" })
    await page.goto(detailOf(KNOWLEDGE.correctionOpen))

    const failed = page.locator(
      '[data-testid="correction-request"][data-status="FAILED"]',
    )
    await expect(failed).toContainText("Needs Evirion support")
    await expect(failed).toContainText("DEPENDENCY_UNAVAILABLE")
    await expect(failed).toContainText("nothing to retry here")
  })

  test("renders the append-only request history with both actor kinds", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memory" })
    await page.goto(detailOf(KNOWLEDGE.correctionOpen))

    const executed = page.locator(
      '[data-testid="correction-request"][data-status="EXECUTED"]',
    )
    await executed.getByText("Request history").click()

    await expect(executed.getByTestId("correction-history-entry")).toHaveCount(3)
    await expect(executed).toContainText("by you")
    await expect(executed).toContainText("by Evirion")
  })

  test("names no operator anywhere in the document", async ({ context, page }) => {
    await signIn(context, { scenario: "memory" })
    await page.goto(detailOf(KNOWLEDGE.correctionOpen))

    const body = (await page.locator("body").textContent()) ?? ""
    expect(body).not.toMatch(/operator[A-Za-z]*@|decidedBy|operatorUserId/i)
  })

  test("creates a request and reports that nothing has changed yet", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memory" })
    await page.goto(detailOf(KNOWLEDGE.superseded))

    await page.getByLabel("What should change").selectOption("RETRACT_SUPERSESSION")
    await page.getByLabel("Which supersession").selectOption({ index: 1 })
    await page.getByLabel("Reason").selectOption("SUPERSESSION_ERRONEOUS")
    await page.getByRole("button", { name: "Send the request to Evirion" }).click()

    await expect(
      page.getByTestId("knowledge-outcome-KNOWLEDGE_CORRECTION_REQUESTED"),
    ).toBeVisible()
    await expect(page.getByText("Nothing has changed yet")).toBeVisible()
    // Still superseded: only an operator can apply the correction.
    await expect(page.getByTestId("knowledge-states")).toContainText("Superseded")
  })

  test("requires a note when the reason carries no meaning on its own", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memory" })
    await page.goto(detailOf(KNOWLEDGE.superseded))

    const url = await page.evaluate(
      async (payload: Record<string, string>) => {
        const response = await fetch("/api/memory/corrections", {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams(payload).toString(),
        })
        return response.url
      },
      {
        csrfToken: await csrfFrom(page),
        knowledgeObjectId: KNOWLEDGE.superseded,
        idempotencyKey: crypto.randomUUID(),
        requestType: "RESTORE_UNRESOLVED",
        reasonCode: "OTHER",
        expectedReviewSequence: "1",
        expectedLifecycleVersion: "1",
      },
    )

    expect(url).toContain("REQUEST_INVALID")
  })
})

test.describe("journey_supersede_old_knowledge", () => {
  test("J-006: open the old object, choose the newer one, confirm the direction", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memory" })
    await page.goto(detailOf(KNOWLEDGE.approved))

    await page.getByLabel("Replacement").selectOption(KNOWLEDGE.active)
    await page.getByRole("button", { name: "Review the direction" }).click()
    await expect(page.getByTestId("supersede-direction")).toContainText("supersedes")

    await page
      .getByRole("button", {
        name: "Record that the newer object supersedes this one",
      })
      .click()

    await expect(page.getByTestId("knowledge-states")).toContainText("Superseded")
    // The old object now names the relation in the direction the backend
    // stored it, and normal review actions are gone.
    await expect(page.getByTestId("review-reject")).toHaveCount(0)
    await expect(page.getByTestId("lifecycle-correction")).toBeVisible()
  })
})

test.describe("goal_lifecycle_is_independent", () => {
  test("G-005: lifecycle moves without a review, and review without lifecycle", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memory" })

    // One: a review with no lifecycle movement.
    await page.goto(detailOf(KNOWLEDGE.pending))
    await page.getByRole("button", { name: "Approve the original" }).click()
    await expect(page.getByTestId("knowledge-states")).toContainText("Approved")
    await expect(page.getByTestId("knowledge-states")).toContainText("Unresolved")

    // Two: a lifecycle movement with no review recorded.
    const before = await page.getByTestId("review-history-entry").count()
    await page.getByRole("button", { name: "Mark active" }).click()
    await expect(page.getByTestId("knowledge-states")).toContainText("Active")
    await expect(page.getByTestId("review-history-entry")).toHaveCount(before)

    // Three: an active object can still be reviewed again.
    await expect(page.getByTestId("review-edit")).toBeVisible()
    await page.getByRole("button", { name: "Record the edit" }).click()
    await expect(page.getByTestId("knowledge-states")).toContainText(
      "Edited by a reviewer",
    )
    await expect(page.getByTestId("knowledge-states")).toContainText("Active")
  })

  test("G-005: the two axes never share a word for two different facts", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memory" })
    await page.goto(detailOf(KNOWLEDGE.superseded))

    const states = page.getByTestId("knowledge-states")
    await expect(states).toContainText("Human review")
    await expect(states).toContainText("Approved")
    await expect(states).toContainText("Lifecycle")
    await expect(states).toContainText("Superseded")
  })
})

test.describe("journey_review_knowledge_object", () => {
  test("J-005: open, read the evidence, decide, and see the committed result", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memory" })
    await page.goto("/memory")

    await page
      .getByRole("link", { name: objects[KNOWLEDGE.pending]?.shortClaim ?? "" })
      .click()

    // The claim, its classification, its source and its exact evidence are all
    // readable before any decision is offered.
    await expect(page.getByTestId("knowledge-original")).toBeVisible()
    await expect(page.getByTestId("knowledge-source")).toContainText("#412")
    await expect(page.getByTestId("knowledge-evidence-item")).toHaveCount(2)

    await page.getByRole("button", { name: "Approve the original" }).click()

    await expect(page.getByText("Your review is recorded.")).toBeVisible()
    // Rendered from the re-read projection, not from the request.
    await expect(page.getByTestId("knowledge-states")).toContainText("Approved")
    await expect(page.getByTestId("review-history-entry")).toHaveCount(1)
  })
})

test.describe("goal_human_validation_preserves_machine_provenance", () => {
  test("G-004: no decision changes the extraction, its evidence or its run", async ({
    context,
    page,
  }) => {
    const session = await signIn(context, { scenario: "memory" })
    const before = await context.request.get(
      `${STUB_ORIGIN}/v1/organizations/${ORGANIZATION}/knowledge/${KNOWLEDGE.pending}`,
      {
        headers: { authorization: `Bearer ${session.token}` },
        ignoreHTTPSErrors: true,
      },
    )
    const original = (await before.json()).data

    await page.goto(detailOf(KNOWLEDGE.pending))
    await page
      .getByLabel("Knowledge", { exact: true })
      .fill("A reviewer's own restatement.")
    await page.getByRole("button", { name: "Record the edit" }).click()
    await expect(page.getByText("Your review is recorded.")).toBeVisible()

    const after = await context.request.get(
      `${STUB_ORIGIN}/v1/organizations/${ORGANIZATION}/knowledge/${KNOWLEDGE.pending}`,
      {
        headers: { authorization: `Bearer ${session.token}` },
        ignoreHTTPSErrors: true,
      },
    )
    const updated = (await after.json()).data

    // The one thing a human decision may move is the review projection.
    expect(updated.originalPayload).toEqual(original.originalPayload)
    expect(updated.technicalDetails).toEqual(original.technicalDetails)
    expect(updated.sourceContext).toEqual(original.sourceContext)
    expect(updated.humanEdited).toBe(true)
    expect(original.humanEdited).toBe(false)
  })

  test("G-004: the evidence set is unchanged by an edit", async ({ context, page }) => {
    await signIn(context, { scenario: "memory" })
    await page.goto(detailOf(KNOWLEDGE.pending))
    const quotes = await page.getByTestId("knowledge-evidence-item").allTextContents()

    await page.getByRole("button", { name: "Record the edit" }).click()
    await expect(page.getByText("Your review is recorded.")).toBeVisible()

    expect(await page.getByTestId("knowledge-evidence-item").allTextContents()).toEqual(
      quotes,
    )
  })
})
