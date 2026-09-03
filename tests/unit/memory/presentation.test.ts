import { describe, expect, it } from "vitest"

import type {
  KnowledgeDetail,
  KnowledgeLifecycleState,
  KnowledgeReviewState,
} from "@contracts/console"

import {
  type LifecycleAction,
  type ReviewAction,
  editedDerivativeOf,
  isAdmittedKnowledge,
  knowledgeControls,
  lifecycleStateLabel,
  reviewDecisionLabel,
} from "@/lib/knowledge/presentation"

import { KNOWLEDGE, KNOWLEDGE_OBJECTS } from "../../../tools/console-stub/fixtures.mjs"

/**
 * EEM-9/05 C05.
 *
 * Three distinctions this module exists to hold: an edit is a derivative
 * reported by the backend rather than a comparison the UI performs, the two
 * allowed-action lists are narrowed by the session capability and never
 * widened, and the two admission outcomes that produced no knowledge are not
 * Knowledge Objects.
 */

const OWNER = [
  "knowledge.read",
  "knowledge.review",
  "knowledge.lifecycle.manage",
] as const
const VIEWER = ["knowledge.read"] as const

const objects = KNOWLEDGE_OBJECTS()

const reviewState = (allowedActions: ReviewAction[]): KnowledgeReviewState => ({
  allowedActions,
  decision: "PENDING",
  knowledgeObjectId: KNOWLEDGE.pending,
  latestReview: null,
  lifecycleState: "UNRESOLVED",
  lifecycleVersion: 0,
  reviewSequence: 0,
})

const lifecycleState = (
  allowedLifecycleActions: LifecycleAction[],
): KnowledgeLifecycleState => ({
  allowedLifecycleActions,
  decision: "APPROVED",
  inActiveProjection: false,
  knowledgeObjectId: KNOWLEDGE.approved,
  lifecycleState: "UNRESOLVED",
  lifecycleVersion: 0,
  openCorrectionRequestId: null,
  reviewSequence: 1,
  supersededBy: [],
  supersedes: [],
})

describe("admission", () => {
  it("treats only an accepted admission as a Knowledge Object", () => {
    expect(isAdmittedKnowledge("ACCEPTED")).toBe(true)
    expect(isAdmittedKnowledge("REJECTED")).toBe(false)
    expect(isAdmittedKnowledge("QUARANTINED")).toBe(false)
    expect(isAdmittedKnowledge("UNSUPPORTED_SERVER_RESPONSE")).toBe(false)
  })
})

describe("controls", () => {
  it("offers exactly what the backend allowed and the session permits", () => {
    const controls = knowledgeControls(
      reviewState(["APPROVE", "EDIT", "USER_REJECT"]),
      lifecycleState(["MARK_ACTIVE", "MARK_SUPERSEDED"]),
      OWNER,
    )

    expect(controls).toEqual({
      canApprove: true,
      canEdit: true,
      canReject: true,
      canRevertToOriginal: false,
      canMarkActive: true,
      canSupersede: true,
      canRequestCorrection: false,
    })
  })

  it("never widens beyond the backend list, whatever the capability", () => {
    // `allowedActions` is the contract's authority for what may be offered. A
    // capability the caller holds cannot add an action the backend withheld.
    const controls = knowledgeControls(reviewState([]), lifecycleState([]), OWNER)

    expect(Object.values(controls).every((value) => value === false)).toBe(true)
  })

  it("narrows by the session capability without becoming the authority", () => {
    const controls = knowledgeControls(
      reviewState(["APPROVE", "EDIT", "USER_REJECT"]),
      lifecycleState(["MARK_ACTIVE", "MARK_SUPERSEDED", "REQUEST_CORRECTION"]),
      VIEWER,
    )

    // Hiding is a convenience; the backend refuses either way, and the refusal
    // path is rendered even for a control that is also hidden.
    expect(Object.values(controls).every((value) => value === false)).toBe(true)
  })

  it("offers nothing at all when the backend sent no projection", () => {
    expect(
      Object.values(knowledgeControls(undefined, undefined, OWNER)).every(
        (value) => value === false,
      ),
    ).toBe(true)
  })
})

describe("the edited derivative", () => {
  const detailFrom = (id: string, humanEdited: boolean): KnowledgeDetail => {
    const object = objects[id]
    if (!object) throw new Error(`no fixture for ${id}`)

    return {
      ...object.base,
      humanEdited,
      lifecycle: lifecycleState([]),
      review: {
        ...reviewState([]),
        latestReview: object.reviews.at(-1) ?? null,
      },
    }
  }

  it("reads the derivative from the backend fact, not from a comparison", () => {
    const state = editedDerivativeOf(detailFrom(KNOWLEDGE.edited, true))

    expect(state.status).toBe("ready")
    if (state.status !== "ready") throw new Error("expected a ready derivative")
    expect(state.derivative.reviewSequence).toBe(5)
    expect(state.derivative.schemaVersion).toBe("1")
    expect(Object.keys(state.derivative.payload)).toHaveLength(13)
  })

  it("reports no derivative when the backend says the object is not edited", () => {
    // Even though this object's history contains an edit, the effective review
    // is not one. Comparing payloads instead would contradict the projection.
    expect(editedDerivativeOf(detailFrom(KNOWLEDGE.edited, false)).status).toBe("none")
    expect(editedDerivativeOf(detailFrom(KNOWLEDGE.approved, false)).status).toBe(
      "none",
    )
  })

  it("separates an edit it cannot show from an object with no edit", () => {
    // `review` is optional in the contract and `editedPayload` is optional on a
    // review, so the backend can say an object is edited and give nothing to
    // render. Folding that into "no edit" would leave the page declaring an
    // edit that is nowhere on screen.
    // The key is omitted rather than set to `undefined`, which is what the
    // backend does and what `exactOptionalPropertyTypes` insists on.
    const { review: _absent, ...withoutReview } = detailFrom(KNOWLEDGE.edited, true)
    const latest = objects[KNOWLEDGE.edited]?.reviews.at(-1)
    if (!latest) throw new Error("no fixture review")
    const { editedPayload: _withheld, ...withoutPayload } = latest

    const withoutEditedPayload: KnowledgeDetail = {
      ...detailFrom(KNOWLEDGE.edited, true),
      review: { ...reviewState([]), latestReview: withoutPayload },
    }

    expect(editedDerivativeOf(withoutReview).status).toBe("unavailable")
    expect(editedDerivativeOf(withoutEditedPayload).status).toBe("unavailable")
  })
})

describe("labels", () => {
  it("names the absence of a review as pending rather than unknown", () => {
    // Review sequence zero is a derived state, not a missing one.
    expect(reviewDecisionLabel("PENDING")).toBe("Awaiting review")
    expect(reviewDecisionLabel("UNSUPPORTED_SERVER_RESPONSE")).toContain("Unsupported")
  })

  it("keeps lifecycle wording distinct from review wording", () => {
    const review = new Set(
      (["PENDING", "APPROVED", "EDITED", "USER_REJECTED"] as const).map(
        reviewDecisionLabel,
      ),
    )
    const lifecycle = (
      ["UNRESOLVED", "ACTIVE", "SUPERSEDED", "WITHDRAWN"] as const
    ).map(lifecycleStateLabel)

    // The two axes must not be readable as one status, which starts with never
    // sharing a word for two different facts.
    for (const label of lifecycle) expect(review.has(label)).toBe(false)
  })
})
