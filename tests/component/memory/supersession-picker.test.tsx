import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import type { KnowledgeDetail } from "@contracts/console"

import { LifecycleActions } from "@/components/memory/lifecycle-actions"
import { knowledgeControls } from "@/lib/knowledge/presentation"
import type { SupersessionContext } from "@/server/queries/knowledge"

import { KNOWLEDGE, KNOWLEDGE_OBJECTS } from "../../../tools/console-stub/fixtures.mjs"

/**
 * MEM-UX/06 — replacement picker reads as labelled radio cards, not a select.
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

describe("supersession replacement picker", () => {
  it("presents each candidate by claim and review state, not by grade", () => {
    const active = objects[KNOWLEDGE.active]
    const edited = objects[KNOWLEDGE.edited]
    const supersession: SupersessionContext = {
      candidates: [
        {
          knowledgeObjectId: KNOWLEDGE.active,
          shortClaim: active?.shortClaim ?? "",
          knowledgeType: active?.base.knowledgeType ?? "",
          reviewLabel: "Approved",
        },
        {
          knowledgeObjectId: KNOWLEDGE.edited,
          shortClaim: edited?.shortClaim ?? "",
          knowledgeType: edited?.base.knowledgeType ?? "",
          reviewLabel: "Edited by a reviewer",
        },
      ],
      target: null,
    }

    const html = markup(
      <LifecycleActions
        detail={detailOf(KNOWLEDGE.approved)}
        controls={knowledgeControls(
          detailOf(KNOWLEDGE.approved).review,
          detailOf(KNOWLEDGE.approved).lifecycle,
          ["knowledge.read", "knowledge.review", "knowledge.lifecycle.manage"],
        )}
        supersession={supersession}
        csrfToken="csrf-test"
        idempotencyKeys={{ supersede: "supersede-key" }}
        reauthenticationFreshUntil={null}
        knowledgeReturnPath="/memory/test"
      />,
    )

    const picker = html.match(
      /data-testid="lifecycle-supersede-pick"[\s\S]*?<\/form>/,
    )?.[0]
    expect(picker).toBeDefined()
    expect(picker).toContain('type="radio"')
    expect(picker).not.toContain("<select")

    const names = [...(picker?.matchAll(/aria-label="([^"]+)"/g) ?? [])].map(
      (match) => match[1] ?? "",
    )
    const activeName = names.find((name) => name.includes(active?.shortClaim ?? ""))
    const editedName = names.find((name) => name.includes(edited?.shortClaim ?? ""))
    expect(activeName).toContain("Approved")
    expect(editedName).toContain("Edited by a reviewer")
    for (const name of names) {
      expect(name).not.toMatch(/^(LOW|MEDIUM|HIGH|VERY_HIGH)$/i)
    }
  })

  it("checks the URL-carried replacement on the picker", () => {
    const active = objects[KNOWLEDGE.active]
    const html = markup(
      <LifecycleActions
        detail={detailOf(KNOWLEDGE.approved)}
        controls={knowledgeControls(
          detailOf(KNOWLEDGE.approved).review,
          detailOf(KNOWLEDGE.approved).lifecycle,
          ["knowledge.read", "knowledge.review", "knowledge.lifecycle.manage"],
        )}
        supersession={{
          candidates: [
            {
              knowledgeObjectId: KNOWLEDGE.active,
              shortClaim: active?.shortClaim ?? "",
              knowledgeType: active?.base.knowledgeType ?? "",
              reviewLabel: "Approved",
            },
          ],
          target: {
            status: "ready",
            knowledgeObjectId: KNOWLEDGE.active,
            shortClaim: active?.shortClaim ?? "",
            reviewSequence: 1,
            lifecycleVersion: 1,
          },
        }}
        csrfToken="csrf-test"
        idempotencyKeys={{ supersede: "supersede-key" }}
        reauthenticationFreshUntil={null}
        knowledgeReturnPath="/memory/test"
      />,
    )

    const picker = html.match(
      /data-testid="lifecycle-supersede-pick"[\s\S]*?<\/form>/,
    )?.[0]
    expect(picker).toMatch(
      new RegExp(
        `value="${KNOWLEDGE.active}"[^>]*checked|checked[^>]*value="${KNOWLEDGE.active}"`,
      ),
    )
  })
})
