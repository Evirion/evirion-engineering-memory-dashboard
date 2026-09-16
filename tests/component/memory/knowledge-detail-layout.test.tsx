import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import type { KnowledgeDetail } from "@contracts/console"

import { REAUTHENTICATION_PRECONDITION_SUMMARY } from "@/components/auth/reauthentication-notice"
import {
  KnowledgeEvidenceList,
  KnowledgeSourceContext,
} from "@/components/memory/knowledge-detail"
import { KnowledgePayloads } from "@/components/memory/knowledge-payload"
import { LifecycleActions } from "@/components/memory/lifecycle-actions"
import { ReviewActions } from "@/components/memory/review-actions"
import { ReviewHistory } from "@/components/memory/review-history"
import { knowledgeControls } from "@/lib/knowledge/presentation"
import type {
  KnowledgeHistoryView,
  SupersessionContext,
} from "@/server/queries/knowledge"

import { KNOWLEDGE, KNOWLEDGE_OBJECTS } from "../../../tools/console-stub/fixtures.mjs"

/**
 * The Knowledge Object page shows what was extracted, where it came from, and
 * the quotes behind it before it asks for any decision, and it collapses none
 * of that behind a control the reader has to find and open first.
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
      // The derivative is read from the effective review, so an object the
      // fixture calls edited has to carry the review that recorded it.
      latestReview: humanEdited ? (object.reviews.at(-1) ?? null) : null,
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

/** The page's own order: what was extracted, its source, its quotes, then controls. */
const layoutMarkup = (detail: KnowledgeDetail) =>
  renderToStaticMarkup(
    <>
      <KnowledgePayloads detail={detail} />
      <KnowledgeSourceContext detail={detail} />
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
      <ReviewHistory view={historyView(detail.knowledgeObjectId)} />
    </>,
  )

const CONTROL_TEST_IDS = [
  "review-approve",
  "review-edit",
  "review-reject",
  "lifecycle-activate",
  "lifecycle-supersede-pick",
  "lifecycle-correction",
] as const

describe("knowledge detail layout", () => {
  it("shows the extraction, its source and its evidence before every control", () => {
    const html = layoutMarkup(detailOf(KNOWLEDGE.pending))
    const extractionAt = html.indexOf('data-testid="knowledge-original"')
    const sourceAt = html.indexOf('data-testid="knowledge-source"')
    const evidenceAt = html.indexOf('data-testid="knowledge-evidence"')

    expect(extractionAt).toBeGreaterThan(-1)
    expect(sourceAt).toBeGreaterThan(extractionAt)
    expect(evidenceAt).toBeGreaterThan(sourceAt)

    for (const testId of CONTROL_TEST_IDS) {
      expect(html.indexOf(`data-testid="${testId}"`), testId).toBeGreaterThan(
        evidenceAt,
      )
    }
  })

  it("collapses nothing: no section waits behind a disclosure", () => {
    const html = layoutMarkup(detailOf(KNOWLEDGE.edited, true))

    expect(html).not.toMatch(/<details/)
    expect(html).not.toMatch(/<summary/)
  })

  it("renders the reviewer's derivative beside the machine extraction", () => {
    const html = layoutMarkup(detailOf(KNOWLEDGE.edited, true))

    expect(html).toContain('data-testid="knowledge-original"')
    expect(html).toContain('data-testid="knowledge-edited"')
  })

  it("names each decision in a heading the reader can see without opening anything", () => {
    const html = layoutMarkup(detailOf(KNOWLEDGE.pending))

    for (const text of [
      "Approve the machine extraction",
      "Record an edited derivative",
      "Reject this claim",
      "Mark active",
      "Mark superseded",
      "Ask Evirion to correct this",
    ]) {
      expect(html, text).toContain(text)
    }
  })

  it("reports an unavailable review history instead of an empty timeline", () => {
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
  })

  it("states the authenticator requirement on every gated lifecycle form", () => {
    const html = layoutMarkup(detailOf(KNOWLEDGE.approved, false))

    expect(html).toContain(REAUTHENTICATION_PRECONDITION_SUMMARY)
  })

  it("gives revert a submit label distinct from its heading", () => {
    const edited = detailOf(KNOWLEDGE.edited, true)
    const html = renderToStaticMarkup(
      <ReviewActions
        detail={edited}
        controls={controlsFor({
          ...edited,
          review: {
            ...edited.review!,
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
