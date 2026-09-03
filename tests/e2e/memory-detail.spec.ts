import { expect, test } from "@playwright/test"

import {
  FOREIGN_KNOWLEDGE,
  KNOWLEDGE,
  KNOWLEDGE_OBJECTS,
} from "../../tools/console-stub/fixtures.mjs"
import { signIn } from "../support/session-fixture"

/**
 * Knowledge detail and evidence, owned by EEM-9/05.
 *
 * These carry the `memory-detail.spec.ts` coverage identifiers the
 * implementation plan names for `KD-001` to `KD-004`. The distinction they
 * exist to hold is that an edit is a derivative rather than a replacement: the
 * machine extraction stays on the screen whatever a reviewer did, and the
 * reviewer's words are labelled as the reviewer's.
 */

const objects = KNOWLEDGE_OBJECTS()
const detailOf = (id: string): string => `/memory/${id}`

test.describe("original_and_edit", () => {
  test("keeps the machine extraction on screen beside the derivative", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memory" })
    await page.goto(detailOf(KNOWLEDGE.edited))

    const original = page.getByTestId("knowledge-original")
    const edited = page.getByTestId("knowledge-edited")

    // Both reachable on the same screen. The original is not behind a
    // disclosure, a tab or a destructive action.
    await expect(original).toBeVisible()
    await expect(edited).toBeVisible()
    await expect(original).toContainText("never overwritten")
    await expect(edited).toContainText("Reviewer's edited derivative")
  })

  test("labels the derivative as the reviewer's and not as re-extracted", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memory" })
    await page.goto(detailOf(KNOWLEDGE.edited))

    await expect(page.getByTestId("knowledge-edited")).toContainText(
      "were not re-extracted from the source",
    )
  })

  test("shows no derivative when the backend says the object is not edited", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memory" })
    await page.goto(detailOf(KNOWLEDGE.approved))

    // `humanEdited` is the backend's fact. This object's history carries no
    // edit, so no derivative panel exists to compare payloads into being.
    await expect(page.getByTestId("knowledge-original")).toBeVisible()
    await expect(page.getByTestId("knowledge-edited")).toHaveCount(0)
  })

  test("says an edit exists rather than showing only the extraction", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memoryPartialProjection" })
    await page.goto(detailOf(KNOWLEDGE.edited))

    // The backend may legitimately report the object as edited and give no
    // payload to render, because `editedPayload` is optional. Showing only the
    // machine extraction would read as though the reviewer's words were lost.
    await expect(page.getByTestId("knowledge-states")).toContainText(
      "Edited by a reviewer",
    )
    await expect(page.getByTestId("knowledge-edited")).toHaveCount(0)
    await expect(page.getByTestId("knowledge-edited-unavailable")).toBeVisible()
    await expect(page.getByTestId("knowledge-original")).toBeVisible()
  })

  test("warns before a second edit starts from the extraction instead", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memoryPartialProjection" })
    await page.goto(detailOf(KNOWLEDGE.edited))

    // Prefilling from the machine extraction without saying so is the silent
    // discard the effective-payload prefill exists to prevent.
    await expect(page.getByTestId("review-edit-derivative-unavailable")).toBeVisible()
    await expect(page.getByTestId("review-edit")).toContainText(
      "will not carry their words forward",
    )
  })

  test("says so when the available decisions could not be determined", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memoryPartialProjection" })
    await page.goto(detailOf(KNOWLEDGE.pending))

    // `review` is optional and is the only source of `allowedActions`. Its
    // absence must not be reported as the object's own state permitting
    // nothing, which is a different and answerable situation.
    await expect(page.getByTestId("review-actions-undetermined")).toBeVisible()
    await expect(page.getByTestId("review-actions-none")).toHaveCount(0)
    await expect(page.getByTestId("review-approve")).toHaveCount(0)
    // The rest of the page still works.
    await expect(page.getByTestId("knowledge-original")).toBeVisible()
    await expect(page.getByTestId("knowledge-evidence-item")).toHaveCount(2)
  })

  test("renders no empty section for a field the payload does not carry", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memory" })
    await page.goto(detailOf(KNOWLEDGE.pending))

    // `KD-001` forbids invented empty sections, so a heading appears only
    // where a value does.
    const original = page.getByTestId("knowledge-original")
    await expect(original).toContainText("Design rationale")
    await expect(original).not.toContainText("Evidence basis")
  })

  test("keeps review and lifecycle readable as two separate states", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memory" })
    await page.goto(detailOf(KNOWLEDGE.active))

    const states = page.getByTestId("knowledge-states")
    await expect(states).toContainText("Human review")
    await expect(states).toContainText("Approved")
    await expect(states).toContainText("Lifecycle")
    await expect(states).toContainText("Active")
    await expect(states).toContainText("Yes, retrieval can return this")
  })

  test("says an unresolved object is not in trusted memory", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memory" })
    await page.goto(detailOf(KNOWLEDGE.approved))

    await expect(page.getByTestId("knowledge-states")).toContainText(
      "No, retrieval cannot return this",
    )
  })
})

test.describe("evidence_before_action", () => {
  test("shows the exact quote with its attribution", async ({ context, page }) => {
    await signIn(context, { scenario: "memory" })
    await page.goto(detailOf(KNOWLEDGE.pending))

    const quote = objects[KNOWLEDGE.pending]?.evidence[0]?.quote ?? "unreachable"
    const evidence = page.getByTestId("knowledge-evidence")

    await expect(evidence).toContainText(quote)
    await expect(evidence).toContainText("octocat")
    await expect(evidence).toContainText("pull_request_review_comment")
  })

  test("places the evidence above every review control", async ({ context, page }) => {
    await signIn(context, { scenario: "memory" })
    await page.goto(detailOf(KNOWLEDGE.pending))

    // `KD-002` requires the attribution to be readable before a decision, so
    // the ordering in the document is the acceptance row, not a preference.
    const evidenceBox = await page.getByTestId("knowledge-evidence").boundingBox()
    const technicalBox = await page.getByTestId("knowledge-technical").boundingBox()

    expect(evidenceBox?.y ?? 0).toBeLessThan(technicalBox?.y ?? 0)
  })

  test("publishes no source document, only the persisted quote", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memory" })
    await page.goto(detailOf(KNOWLEDGE.pending))

    const body = (await page.locator("body").textContent()) ?? ""
    // The Source Envelope body, the raw model response and every credential
    // are absent from the projection, so none can reach the document.
    expect(body).not.toMatch(/sourceEnvelope|rawModelResponse|service_role|Bearer /i)
  })

  test("links evidence only to a host the contract allowlists", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memory" })
    await page.goto(detailOf(KNOWLEDGE.pending))

    const links = page.getByTestId("knowledge-evidence").getByRole("link")
    for (const href of await links.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("href")),
    )) {
      expect(href).toMatch(/^https:\/\/github\.com\//)
    }
  })

  test("says the evidence is unavailable rather than claiming there is none", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memoryEvidenceUnavailable" })
    await page.goto(detailOf(KNOWLEDGE.pending))

    await expect(
      page.getByText("The evidence for this Knowledge Object is not available"),
    ).toBeVisible()
    await expect(page.getByTestId("knowledge-evidence-item")).toHaveCount(0)
    // The rest of the page stays usable.
    await expect(page.getByTestId("knowledge-original")).toBeVisible()
  })
})

test.describe("source_context", () => {
  test("shows the pull request, its author and its merge date", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memory" })
    await page.goto(detailOf(KNOWLEDGE.pending))

    const source = page.getByTestId("knowledge-source")
    await expect(source).toContainText("acme/payments-api")
    await expect(source).toContainText("#412")
    await expect(source).toContainText("Make knowledge review append-only")
    await expect(source).toContainText("octocat")
    await expect(source).toContainText("2026-08-08")
    await expect(
      source.getByRole("link", { name: "Open the pull request on GitHub" }),
    ).toHaveAttribute("href", /^https:\/\/github\.com\//)
  })

  test("answers a guessed identifier as one that never existed", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memory" })

    const foreign = await page.goto(detailOf(FOREIGN_KNOWLEDGE.knowledgeObject))
    const absent = await page.goto(detailOf("00000000-0000-4000-8000-0000000009ff"))

    // A cross-tenant identifier must not disclose that the object exists, so
    // both answer identically.
    expect(foreign?.status()).toBe(absent?.status())
    expect(foreign?.status()).toBe(404)
  })

  test("answers a malformed identifier the same way", async ({ context, page }) => {
    await signIn(context, { scenario: "memory" })
    const response = await page.goto(detailOf("not-a-uuid"))

    // Anything else would tell a caller which identifiers are well formed.
    expect(response?.status()).toBe(404)
  })

  test("fails closed on a lifecycle state the contract does not publish", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memoryUnsupported" })
    await page.goto(detailOf(KNOWLEDGE.pending))

    // Not a `404`: the object is the caller's and exists. The answer is one
    // the Console does not understand, and a partial document would let a
    // reviewer decide against half a projection.
    await expect(
      page.getByText("This Knowledge Object is not available right now"),
    ).toBeVisible()
    await expect(page.getByTestId("review-approve")).toHaveCount(0)
    await expect(page.locator("body")).not.toContainText("ARCHIVED_BY_OPERATOR")
  })

  test("never renders a machine-rejected or quarantined extraction", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memory" })

    for (const id of [KNOWLEDGE.machineRejected, KNOWLEDGE.machineQuarantined]) {
      const response = await page.goto(detailOf(id))
      // The backend serves the projection; the Console refuses to present it
      // as a Knowledge Object, which is the boundary this row exists for.
      expect(response?.status()).toBe(404)
      await expect(page.locator("body")).not.toContainText(
        objects[id]?.shortClaim ?? "unreachable",
      )
    }
  })
})

test.describe("technical_details", () => {
  test("collapses the customer-safe provenance behind a disclosure", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memory" })
    await page.goto(detailOf(KNOWLEDGE.pending))

    const technical = page.getByTestId("knowledge-technical")
    await expect(technical).toBeVisible()
    await technical.getByText("Technical details").click()

    const object = objects[KNOWLEDGE.pending]
    await expect(technical).toContainText(
      object?.base.technicalDetails.extractionRunId ?? "unreachable",
    )
    await expect(technical).toContainText("ACCEPTED by MODEL")
    await expect(technical).toContainText("evirion-extraction-standard")
    await expect(technical).toContainText("4120 ms")
    await expect(technical).toContainText("prompt 6140")
  })

  test("states the cost with its completeness and never as a bare amount", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memory" })
    await page.goto(detailOf(KNOWLEDGE.pending))

    await page.getByTestId("knowledge-technical").getByText("Technical details").click()
    await expect(page.getByTestId("knowledge-technical")).toContainText(
      "0.042000 USD, settled",
    )
  })

  test("never renders an unresolved cost as zero", async ({ context, page }) => {
    await signIn(context, { scenario: "memory" })
    // The chain objects carry a reserved cost, which is held and not settled.
    await page.goto(detailOf("00000000-0000-4000-8000-000000000214"))

    await page.getByTestId("knowledge-technical").getByText("Technical details").click()
    const technical = page.getByTestId("knowledge-technical")
    await expect(technical).toContainText("0.025000 USD held, not yet settled")
    await expect(technical).not.toContainText("0.000000 USD, settled")
  })

  test("reports the edit schema version beside the provenance", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memory" })
    await page.goto(detailOf(KNOWLEDGE.edited))

    await page.getByTestId("knowledge-technical").getByText("Technical details").click()
    await expect(page.getByTestId("knowledge-technical")).toContainText("Version 1")
  })

  test("exposes no credential, DSN or raw model response in the document", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memory" })
    await page.goto(detailOf(KNOWLEDGE.edited))

    const html = await page.content()
    expect(html).not.toMatch(/service_role|postgres(ql)?:\/\/|gh[pousr]_[A-Za-z0-9]/)
    expect(html).not.toContain("console-stub-owner")
  })
})
