import { describe, expect, it, vi } from "vitest"

import type { ConsoleTransport } from "@/server/adapters/console-api"
import {
  fetchKnowledgeCorrections,
  fetchKnowledgeDetail,
  fetchKnowledgeEvidence,
  fetchKnowledgeLifecycleState,
  fetchKnowledgePage,
  fetchKnowledgeReviewHistory,
  fetchKnowledgeReviewState,
  markKnowledgeActive,
  markKnowledgeSuperseded,
  recordKnowledgeReview,
  requestKnowledgeCorrection,
} from "@/server/adapters/knowledge"

/**
 * EEM-9/05 C05.
 *
 * Knowledge mutations answer with `KnowledgeReceipt`, whose four response
 * codes are neither the entitlement ones nor the import ones. They carry their
 * optimistic tokens in the body rather than as `expected-*-version` headers,
 * because `KnowledgeExpectedSequence` admits zero and a versioned resource's
 * `expectedVersion` does not.
 *
 * These tests pin every URL built, every token forwarded, and that zero
 * survives the round trip as itself rather than being dropped as falsy.
 */

const ORGANIZATION = "00000000-0000-4000-8000-0000000000a1"
const KNOWLEDGE = "00000000-0000-4000-8000-0000000000b2"
const NEW_KNOWLEDGE = "00000000-0000-4000-8000-0000000000b3"
const REPOSITORY = "00000000-0000-4000-8000-0000000000c4"
const PULL_REQUEST = "00000000-0000-4000-8000-0000000000c5"
const RELATION = "00000000-0000-4000-8000-0000000000d6"
const EVIDENCE = "00000000-0000-4000-8000-0000000000d7"
const IDEMPOTENCY_KEY = "00000000-0000-4000-8000-0000000000e8"
const REQUEST_ID = "00000000-0000-4000-8000-0000000000f9"
const FINGERPRINT = "a".repeat(64)

const scope = {
  baseUrl: "https://api.evirion.test",
  organizationId: ORGANIZATION,
  accessToken: "caller-access-token",
  correlationId: "correlation-1",
} as const

const summary = {
  confidence: 82,
  knowledgeObjectId: KNOWLEDGE,
  knowledgeType: "ArchitectureDecision",
  lifecycleState: "UNRESOLVED",
  mergedAt: "2026-08-30T12:00:00Z",
  pullRequestNumber: 17,
  pullRequestTitle: "Adopt the append-only review table",
  reviewStatus: "PENDING",
  shortClaim: "Reviews are append-only.",
}

const page = { items: [summary], page: { nextCursor: null } }

const lifecycle = {
  allowedLifecycleActions: ["MARK_ACTIVE"],
  decision: "APPROVED",
  inActiveProjection: false,
  knowledgeObjectId: KNOWLEDGE,
  lifecycleState: "UNRESOLVED",
  lifecycleVersion: 0,
  openCorrectionRequestId: null,
  reviewSequence: 1,
  supersededBy: [],
  supersedes: [],
}

const reviewState = {
  allowedActions: ["APPROVE", "EDIT", "USER_REJECT"],
  decision: "PENDING",
  knowledgeObjectId: KNOWLEDGE,
  latestReview: null,
  lifecycleState: "UNRESOLVED",
  lifecycleVersion: 0,
  reviewSequence: 0,
}

const detail = {
  author: "octocat",
  confidence: 82,
  createdAt: "2026-08-30T12:05:00Z",
  humanEdited: false,
  implementationStatus: "implemented",
  knowledge: "Reviews are appended, never updated.",
  knowledgeObjectId: KNOWLEDGE,
  knowledgeStatus: "active",
  knowledgeType: "ArchitectureDecision",
  knowledgeValue: "high",
  lifecycle,
  memoryPriority: 3,
  originalPayload: { knowledge: "Reviews are appended, never updated." },
  problem: "A mutable review row loses the decision it replaced.",
  sourceContext: {
    mergedAt: "2026-08-30T12:00:00Z",
    nameWithOwner: "evirion/console",
    pullRequestAuthorLogin: "octocat",
    pullRequestId: PULL_REQUEST,
    pullRequestNumber: 17,
    pullRequestTitle: "Adopt the append-only review table",
    pullRequestUrl: "https://github.com/evirion/console/pull/17",
    repositoryId: REPOSITORY,
  },
  technicalDetails: {
    admissionDecisionOrigin: "MODEL",
    admissionDisposition: "ACCEPTED",
    componentVersions: { extractor: "3.1.0" },
    effectiveJobId: null,
    extractedAt: "2026-08-30T12:04:00Z",
    extractionRunId: "00000000-0000-4000-8000-00000000010a",
    resolvedModelId: "model-a",
    semanticPipelineFingerprint: FINGERPRINT,
    validationValid: true,
  },
}

const evidence = {
  evidence: [
    {
      author: "octocat",
      evidenceId: EVIDENCE,
      ordinal: 1,
      quote: "We append a review row rather than updating one.",
      source: "pull request body",
      sourceId: PULL_REQUEST,
      sourceType: "pull_request",
      sourceUrl: "https://github.com/evirion/console/pull/17",
    },
  ],
  knowledgeObjectId: KNOWLEDGE,
}

const history = { knowledgeObjectId: KNOWLEDGE, reviews: [] }

const corrections = { correctionRequests: [], knowledgeObjectId: KNOWLEDGE }

const receipt = {
  receiptId: "00000000-0000-4000-8000-00000000010b",
  responseCode: "KNOWLEDGE_REVIEW_RECORDED",
  responsePayload: reviewState,
  status: "completed",
}

const editPayload = {
  affectedSystems: ["console"],
  answerableQuestions: ["Can a review be amended?"],
  constraints: ["Append only"],
  designRationale: "History must survive a later decision.",
  documentedTradeoffs: ["More rows"],
  explicitAlternatives: ["Mutable current-state row"],
  failureModes: ["Lost decision"],
  futureImpact: "Audit stays complete.",
  implementationStatus: "implemented",
  invariants: ["Sequence is monotonic"],
  knowledge: "Reviews are appended, never updated.",
  knowledgeType: "ArchitectureDecision",
  problem: "A mutable review row loses the decision it replaced.",
} as const

const recordingTransport = (
  payload: unknown,
): { transport: ConsoleTransport; calls: { url: string; init: RequestInit }[] } => {
  const calls: { url: string; init: RequestInit }[] = []
  const transport: ConsoleTransport = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    return {
      status: 200,
      json: async () => ({
        contractVersion: "1.0",
        requestId: REQUEST_ID,
        data: payload,
      }),
    }
  })
  return { transport, calls }
}

const headerOf = (init: RequestInit, name: string): string | null =>
  (init.headers as Headers).get(name)

const bodyOf = (init: RequestInit): Record<string, unknown> =>
  JSON.parse(String(init.body)) as Record<string, unknown>

const organization = `https://api.evirion.test/v1/organizations/${ORGANIZATION}`
const knowledge = `${organization}/knowledge/${KNOWLEDGE}`

describe("knowledge reads", () => {
  it("lists the queue with no predicate at all", async () => {
    const { transport, calls } = recordingTransport(page)

    const result = await fetchKnowledgePage(scope, {}, transport)

    expect(result).toEqual({ ok: true, value: page, requestId: REQUEST_ID })
    // An absent `reviewStatus` is the backend's own PENDING default. Sending
    // one here would make the Console the authority on what the queue shows.
    expect(calls[0]?.url).toBe(`${organization}/knowledge`)
    expect(calls[0]?.init.method).toBe("GET")
  })

  it("carries every published predicate and nothing else", async () => {
    const { transport, calls } = recordingTransport(page)

    await fetchKnowledgePage(
      scope,
      {
        pageSize: 25,
        after: KNOWLEDGE,
        repositoryId: REPOSITORY,
        knowledgeType: "ArchitectureDecision",
        reviewStatus: "APPROVED",
        lifecycleState: "ACTIVE",
        pullRequestId: PULL_REQUEST,
        authorLogin: "octocat",
        mergedFrom: "2026-08-01T00:00:00Z",
        mergedTo: "2026-09-01T00:00:00Z",
      },
      transport,
    )

    const url = new URL(String(calls[0]?.url))
    expect(url.pathname).toBe(`/v1/organizations/${ORGANIZATION}/knowledge`)
    expect(Object.fromEntries(url.searchParams)).toEqual({
      pageSize: "25",
      after: KNOWLEDGE,
      repositoryId: REPOSITORY,
      knowledgeType: "ArchitectureDecision",
      reviewStatus: "APPROVED",
      lifecycleState: "ACTIVE",
      pullRequestId: PULL_REQUEST,
      authorLogin: "octocat",
      mergedFrom: "2026-08-01T00:00:00Z",
      mergedTo: "2026-09-01T00:00:00Z",
    })
  })

  it.each([
    ["detail", fetchKnowledgeDetail, detail, ""],
    ["evidence", fetchKnowledgeEvidence, evidence, "/evidence"],
    ["review history", fetchKnowledgeReviewHistory, history, "/reviews"],
    ["review state", fetchKnowledgeReviewState, reviewState, "/review-state"],
    ["lifecycle state", fetchKnowledgeLifecycleState, lifecycle, "/lifecycle-state"],
    ["corrections", fetchKnowledgeCorrections, corrections, "/corrections"],
  ] as const)("reads %s from its own path", async (_name, call, payload, suffix) => {
    const { transport, calls } = recordingTransport(payload)

    const result = await call(scope, KNOWLEDGE, transport)

    expect(result).toEqual({ ok: true, value: payload, requestId: REQUEST_ID })
    expect(calls[0]?.url).toBe(`${knowledge}${suffix}`)
    expect(calls[0]?.init.method).toBe("GET")
  })

  it("fails closed on a lifecycle state the contract does not publish", async () => {
    const { transport } = recordingTransport({
      ...lifecycle,
      lifecycleState: "ARCHIVED_BY_OPERATOR",
    })

    const result = await fetchKnowledgeLifecycleState(scope, KNOWLEDGE, transport)

    expect(result).toEqual({ ok: false, failure: { kind: "unsupported", status: 200 } })
  })

  it("fails closed on a review decision the contract does not publish", async () => {
    const { transport } = recordingTransport({ ...reviewState, decision: "ESCALATED" })

    const result = await fetchKnowledgeReviewState(scope, KNOWLEDGE, transport)

    expect(result).toEqual({ ok: false, failure: { kind: "unsupported", status: 200 } })
  })
})

describe("knowledge review commands", () => {
  it("approves with both observed tokens and no edit or reason", async () => {
    const { transport, calls } = recordingTransport(receipt)

    await recordKnowledgeReview(
      scope,
      {
        knowledgeObjectId: KNOWLEDGE,
        idempotencyKey: IDEMPOTENCY_KEY,
        action: "APPROVE",
        expectedReviewSequence: 0,
        expectedLifecycleVersion: 0,
      },
      transport,
    )

    const init = calls[0]?.init as RequestInit
    expect(calls[0]?.url).toBe(`${knowledge}/reviews`)
    expect(init.method).toBe("POST")
    // Sequence zero is PENDING and version zero is UNRESOLVED. Both must
    // survive as themselves rather than being dropped for being falsy.
    expect(bodyOf(init)).toEqual({
      action: "APPROVE",
      expectedReviewSequence: 0,
      expectedLifecycleVersion: 0,
    })
    expect(headerOf(init, "idempotency-key")).toBe(IDEMPOTENCY_KEY)
  })

  it("sends the whole editable projection under its schema version", async () => {
    const { transport, calls } = recordingTransport(receipt)

    await recordKnowledgeReview(
      scope,
      {
        knowledgeObjectId: KNOWLEDGE,
        idempotencyKey: IDEMPOTENCY_KEY,
        action: "EDIT",
        expectedReviewSequence: 1,
        expectedLifecycleVersion: 0,
        edit: editPayload,
        issueSeverity: "MINOR",
        acknowledgedEvidenceIds: [EVIDENCE],
      },
      transport,
    )

    const body = bodyOf(calls[0]?.init as RequestInit)
    expect(body["edit"]).toEqual({ schemaVersion: "1", payload: editPayload })
    expect(Object.keys(editPayload)).toHaveLength(13)
    expect(body["issueSeverity"]).toBe("MINOR")
    expect(body["acknowledgedEvidenceIds"]).toEqual([EVIDENCE])
    // An edit is a derivative. Nothing here names the original payload, so no
    // request this module builds can overwrite it.
    expect(body).not.toHaveProperty("originalPayload")
  })

  it("rejects with a structured reason and drops a whitespace-only note", async () => {
    const { transport, calls } = recordingTransport(receipt)

    await recordKnowledgeReview(
      scope,
      {
        knowledgeObjectId: KNOWLEDGE,
        idempotencyKey: IDEMPOTENCY_KEY,
        action: "USER_REJECT",
        expectedReviewSequence: 1,
        expectedLifecycleVersion: 0,
        rejectReasonCode: "TOO_VAGUE",
        issueSeverity: "MAJOR",
        note: "   ",
      },
      transport,
    )

    const body = bodyOf(calls[0]?.init as RequestInit)
    expect(body["rejectReasonCode"]).toBe("TOO_VAGUE")
    // The contract requires a btrim-stable note, so an empty one is omitted
    // rather than sent as a string the backend would then refuse.
    expect(body).not.toHaveProperty("note")
  })

  it("reverts to the original as its own action, never as a plain approve", async () => {
    const { transport, calls } = recordingTransport(receipt)

    await recordKnowledgeReview(
      scope,
      {
        knowledgeObjectId: KNOWLEDGE,
        idempotencyKey: IDEMPOTENCY_KEY,
        action: "REVERT_TO_ORIGINAL_AND_APPROVE",
        expectedReviewSequence: 2,
        expectedLifecycleVersion: 0,
      },
      transport,
    )

    expect(bodyOf(calls[0]?.init as RequestInit)["action"]).toBe(
      "REVERT_TO_ORIGINAL_AND_APPROVE",
    )
  })
})

describe("knowledge lifecycle commands", () => {
  it("activates with the observed pair and a bounded note", async () => {
    const { transport, calls } = recordingTransport({
      ...receipt,
      responseCode: "KNOWLEDGE_MARKED_ACTIVE",
    })

    await markKnowledgeActive(
      scope,
      {
        knowledgeObjectId: KNOWLEDGE,
        idempotencyKey: IDEMPOTENCY_KEY,
        expectedReviewSequence: 1,
        expectedLifecycleVersion: 0,
        note: "  Confirmed current  ",
      },
      transport,
    )

    const init = calls[0]?.init as RequestInit
    expect(calls[0]?.url).toBe(`${knowledge}/activate`)
    expect(bodyOf(init)).toEqual({
      expectedReviewSequence: 1,
      expectedLifecycleVersion: 0,
      note: "Confirmed current",
    })
  })

  it("supersedes with four tokens and the new object named in the body", async () => {
    const { transport, calls } = recordingTransport({
      ...receipt,
      responseCode: "KNOWLEDGE_MARKED_SUPERSEDED",
    })

    await markKnowledgeSuperseded(
      scope,
      {
        knowledgeObjectId: KNOWLEDGE,
        idempotencyKey: IDEMPOTENCY_KEY,
        newKnowledgeObjectId: NEW_KNOWLEDGE,
        expectedNewReviewSequence: 3,
        expectedNewLifecycleVersion: 1,
        expectedOldReviewSequence: 2,
        expectedOldLifecycleVersion: 0,
      },
      transport,
    )

    const init = calls[0]?.init as RequestInit
    // The path names the object being superseded and the body names the one
    // replacing it, so the stored relation is `new SUPERSEDES old`.
    expect(calls[0]?.url).toBe(`${knowledge}/supersede`)
    expect(bodyOf(init)).toEqual({
      newKnowledgeObjectId: NEW_KNOWLEDGE,
      expectedNewReviewSequence: 3,
      expectedNewLifecycleVersion: 1,
      expectedOldReviewSequence: 2,
      expectedOldLifecycleVersion: 0,
    })
  })

  it("carries the relation identifier and its version only when retracting", async () => {
    const { transport, calls } = recordingTransport({
      ...receipt,
      responseCode: "KNOWLEDGE_CORRECTION_REQUESTED",
    })

    await requestKnowledgeCorrection(
      scope,
      {
        knowledgeObjectId: KNOWLEDGE,
        idempotencyKey: IDEMPOTENCY_KEY,
        requestType: "RETRACT_SUPERSESSION",
        reasonCode: "SUPERSESSION_ERRONEOUS",
        expectedReviewSequence: 2,
        expectedLifecycleVersion: 1,
        knowledgeRelationId: RELATION,
        expectedRelationVersion: 1,
      },
      transport,
    )

    expect(calls[0]?.url).toBe(`${knowledge}/corrections`)
    expect(bodyOf(calls[0]?.init as RequestInit)).toEqual({
      requestType: "RETRACT_SUPERSESSION",
      reasonCode: "SUPERSESSION_ERRONEOUS",
      expectedReviewSequence: 2,
      expectedLifecycleVersion: 1,
      knowledgeRelationId: RELATION,
      expectedRelationVersion: 1,
    })
  })

  it("omits the relation pair for a correction that names no relation", async () => {
    const { transport, calls } = recordingTransport({
      ...receipt,
      responseCode: "KNOWLEDGE_CORRECTION_REQUESTED",
    })

    await requestKnowledgeCorrection(
      scope,
      {
        knowledgeObjectId: KNOWLEDGE,
        idempotencyKey: IDEMPOTENCY_KEY,
        requestType: "WITHDRAW_ACTIVE_KNOWLEDGE",
        reasonCode: "KNOWLEDGE_NO_LONGER_TRUE",
        expectedReviewSequence: 2,
        expectedLifecycleVersion: 1,
      },
      transport,
    )

    const body = bodyOf(calls[0]?.init as RequestInit)
    expect(body).not.toHaveProperty("knowledgeRelationId")
    expect(body).not.toHaveProperty("expectedRelationVersion")
  })

  it("refuses an import receipt in answer to a knowledge mutation", async () => {
    // The three receipts are distinct types with disjoint response codes.
    // Accepting another one here would let the outcome reader be handed a
    // code it cannot explain.
    const { transport } = recordingTransport({
      ...receipt,
      responseCode: "REPOSITORY_IMPORT_CREATED",
    })

    const result = await markKnowledgeActive(
      scope,
      {
        knowledgeObjectId: KNOWLEDGE,
        idempotencyKey: IDEMPOTENCY_KEY,
        expectedReviewSequence: 1,
        expectedLifecycleVersion: 0,
      },
      transport,
    )

    expect(result).toEqual({ ok: false, failure: { kind: "unsupported", status: 200 } })
  })

  it("forwards no service role, no DSN and no caller-supplied organization claim", async () => {
    const { transport, calls } = recordingTransport(receipt)

    await recordKnowledgeReview(
      scope,
      {
        knowledgeObjectId: KNOWLEDGE,
        idempotencyKey: IDEMPOTENCY_KEY,
        action: "APPROVE",
        expectedReviewSequence: 0,
        expectedLifecycleVersion: 0,
      },
      transport,
    )

    const headers = calls[0]?.init.headers as Headers
    expect([...headers.keys()]).not.toContain("x-organization-id")
    expect([...headers.keys()]).not.toContain("apikey")
    for (const [, value] of headers.entries()) {
      expect(value).not.toMatch(/service_role|postgres(ql)?:\/\//)
    }
  })
})

describe("knowledge path identity", () => {
  it("refuses to build a path from an identifier that could traverse", () => {
    const { transport, calls } = recordingTransport(detail)

    expect(() =>
      fetchKnowledgeEvidence(scope, "../../../internal/console/v1/session", transport),
    ).toThrow(/identifier/)
    expect(() =>
      markKnowledgeSuperseded(
        scope,
        {
          knowledgeObjectId: KNOWLEDGE,
          idempotencyKey: IDEMPOTENCY_KEY,
          newKnowledgeObjectId: "..",
          expectedNewReviewSequence: 1,
          expectedNewLifecycleVersion: 0,
          expectedOldReviewSequence: 1,
          expectedOldLifecycleVersion: 0,
        },
        transport,
      ),
    ).toThrow(/identifier/)
    expect(() =>
      requestKnowledgeCorrection(
        scope,
        {
          knowledgeObjectId: KNOWLEDGE,
          idempotencyKey: IDEMPOTENCY_KEY,
          requestType: "RETRACT_SUPERSESSION",
          reasonCode: "SUPERSESSION_ERRONEOUS",
          expectedReviewSequence: 1,
          expectedLifecycleVersion: 0,
          knowledgeRelationId: "../relations",
        },
        transport,
      ),
    ).toThrow(/identifier/)
    expect(calls).toHaveLength(0)
  })

  it("refuses a cursor and an evidence identifier that are not canonical UUIDs", () => {
    const { transport, calls } = recordingTransport(page)

    expect(() => fetchKnowledgePage(scope, { after: "not-a-uuid" }, transport)).toThrow(
      /cursor/,
    )
    expect(() =>
      recordKnowledgeReview(
        scope,
        {
          knowledgeObjectId: KNOWLEDGE,
          idempotencyKey: IDEMPOTENCY_KEY,
          action: "APPROVE",
          expectedReviewSequence: 0,
          expectedLifecycleVersion: 0,
          acknowledgedEvidenceIds: ["not-a-uuid"],
        },
        transport,
      ),
    ).toThrow(/evidence/)
    expect(calls).toHaveLength(0)
  })

  it("refuses an idempotency key that is not the canonical UUID", () => {
    const { transport, calls } = recordingTransport(receipt)

    expect(() =>
      markKnowledgeActive(
        scope,
        {
          knowledgeObjectId: KNOWLEDGE,
          idempotencyKey: "not-a-uuid",
          expectedReviewSequence: 0,
          expectedLifecycleVersion: 0,
        },
        transport,
      ),
    ).toThrow(/idempotency key/)
    expect(calls).toHaveLength(0)
  })
})
