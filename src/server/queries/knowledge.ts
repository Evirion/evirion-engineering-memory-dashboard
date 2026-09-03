import "server-only"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import type {
  KnowledgeCorrections,
  KnowledgeDetail,
  KnowledgeEvidence,
  KnowledgePage,
  KnowledgeReviewHistory,
} from "@contracts/console"

import { readSession } from "@/lib/auth/session-broker"
import { readServerEnvironment } from "@/lib/env/server"
import { type ViewFailure, UNKNOWN_ERROR } from "@/lib/errors/console-errors"
import type { KnowledgeFilters } from "@/lib/knowledge/filters"
import {
  type KnowledgeControls,
  isAdmittedKnowledge,
  knowledgeControls,
  reviewDecisionLabel,
} from "@/lib/knowledge/presentation"
import {
  fetchKnowledgeCorrections,
  fetchKnowledgeDetail,
  fetchKnowledgeEvidence,
  fetchKnowledgeLifecycleState,
  fetchKnowledgePage,
  fetchKnowledgeReviewHistory,
} from "@/server/adapters/knowledge"
import { type RepositoryScope, isUuid } from "@/server/adapters/repositories"
import { fetchRepository, fetchRepositoryPage } from "@/server/adapters/repositories"
import { describeFailure } from "@/server/queries/repositories"
import { requireSessionContext } from "@/server/queries/session-context"

/**
 * Knowledge review and lifecycle reads for a server-rendered page.
 *
 * The caller token is resolved and spent inside this module and never reaches
 * a page or a component, so no render path can put it in the document. Pages
 * receive a view model and nothing else.
 *
 * Two boundaries this module holds:
 *
 * - a Knowledge Object whose admission was `REJECTED` or `QUARANTINED` is not
 *   rendered as one. Those are legitimate machine decisions that produced no
 *   knowledge, and the detail view answers not-found rather than showing a
 *   card for something the queue would never list;
 * - both optimistic tokens travel to the page inside the projections that
 *   carry them, so a form forwards what the backend last reported rather than
 *   a number this module reconstructed.
 */

/** One option for the repository predicate, named rather than left as a UUID. */
export type RepositoryChoice = {
  readonly id: string
  readonly nameWithOwner: string
}

export type KnowledgeQueueView =
  | {
      readonly status: "ready"
      readonly page: KnowledgePage
      readonly filters: KnowledgeFilters
      /**
       * Empty when the inventory could not be read. The queue still renders:
       * losing one predicate's option list is not losing the queue.
       */
      readonly repositoryChoices: readonly RepositoryChoice[]
      /** Present only on the repository-scoped queue, for the page heading. */
      readonly repositoryName?: string
    }
  | { readonly status: "unavailable"; readonly failure: ViewFailure }

/** Absent evidence is a state of its own, never an empty list and never zero. */
export type KnowledgeEvidenceView =
  | { readonly status: "ready"; readonly evidence: KnowledgeEvidence }
  | { readonly status: "unavailable"; readonly failure: ViewFailure }

export type KnowledgeHistoryView =
  | { readonly status: "ready"; readonly history: KnowledgeReviewHistory }
  | { readonly status: "unavailable"; readonly failure: ViewFailure }

export type KnowledgeCorrectionsView =
  | { readonly status: "ready"; readonly corrections: KnowledgeCorrections }
  | { readonly status: "unavailable"; readonly failure: ViewFailure }

/** One Knowledge Object a reviewer may name as the replacement. */
export type SupersessionCandidate = {
  readonly knowledgeObjectId: string
  readonly shortClaim: string
  readonly reviewLabel: string
}

/**
 * The replacement the reviewer selected, with the pair it carries.
 *
 * Both of the new object's tokens are read here and rendered on the
 * confirmation step, so the reviewer observes all four before submitting and
 * the mutation forwards four values the backend reported rather than two it
 * reported and two the Console fetched behind the reviewer's back.
 */
export type SupersessionTarget =
  | {
      readonly status: "ready"
      readonly knowledgeObjectId: string
      readonly shortClaim: string
      readonly reviewSequence: number
      readonly lifecycleVersion: number
    }
  | { readonly status: "unavailable"; readonly failure: ViewFailure }

export type SupersessionContext = {
  readonly candidates: readonly SupersessionCandidate[]
  readonly target: SupersessionTarget | null
}

export type KnowledgeDetailView =
  | {
      readonly status: "ready"
      readonly detail: KnowledgeDetail
      readonly evidence: KnowledgeEvidenceView
      readonly history: KnowledgeHistoryView
      readonly corrections: KnowledgeCorrectionsView
      readonly controls: KnowledgeControls
      readonly supersession: SupersessionContext
    }
  | { readonly status: "not-found" }
  | { readonly status: "unavailable"; readonly failure: ViewFailure }

const correlationId = (): string => {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  return Buffer.from(bytes).toString("hex")
}

type ResolvedScope =
  | {
      readonly status: "ready"
      readonly scope: RepositoryScope
      readonly capabilities: readonly string[]
    }
  | { readonly status: "unavailable"; readonly failure: ViewFailure }

const resolveScope = async (): Promise<ResolvedScope> => {
  const context = await requireSessionContext()
  if (context.status === "unavailable") {
    return {
      status: "unavailable",
      failure: {
        code: UNKNOWN_ERROR.code,
        treatment: "retry-bounded",
        message: context.message,
        retryable: true,
      },
    }
  }

  const jar = await cookies()
  const outcome = readSession(
    Object.fromEntries(jar.getAll().map((cookie) => [cookie.name, cookie.value])),
  )
  if (outcome.status !== "active") redirect("/auth/sign-in")

  return {
    status: "ready",
    capabilities: context.context.capabilities,
    scope: {
      baseUrl: readServerEnvironment().consoleApiBaseUrl,
      organizationId: context.context.organizationId,
      accessToken: outcome.session.accessToken,
      correlationId: correlationId(),
    },
  }
}

/**
 * The repository predicate's option list.
 *
 * A failed read yields no options rather than an unavailable queue. The
 * predicate is a convenience; losing it does not stop a reviewer reading their
 * queue, and the backend scopes the query either way.
 */
const readRepositoryChoices = async (
  scope: RepositoryScope,
): Promise<readonly RepositoryChoice[]> => {
  const repositories = await fetchRepositoryPage(scope, {})
  return repositories.ok
    ? repositories.value.items.map((repository) => ({
        id: repository.id,
        nameWithOwner: repository.nameWithOwner,
      }))
    : []
}

export const readKnowledgeQueue = async (
  filters: KnowledgeFilters,
  repositoryId?: string,
): Promise<KnowledgeQueueView> => {
  const resolved = await resolveScope()
  if (resolved.status === "unavailable") return resolved

  // The repository-scoped queue reads its repository first, which decides the
  // tenant boundary and supplies the heading. A foreign identifier is refused
  // there rather than by an empty list, which would disclose nothing but also
  // claim the repository exists and holds no knowledge.
  let repositoryName: string | undefined
  if (repositoryId !== undefined) {
    const repository = await fetchRepository(resolved.scope, repositoryId)
    if (!repository.ok) {
      return { status: "unavailable", failure: describeFailure(repository.failure) }
    }
    repositoryName = repository.value.nameWithOwner
  }

  const scoped: KnowledgeFilters =
    repositoryId === undefined ? filters : { ...filters, repositoryId }

  const page = await fetchKnowledgePage(resolved.scope, scoped)
  if (!page.ok) {
    return { status: "unavailable", failure: describeFailure(page.failure) }
  }

  return {
    status: "ready",
    page: page.value,
    filters: scoped,
    // Only the unscoped queue offers the predicate, so only it pays for the
    // inventory read.
    repositoryChoices:
      repositoryId === undefined ? await readRepositoryChoices(resolved.scope) : [],
    ...(repositoryName === undefined ? {} : { repositoryName }),
  }
}

const readEvidence = async (
  scope: RepositoryScope,
  knowledgeObjectId: string,
): Promise<KnowledgeEvidenceView> => {
  const evidence = await fetchKnowledgeEvidence(scope, knowledgeObjectId)
  // A failed read is reported as unavailable rather than as an empty list. An
  // empty list would claim the object has no supporting quote, which is a
  // different statement from not knowing, and `KD-002` requires the
  // attribution to be visible before any review action.
  return evidence.ok
    ? { status: "ready", evidence: evidence.value }
    : { status: "unavailable", failure: describeFailure(evidence.failure) }
}

const readHistory = async (
  scope: RepositoryScope,
  knowledgeObjectId: string,
): Promise<KnowledgeHistoryView> => {
  const history = await fetchKnowledgeReviewHistory(scope, knowledgeObjectId)
  return history.ok
    ? { status: "ready", history: history.value }
    : { status: "unavailable", failure: describeFailure(history.failure) }
}

const readCorrections = async (
  scope: RepositoryScope,
  knowledgeObjectId: string,
): Promise<KnowledgeCorrectionsView> => {
  const corrections = await fetchKnowledgeCorrections(scope, knowledgeObjectId)
  return corrections.ok
    ? { status: "ready", corrections: corrections.value }
    : { status: "unavailable", failure: describeFailure(corrections.failure) }
}

/**
 * The Knowledge Objects a reviewer may name as the replacement.
 *
 * `LIFE-003` requires both objects to be currently `APPROVED` or `EDITED`, so
 * the two eligible queues are read and merged. The backend refuses an
 * ineligible one either way; offering only eligible ones saves a round trip
 * rather than deciding anything.
 */
const readSupersessionCandidates = async (
  scope: RepositoryScope,
  excluding: string,
): Promise<readonly SupersessionCandidate[]> => {
  const pages = await Promise.all(
    (["APPROVED", "EDITED"] as const).map((reviewStatus) =>
      fetchKnowledgePage(scope, { reviewStatus }),
    ),
  )

  return pages
    .flatMap((page) => (page.ok ? page.value.items : []))
    .filter((summary) => summary.knowledgeObjectId !== excluding)
    .map((summary) => ({
      knowledgeObjectId: summary.knowledgeObjectId,
      shortClaim: summary.shortClaim,
      reviewLabel: reviewDecisionLabel(summary.reviewStatus),
    }))
}

const readSupersessionTarget = async (
  scope: RepositoryScope,
  knowledgeObjectId: string,
): Promise<SupersessionTarget> => {
  const [lifecycle, detail] = await Promise.all([
    fetchKnowledgeLifecycleState(scope, knowledgeObjectId),
    fetchKnowledgeDetail(scope, knowledgeObjectId),
  ])

  if (!lifecycle.ok) {
    return { status: "unavailable", failure: describeFailure(lifecycle.failure) }
  }
  if (!detail.ok) {
    return { status: "unavailable", failure: describeFailure(detail.failure) }
  }

  return {
    status: "ready",
    knowledgeObjectId,
    shortClaim: detail.value.knowledge,
    reviewSequence: lifecycle.value.reviewSequence,
    lifecycleVersion: lifecycle.value.lifecycleVersion,
  }
}

export const readKnowledgeDetail = async (
  knowledgeObjectId: string,
  options: { readonly supersedeWith?: string } = {},
): Promise<KnowledgeDetailView> => {
  if (!isUuid(knowledgeObjectId)) return { status: "not-found" }

  const resolved = await resolveScope()
  if (resolved.status === "unavailable") return resolved

  const detail = await fetchKnowledgeDetail(resolved.scope, knowledgeObjectId)
  if (!detail.ok) {
    const failure = detail.failure
    // The backend refuses a foreign resource without disclosing whether it
    // exists, so the Console answers the refusal exactly as it answers an
    // identifier that is not a UUID. Anything else would let a caller tell a
    // well-formed identifier from one that is merely not theirs.
    if (failure.kind === "error" && failure.error.error.code === "RESOURCE_NOT_FOUND") {
      return { status: "not-found" }
    }
    return { status: "unavailable", failure: describeFailure(failure) }
  }

  // A rejected or quarantined run is a legitimate machine outcome that
  // produced no knowledge. It never renders as a Knowledge Object, so the
  // page answers exactly as it would for an identifier that is not the
  // caller's.
  if (!isAdmittedKnowledge(detail.value.technicalDetails.admissionDisposition)) {
    return { status: "not-found" }
  }

  const [evidence, history, corrections] = await Promise.all([
    readEvidence(resolved.scope, knowledgeObjectId),
    readHistory(resolved.scope, knowledgeObjectId),
    readCorrections(resolved.scope, knowledgeObjectId),
  ])

  const controls = knowledgeControls(
    detail.value.review,
    detail.value.lifecycle,
    resolved.capabilities,
  )

  // Only paid for where the control exists. A page that cannot supersede has
  // no reason to enumerate replacements.
  const selected =
    options.supersedeWith !== undefined && isUuid(options.supersedeWith)
      ? options.supersedeWith
      : undefined

  return {
    status: "ready",
    detail: detail.value,
    evidence,
    history,
    corrections,
    controls,
    supersession: {
      candidates: controls.canSupersede
        ? await readSupersessionCandidates(resolved.scope, knowledgeObjectId)
        : [],
      target:
        controls.canSupersede && selected !== undefined
          ? await readSupersessionTarget(resolved.scope, selected)
          : null,
    },
  }
}
