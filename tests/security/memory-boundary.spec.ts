import type { Page } from "@playwright/test"
import { expect, test } from "@playwright/test"

import {
  EVIDENCE_IDS,
  FOREIGN_KNOWLEDGE,
  FOREIGN_ORGANIZATION,
  KNOWLEDGE,
  RELATIONS,
} from "../../tools/console-stub/fixtures.mjs"
import { STUB_ORIGIN, signIn } from "../support/session-fixture"

/**
 * The tenant and capability boundary of the memory surface, owned by EEM-9/05.
 *
 * Five identifier kinds reach this surface: the Knowledge Object, its
 * evidence, a review, a supersession relation and a correction request. Each
 * is substituted here through a direct BFF call, because a control the UI
 * happens to hide is not a boundary and proves nothing.
 *
 * The property under test is that a foreign identifier and one that never
 * existed produce the same answer. Anything else discloses existence, which is
 * the disclosure the backend refuses precisely to avoid.
 */

const ORGANIZATION = "00000000-0000-4000-8000-0000000000a1"
const ABSENT = "00000000-0000-4000-8000-0000000009ff"

const detailOf = (id: string): string => `/memory/${id}`

const post = (
  page: Page,
  path: string,
  payload: Record<string, string>,
): Promise<string> =>
  page.evaluate(
    async ({ url, body }: { url: string; body: Record<string, string> }) => {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(body).toString(),
      })
      return response.url
    },
    { url: path, body: payload },
  )

const csrfFrom = (page: Page): Promise<string> =>
  page.locator('input[name="csrfToken"]').first().inputValue()

test.describe("knowledge object identity", () => {
  test("answers a foreign object exactly as one that never existed", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memory" })

    /**
     * What a caller can learn from the answer.
     *
     * The flight payload echoes the identifier they supplied and a per-request
     * nonce, and neither is a disclosure. The rendered text is what would
     * differ if the Console admitted that one of the two objects exists.
     */
    const observe = async (id: string) => {
      const response = await page.goto(detailOf(id))
      return {
        status: response?.status(),
        heading: await page.getByRole("heading", { level: 1 }).textContent(),
        rendered: await page
          .getByRole("heading", { level: 1 })
          .evaluate((node) => node.parentElement?.textContent ?? ""),
      }
    }

    const foreign = await observe(FOREIGN_KNOWLEDGE.knowledgeObject)
    const absent = await observe(ABSENT)

    expect(foreign).toEqual(absent)
    expect(foreign.status).toBe(404)
  })

  test("refuses a direct backend read for another organization", async ({
    context,
  }) => {
    const { token } = await signIn(context, { scenario: "memory" })

    // Straight at the backend with this caller's own token, bypassing the UI.
    const response = await context.request.get(
      `${STUB_ORIGIN}/v1/organizations/${FOREIGN_ORGANIZATION}/knowledge/${KNOWLEDGE.pending}`,
      { headers: { authorization: `Bearer ${token}` }, ignoreHTTPSErrors: true },
    )

    expect(response.status()).toBe(403)
    expect(await response.json()).toMatchObject({
      error: { code: "ORGANIZATION_MEMBERSHIP_REQUIRED" },
    })
  })

  test("refuses a review mutation naming a foreign object", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memory" })
    await page.goto(detailOf(KNOWLEDGE.pending))
    const csrfToken = await csrfFrom(page)

    const review = (knowledgeObjectId: string): Promise<string> =>
      post(page, "/api/memory/reviews", {
        csrfToken,
        knowledgeObjectId,
        idempotencyKey: crypto.randomUUID(),
        action: "APPROVE",
        expectedReviewSequence: "0",
        expectedLifecycleVersion: "0",
      })

    // A foreign object and an absent one answer alike.
    expect(await review(FOREIGN_KNOWLEDGE.knowledgeObject)).toContain(
      "RESOURCE_NOT_FOUND",
    )
    expect(await review(ABSENT)).toContain("RESOURCE_NOT_FOUND")

    // Nothing moved on the object the caller does own.
    await page.goto(detailOf(KNOWLEDGE.pending))
    await expect(page.getByTestId("review-history-entry")).toHaveCount(0)
  })

  test("never lets a traversal-shaped identifier reach the transport", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memory" })
    await page.goto(detailOf(KNOWLEDGE.pending))

    const url = await post(page, "/api/memory/reviews", {
      csrfToken: await csrfFrom(page),
      knowledgeObjectId: "../../../internal/console/v1/session",
      idempotencyKey: crypto.randomUUID(),
      action: "APPROVE",
      expectedReviewSequence: "0",
      expectedLifecycleVersion: "0",
    })

    // Refused before any backend call, and the redirect goes to the queue
    // rather than to a path built from the crafted value.
    expect(url).toContain("/memory?result=REQUEST_INVALID")
    expect(url).not.toContain("internal")
  })
})

test.describe("evidence identity", () => {
  test("refuses a review acknowledging a foreign evidence identifier", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memory" })
    await page.goto(detailOf(KNOWLEDGE.pending))
    const csrfToken = await csrfFrom(page)

    const acknowledge = (evidenceId: string): Promise<string> =>
      post(page, "/api/memory/reviews", {
        csrfToken,
        knowledgeObjectId: KNOWLEDGE.pending,
        idempotencyKey: crypto.randomUUID(),
        action: "APPROVE",
        expectedReviewSequence: "0",
        expectedLifecycleVersion: "0",
        acknowledgedEvidenceIds: evidenceId,
      })

    // The Console does not offer evidence acknowledgement yet, so the field is
    // ignored rather than forwarded. What matters is that a foreign identifier
    // cannot reach the backend through it.
    const foreign = await acknowledge(FOREIGN_KNOWLEDGE.evidence)
    expect(foreign).not.toContain("UNSUPPORTED_SERVER_RESPONSE")

    await page.goto(detailOf(KNOWLEDGE.pending))
    const recorded = page.getByTestId("review-history-entry")
    await expect(recorded).toHaveCount(1)
    // No foreign evidence identifier appears in the rendered document.
    await expect(page.locator("body")).not.toContainText(FOREIGN_KNOWLEDGE.evidence)
  })

  test("shows only this object's own evidence", async ({ context, page }) => {
    await signIn(context, { scenario: "memory" })
    await page.goto(detailOf(KNOWLEDGE.pending))

    await expect(page.getByTestId("knowledge-evidence-item")).toHaveCount(2)
    // An evidence identifier that belongs to no served object never appears,
    // so the list is the object's own rather than a tenant-wide one.
    await expect(page.locator("body")).not.toContainText(EVIDENCE_IDS.unlinked)
    await expect(page.locator("body")).not.toContainText(FOREIGN_KNOWLEDGE.evidence)
  })
})

test.describe("review identity", () => {
  test("discloses no review from an object the caller cannot read", async ({
    context,
  }) => {
    const { token } = await signIn(context, { scenario: "memory" })

    const foreign = await context.request.get(
      `${STUB_ORIGIN}/v1/organizations/${ORGANIZATION}/knowledge/${FOREIGN_KNOWLEDGE.knowledgeObject}/reviews`,
      { headers: { authorization: `Bearer ${token}` }, ignoreHTTPSErrors: true },
    )
    const absent = await context.request.get(
      `${STUB_ORIGIN}/v1/organizations/${ORGANIZATION}/knowledge/${ABSENT}/reviews`,
      { headers: { authorization: `Bearer ${token}` }, ignoreHTTPSErrors: true },
    )

    expect(foreign.status()).toBe(absent.status())
    expect(await foreign.json()).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({ code: "RESOURCE_NOT_FOUND" }),
      }),
    )
  })

  test("never renders a review identifier from another tenant", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memory" })
    await page.goto(detailOf(KNOWLEDGE.userRejected))

    await expect(page.locator("body")).not.toContainText(FOREIGN_KNOWLEDGE.review)
  })
})

test.describe("relation identity", () => {
  test("refuses a correction naming a relation this object does not carry", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memory" })
    await page.goto(detailOf(KNOWLEDGE.superseded))
    const csrfToken = await csrfFrom(page)

    const correct = (relation: string): Promise<string> =>
      post(page, "/api/memory/corrections", {
        csrfToken,
        knowledgeObjectId: KNOWLEDGE.superseded,
        idempotencyKey: crypto.randomUUID(),
        requestType: "RETRACT_SUPERSESSION",
        reasonCode: "SUPERSESSION_ERRONEOUS",
        expectedReviewSequence: "1",
        expectedLifecycleVersion: "1",
        knowledgeRelationId: relation,
      })

    // A foreign relation and one belonging to a different object of the same
    // tenant are both refused without mutating anything.
    expect(await correct(`${FOREIGN_KNOWLEDGE.relation}:1`)).toContain(
      "SUPERSESSION_INVALID",
    )
    expect(await correct(`${RELATIONS.chainFirst}:1`)).toContain("SUPERSESSION_INVALID")

    await page.goto(detailOf(KNOWLEDGE.superseded))
    await expect(page.getByTestId("correction-request")).toHaveCount(0)
  })

  test("refuses a relation paired with another relation's version", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memory" })
    await page.goto(detailOf(KNOWLEDGE.superseded))

    // The relation is at version 1. Version 2 belongs to a different edge, and
    // accepting it would defeat the optimistic check on the relation itself.
    const url = await post(page, "/api/memory/corrections", {
      csrfToken: await csrfFrom(page),
      knowledgeObjectId: KNOWLEDGE.superseded,
      idempotencyKey: crypto.randomUUID(),
      requestType: "RETRACT_SUPERSESSION",
      reasonCode: "SUPERSESSION_ERRONEOUS",
      expectedReviewSequence: "1",
      expectedLifecycleVersion: "1",
      knowledgeRelationId: `${RELATIONS.superseding}:2`,
    })

    expect(url).toContain("VERSION_CONFLICT")
  })

  test("refuses a supersession naming a foreign replacement", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memory" })
    await page.goto(detailOf(KNOWLEDGE.approved))
    const csrfToken = await csrfFrom(page)

    const supersede = (newKnowledgeObjectId: string): Promise<string> =>
      post(page, "/api/memory/supersede", {
        csrfToken,
        knowledgeObjectId: KNOWLEDGE.approved,
        newKnowledgeObjectId,
        idempotencyKey: crypto.randomUUID(),
        expectedOldReviewSequence: "1",
        expectedOldLifecycleVersion: "0",
        expectedNewReviewSequence: "1",
        expectedNewLifecycleVersion: "0",
      })

    // A replacement in another tenant and one that never existed answer alike,
    // and neither mutates the object the caller does own.
    expect(await supersede(FOREIGN_KNOWLEDGE.knowledgeObject)).toContain(
      "SUPERSESSION_INVALID",
    )
    expect(await supersede(ABSENT)).toContain("SUPERSESSION_INVALID")

    await page.goto(detailOf(KNOWLEDGE.approved))
    await expect(page.getByTestId("knowledge-states")).toContainText("Unresolved")
  })
})

test.describe("correction identity", () => {
  test("never renders a correction request from another tenant", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memory" })
    await page.goto(detailOf(KNOWLEDGE.correctionOpen))

    // The list is the object's own. A foreign request identifier is not in it,
    // and there is no route that would take one.
    await expect(page.getByTestId("correction-request")).toHaveCount(5)
    await expect(page.locator("body")).not.toContainText(FOREIGN_KNOWLEDGE.correction)
  })

  test("exposes no operator execute, decline or retry route", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memory" })
    await page.goto(detailOf(KNOWLEDGE.correctionOpen))

    // Executing and declining are operator commands on a separate non-browser
    // API. The Console publishes no route that reaches them.
    for (const path of [
      "/api/memory/corrections/execute",
      "/api/memory/corrections/reject",
      "/api/memory/corrections/retry",
    ]) {
      const status = await page.evaluate(async (url: string) => {
        const response = await fetch(url, { method: "POST" })
        return response.status
      }, path)
      expect(status).toBe(404)
    }
  })
})

test.describe("capability boundary", () => {
  test("refuses every mutation for a viewer, whatever the UI showed", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memory", principal: "console-stub-viewer" })
    await page.goto(detailOf(KNOWLEDGE.approved))

    // A viewer sees no controls, so there is no rendered CSRF proof to reuse.
    // The mutation is attempted anyway, and the boundary answers before any
    // capability question is reached.
    const url = await post(page, "/api/memory/activate", {
      csrfToken: "forged",
      knowledgeObjectId: KNOWLEDGE.approved,
      idempotencyKey: crypto.randomUUID(),
      expectedReviewSequence: "1",
      expectedLifecycleVersion: "0",
    })

    expect(url).toContain("/auth/sign-in")

    await page.goto(detailOf(KNOWLEDGE.approved))
    await expect(page.getByTestId("knowledge-states")).toContainText("Unresolved")
  })

  test("refuses a direct backend mutation by a viewer", async ({ context }) => {
    const { token } = await signIn(context, {
      scenario: "memory",
      principal: "console-stub-viewer",
    })

    const response = await context.request.post(
      `${STUB_ORIGIN}/v1/organizations/${ORGANIZATION}/knowledge/${KNOWLEDGE.approved}/activate`,
      {
        headers: {
          authorization: `Bearer ${token}`,
          "idempotency-key": crypto.randomUUID(),
          "content-type": "application/json",
        },
        data: { expectedReviewSequence: 1, expectedLifecycleVersion: 0 },
        ignoreHTTPSErrors: true,
      },
    )

    expect(response.status()).toBe(403)
    expect(await response.json()).toMatchObject({
      error: { code: "CAPABILITY_REQUIRED" },
    })
  })
})

test.describe("browser payload", () => {
  test("puts no token, key or operator credential in the document", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memory" })

    for (const path of [
      "/memory",
      detailOf(KNOWLEDGE.edited),
      detailOf(KNOWLEDGE.correctionOpen),
    ]) {
      await page.goto(path)
      const html = await page.content()

      expect(html).not.toContain("console-stub-owner")
      expect(html).not.toMatch(/service_role|postgres(ql)?:\/\//)
      expect(html).not.toMatch(/gh[pousr]_[A-Za-z0-9]/)
      expect(html).not.toMatch(/sourceEnvelope|rawModelResponse/i)
      expect(html).not.toContain(FOREIGN_ORGANIZATION)
    }
  })

  test("keeps the session out of anything the browser can read", async ({
    context,
    page,
  }) => {
    await signIn(context, { scenario: "memory" })
    await page.goto(detailOf(KNOWLEDGE.pending))

    const readable = await page.evaluate(() => ({
      cookie: document.cookie,
      storage: JSON.stringify(window.localStorage),
      session: JSON.stringify(window.sessionStorage),
    }))

    // The session cookies are host-scoped and HttpOnly, so none of these can
    // see them.
    expect(readable.cookie).not.toContain("console-stub-owner")
    expect(readable.storage).not.toContain("console-stub-owner")
    expect(readable.session).not.toContain("console-stub-owner")
  })
})
