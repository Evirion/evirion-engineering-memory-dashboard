import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import type { KnowledgeDetail } from "@contracts/console"

import { EditForm, RejectForm } from "@/components/memory/review-actions"
import {
  LifecycleActions,
  MarkActiveForm,
  RequestCorrectionForm,
} from "@/components/memory/lifecycle-actions"
import { knowledgeControls } from "@/lib/knowledge/presentation"
import type { SupersessionContext } from "@/server/queries/knowledge"

import { KNOWLEDGE, KNOWLEDGE_OBJECTS } from "../../../tools/console-stub/fixtures.mjs"

/**
 * MEM-UX/05 — required markers stay on unconditionally required fields only.
 */

const objects = KNOWLEDGE_OBJECTS()

const detailOf = (id: string): KnowledgeDetail => {
  const object = objects[id]
  if (object === undefined) {
    throw new Error(`Unknown knowledge fixture: ${id}`)
  }
  return {
    ...object.base,
    humanEdited: false,
    lifecycle: {
      allowedLifecycleActions: ["MARK_ACTIVE", "MARK_SUPERSEDED", "REQUEST_CORRECTION"],
      decision: "APPROVED",
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
      allowedActions: [
        "EDIT",
        "USER_REJECT",
        "APPROVE",
        "REVERT_TO_ORIGINAL_AND_APPROVE",
      ],
      decision: "APPROVED",
      knowledgeObjectId: id,
      latestReview: object.reviews.at(-1) ?? null,
      lifecycleState: object.lifecycleState,
      lifecycleVersion: object.lifecycleVersion,
      reviewSequence: object.reviews.length,
    },
  }
}

const markup = (element: React.ReactElement): string => renderToStaticMarkup(element)

const allControls = knowledgeControls(
  detailOf(KNOWLEDGE.approved).review,
  detailOf(KNOWLEDGE.approved).lifecycle,
  ["knowledge.read", "knowledge.review", "knowledge.lifecycle.manage"],
)

const emptySupersession: SupersessionContext = { candidates: [], target: null }

const formProps = {
  detail: detailOf(KNOWLEDGE.approved),
  controls: allControls,
  csrfToken: "csrf-test",
  idempotencyKeys: {
    reject: "reject-key",
    edit: "edit-key",
    activate: "activate-key",
    correction: "correction-key",
    supersede: "supersede-key",
  },
  supersession: emptySupersession,
}

const labelFor = (html: string, controlId: string): string => {
  const match = html.match(
    new RegExp(`<label[^>]*for="${controlId}"[^>]*>([\\s\\S]*?)</label>`, "i"),
  )
  return match?.[1] ?? ""
}

/**
 * The asterisk is `aria-hidden`, the visually hidden suffix announces the
 * requirement in the label, and the native attribute exposes required state.
 */
const REQUIRED_ASTERISK = /aria-hidden="true" class="text-destructive">\s*\*\s*<\/span>/

const expectRequiredMarker = (html: string, controlId: string) => {
  expect(html).toMatch(new RegExp(`id="${controlId}"[^>]*\\srequired`))
  const label = labelFor(html, controlId)
  expect(label).toMatch(REQUIRED_ASTERISK)
  expect(label).toContain("(required)")
  expect(html).toContain(`aria-describedby="${controlId}-error"`)
  expect(html).toContain(`id="${controlId}-error"`)
}

const expectNoRequiredMarker = (html: string, controlId: string) => {
  const label = labelFor(html, controlId)
  expect(label).not.toBe("")
  expect(label).not.toMatch(REQUIRED_ASTERISK)
}

describe("required field marking on review forms", () => {
  it("marks every unconditionally required control and leaves optional ones plain", () => {
    const html = markup(
      <>
        <RejectForm {...formProps} />
        <EditForm {...formProps} />
      </>,
    )

    for (const id of [
      "rejectReasonCode",
      "rejectIssueSeverity",
      "edit-knowledgeType",
      "edit-implementationStatus",
      "edit-problem",
      "edit-knowledge",
      "edit-designRationale",
      "edit-futureImpact",
      "editIssueSeverity",
    ]) {
      expectRequiredMarker(html, id)
    }

    for (const id of [
      "rejectNote",
      "editNote",
      "edit-documentedTradeoffs",
      "edit-explicitAlternatives",
      "edit-constraints",
      "edit-invariants",
      "edit-failureModes",
      "edit-affectedSystems",
      "edit-answerableQuestions",
    ]) {
      expectNoRequiredMarker(html, id)
      expect(html).not.toMatch(new RegExp(`id="${id}"[^>]*\\srequired`))
    }
  })
})

describe("required field marking on lifecycle forms", () => {
  it("marks correction fields that are always required when the form renders", () => {
    const correctionDetail = detailOf(KNOWLEDGE.superseded)
    const html = markup(
      <RequestCorrectionForm
        {...formProps}
        detail={correctionDetail}
        reauthenticationFreshUntil="2099-01-01T00:00:00Z"
        knowledgeReturnPath="/memory/test"
      />,
    )

    expectRequiredMarker(html, "requestType")
    expectRequiredMarker(html, "correctionReasonCode")
    expectNoRequiredMarker(html, "correctionNote")
    expectNoRequiredMarker(html, "knowledgeRelationId")
  })

  it("does not mark optional activate notes as required", () => {
    const html = markup(
      <MarkActiveForm
        {...formProps}
        reauthenticationFreshUntil="2099-01-01T00:00:00Z"
        knowledgeReturnPath="/memory/test"
      />,
    )

    expectNoRequiredMarker(html, "activateNote")
  })
})

describe("supersession replacement marking", () => {
  it("marks the replacement picker as required", () => {
    const supersession: SupersessionContext = {
      candidates: [
        {
          knowledgeObjectId: KNOWLEDGE.edited,
          shortClaim: "A replacement claim.",
          knowledgeType: "ArchitectureDecision",
          reviewLabel: "Approved",
        },
      ],
      target: {
        status: "ready",
        knowledgeObjectId: KNOWLEDGE.edited,
        shortClaim: "A replacement claim.",
        reviewSequence: 1,
        lifecycleVersion: 0,
      },
    }

    const html = markup(
      <LifecycleActions
        {...formProps}
        detail={detailOf(KNOWLEDGE.approved)}
        supersession={supersession}
        reauthenticationFreshUntil={null}
        knowledgeReturnPath="/memory/test"
      />,
    )
    const picker = html.match(
      /data-testid="lifecycle-supersede-pick"[\s\S]*?<\/form>/,
    )?.[0]
    expect(picker).toBeDefined()
    expect(picker).toContain('data-slot="field"')
    expect(picker).toMatch(/data-slot="input"/)
    expect(picker).toMatch(/type="radio"[^>]*required|required[^>]*type="radio"/)
    expect(picker).toMatch(REQUIRED_ASTERISK)
    expect(picker).toContain("(required)")
    expect(picker).toContain('aria-describedby="supersedeWith-error"')
    expect(picker).toContain('id="supersedeWith-error"')
    expect(picker).toContain(
      "[[data-slot=field]:has([data-slot=input]:user-invalid)_&amp;]:block",
    )
    expectNoRequiredMarker(html, "supersedeNote")
  })
})
