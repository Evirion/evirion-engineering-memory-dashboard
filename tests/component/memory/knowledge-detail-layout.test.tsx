import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import type { KnowledgeDetail } from "@contracts/console"

import { REAUTHENTICATION_PRECONDITION_SUMMARY } from "@/components/auth/reauthentication-notice"
import {
  KnowledgeEvidenceList,
  KnowledgeSourceDisclosure,
} from "@/components/memory/knowledge-detail"
import { KnowledgePayloadDisclosure } from "@/components/memory/knowledge-payload"
import { LifecycleActions } from "@/components/memory/lifecycle-actions"
import { ReviewActions } from "@/components/memory/review-actions"
import { ReviewHistory } from "@/components/memory/review-history"
import { knowledgeControls } from "@/lib/knowledge/presentation"
import type { KnowledgeHistoryView, SupersessionContext } from "@/server/queries/knowledge"

import { KNOWLEDGE, KNOWLEDGE_OBJECTS } from "../../../tools/console-stub/fixtures.mjs"

/**
 * MEM-UX/04 — decision-first layout, disclosure defaults, and document order.
 */

const objects = KNOWLEDGE_OBJECTS()

const detailOf = (id: string, humanEdited = false): KnowledgeDetail => {
  const object = objects[id]
  if (object === undefined) {
    throw new Error(`Unknown knowledge fixture: ${id}`)
  }
  return {
    ...object.base,
    humanEdited,
    lifecycle: {
      allowedLifecycleActions: ["MARK_ACTIVE", "MARK_SUPERSEDED", "REQUEST_CORRECTION"],
      decision: "PENDING",
      inActiveProjection: false,
      knowledgeObjectId: id,
      lifecycleState: object.lifecycleState,
      lifecycleVersion: object.lifecycleVersion,
      openCorrectionRequestId: null,
      reviewSequence: object.reviews.length,
      supersededBy: object.supersededBy,
      supersedes: object.supersedes,
    },
    review: {
      allowedActions: ["APPROVE", "EDIT", "USER_REJECT"],
      decision: "PENDING",
      knowledgeObjectId: id,
      latestReview: null,
      lifecycleState: object.lifecycleState,
      lifecycleVersion: object.lifecycleVersion,
      reviewSequence: object.reviews.length,
    },
  }
}

const emptySupersession = (): SupersessionContext => ({
  candidates: [],
  target: null,
})

const evidenceView = (id: string) => ({
  status: "ready" as const,
  evidence: {
    knowledgeObjectId: id,
    evidence: objects[id]?.evidence ?? [],
  },
})

const historyView = (id: string) => ({
  status: "ready" as const,
  history: {
    knowledgeObjectId: id,
    reviews: objects[id]?.reviews ?? [],
  },
})

const CAPABILITIES = [
  "knowledge.read",
  "knowledge.review",
  "knowledge.lifecycle.manage",
] as const

const controlsFor = (detail: KnowledgeDetail) =>
  knowledgeControls(detail.review, detail.lifecycle, CAPABILITIES)

const layoutMarkup = (detail: KnowledgeDetail) =>
  renderToStaticMarkup(
    <>
      <KnowledgeEvidenceList view={evidenceView(detail.knowledgeObjectId)} />
      <ReviewActions
        detail={detail}
        controls={controlsFor(detail)}
        csrfToken="csrf"
        idempotencyKeys={{ approve: "a", edit: "e", reject: "r", revert: "v" }}
      />
      <LifecycleActions
        detail={detail}
        controls={controlsFor(detail)}
        supersession={emptySupersession()}
        csrfToken="csrf"
        idempotencyKeys={{ activate: "a", supersede: "s", correction: "c" }}
        knowledgeReturnPath={`/memory/${detail.knowledgeObjectId}`}
      />
    </>,
  )

describe("knowledge detail decision-first layout", () => {
  it("places evidence before every review and lifecycle control in document order", () => {
    const detail = detailOf(KNOWLEDGE.pending)
    const html = layoutMarkup(detail)
    const evidenceAt = html.indexOf('data-testid="knowledge-evidence"')

    expect(evidenceAt).toBeGreaterThan(-1)
    for (const testId of [
      "review-approve",
      "review-edit",
      "review-reject",
      "lifecycle-activate",
      "lifecycle-supersede-pick",
      "lifecycle-correction",
    ]) {
      const controlAt = html.indexOf(`data-testid="${testId}"`)
      expect(controlAt, testId).toBeGreaterThan(evidenceAt)
    }
  })

  it("opens the payload comparison when humanEdited is true and keeps it closed otherwise", () => {
    const edited = renderToStaticMarkup(
      <KnowledgePayloadDisclosure detail={detailOf(KNOWLEDGE.edited, true)} />,
    )
    const plain = renderToStaticMarkup(
      <KnowledgePayloadDisclosure detail={detailOf(KNOWLEDGE.approved, false)} />,
    )

    expect(edited).toMatch(/<details[^>]*\sopen[=>]/)
    expect(plain).not.toMatch(/<details[^>]*\sopen[=>]/)
  })

  it("wraps secondary sections in collapsed disclosures by default", () => {
    const detail = detailOf(KNOWLEDGE.pending)
    const html = renderToStaticMarkup(
      <>
        <KnowledgeSourceDisclosure detail={detail} />
        <KnowledgePayloadDisclosure detail={detail} />
        <ReviewHistory view={historyView(detail.knowledgeObjectId)} />
      </>,
    )

    expect(html).toContain('data-testid="knowledge-source-disclosure"')
    expect(html).toContain('data-testid="knowledge-payload-disclosure"')
    expect(html).toContain('data-testid="review-history-disclosure"')
    expect(html).not.toMatch(/knowledge-source-disclosure[^>]*\sopen[=>]/)
    expect(html).not.toMatch(/review-history-disclosure[^>]*\sopen[=>]/)
  })

  it("keeps an unavailable review history outside a closed disclosure", () => {
    const view: KnowledgeHistoryView = {
      status: "unavailable",
      failure: {
        code: "DEPENDENCY_UNAVAILABLE",
        treatment: "retry-bounded",
        message: "The service is busy.",
        retryable: true,
      },
    }
    const html = renderToStaticMarkup(<ReviewHistory view={view} />)

    expect(html).toContain("The review history is not available right now")
    expect(html).not.toContain("review-history-disclosure")
    expect(html).not.toMatch(/<details/)
  })

  it("states the authenticator requirement on gated summaries while they are closed", () => {
    const html = layoutMarkup(detailOf(KNOWLEDGE.approved, false))
    const closed = html.split('data-testid="lifecycle-activate"')[0] ?? html

    expect(closed).toContain(REAUTHENTICATION_PRECONDITION_SUMMARY)
  })

  it("gives revert a submit label that is not the disclosure summary", () => {
    const html = renderToStaticMarkup(
      <ReviewActions
        detail={detailOf(KNOWLEDGE.edited, true)}
        controls={controlsFor({
          ...detailOf(KNOWLEDGE.edited, true),
          review: {
            ...detailOf(KNOWLEDGE.edited, true).review!,
            allowedActions: ["REVERT_TO_ORIGINAL_AND_APPROVE", "EDIT"],
          },
        })}
        csrfToken="csrf"
        idempotencyKeys={{ approve: "a", edit: "e", reject: "r", revert: "v" }}
      />,
    )

    expect(html).toContain("Revert to the original and approve")
    expect(html).toContain("Confirm revert and approve")
    expect(html.match(/Revert to the original and approve/g)?.length).toBe(1)
  })
})
