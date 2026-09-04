import "server-only"

import { NextResponse, type NextRequest } from "next/server"

import type { KnowledgeReceipt, SessionContext } from "@contracts/console"

import { actionClassForGate } from "@/lib/auth/reauthentication-action-class"
import { isSessionReauthenticationFresh } from "@/lib/auth/reauthentication-freshness"
import { formFieldsFrom, type PendingMutation } from "@/lib/auth/reauthentication-state"
import { readSession } from "@/lib/auth/session-broker"
import { readServerEnvironment } from "@/lib/env/server"
import type { ConsoleResult } from "@/server/adapters/console-api"
import { fetchSessionContext } from "@/server/adapters/console-api"
import { redirectForReauthentication } from "@/server/actions/reauthentication-resume"
import { type RepositoryScope, isUuid } from "@/server/adapters/repositories"
import { guardMutation, sessionBindingFrom } from "@/server/actions/mutation-guard"
import { canonicalRedirect } from "@/server/actions/redirects"

/**
 * The one path a knowledge mutation takes.
 *
 * It is the import command path applied to a different resource, and it keeps
 * the same order: origin, canonical host, Fetch Metadata, content type,
 * trusted proxy and session-bound CSRF proof are all settled by
 * `guardMutation` before anything is read from the form and before any effect
 * exists. Only then is the command forwarded, with the caller's own token, the
 * canonical idempotency key the form carried and the optimistic tokens the
 * backend last reported.
 *
 * It is a separate module rather than a parameter on the import one because
 * the two resources disagree about optimistic concurrency: an import carries
 * one status, a Knowledge Object carries a review sequence and a lifecycle
 * version that go stale independently, and a supersession carries four.
 *
 * Success is claimed only from a committed receipt.
 */

export type KnowledgeCommandFields = {
  readonly knowledgeObjectId: string
  readonly idempotencyKey: string
  readonly form: FormData
}

export type KnowledgeCommandOutcome =
  | {
      readonly status: "ready"
      readonly scope: RepositoryScope
      readonly fields: KnowledgeCommandFields
      readonly sessionContext: SessionContext
    }
  | { readonly status: "rejected"; readonly response: NextResponse }

const NO_STORE = "private, no-store, max-age=0, must-revalidate"

const back = (path: string, result: string): NextResponse => {
  const response = NextResponse.redirect(
    canonicalRedirect(`${path}?result=${encodeURIComponent(result)}`),
    303,
  )
  response.headers.set("cache-control", NO_STORE)
  return response
}

export const knowledgePath = (knowledgeObjectId: string): string =>
  isUuid(knowledgeObjectId) ? `/memory/${knowledgeObjectId}` : "/memory"

/**
 * Refuse before the backend is called.
 *
 * Only for input this surface can judge on its own, such as a reject reason
 * the contract does not publish. It never fabricates a backend error envelope,
 * because a response the backend did not send is not evidence.
 */
export const refuseKnowledgeCommand = (
  knowledgeObjectId: string,
  code: "REQUEST_INVALID",
): NextResponse => back(knowledgePath(knowledgeObjectId), code)

/**
 * An optimistic token exactly as the backend reported it.
 *
 * Zero is legitimate on both: review sequence zero is `PENDING` and lifecycle
 * version zero is `UNRESOLVED`. A parser that treated zero as absent would
 * silently turn the first review of an object into a stale request.
 */
export const readExpectedSequence = (
  form: FormData,
  field: string,
): number | undefined => {
  const raw = form.get(field)
  if (typeof raw !== "string" || !/^\d{1,15}$/.test(raw)) return undefined
  return Number(raw)
}

export const beginKnowledgeCommand = async (
  request: NextRequest,
): Promise<KnowledgeCommandOutcome> => {
  const guard = await guardMutation(request, sessionBindingFrom)
  if (!guard.ok) {
    // Origin, Fetch Metadata, content type, proxy or CSRF failed. No form
    // field has been read and no effect exists.
    return {
      status: "rejected",
      response: NextResponse.redirect(canonicalRedirect("/auth/sign-in"), 303),
    }
  }

  const form = guard.form
  const knowledgeObjectId = String(form.get("knowledgeObjectId") ?? "")
  const idempotencyKey = String(form.get("idempotencyKey") ?? "")

  // Refused before any backend call, so a malformed identifier costs nothing
  // and reaches nothing.
  if (!isUuid(knowledgeObjectId) || !isUuid(idempotencyKey)) {
    return {
      status: "rejected",
      response: back(knowledgePath(knowledgeObjectId), "REQUEST_INVALID"),
    }
  }

  const jar = request.cookies.getAll()
  const outcome = readSession(Object.fromEntries(jar.map((c) => [c.name, c.value])))
  if (outcome.status !== "active") {
    return {
      status: "rejected",
      response: NextResponse.redirect(canonicalRedirect("/auth/sign-in"), 303),
    }
  }

  const environment = readServerEnvironment()
  const correlationId = crypto.randomUUID()

  // The organization is the backend's live projection for this token. A
  // caller-supplied organization is never an authorization source.
  const context = await fetchSessionContext(environment.consoleApiBaseUrl, {
    accessToken: outcome.session.accessToken,
    correlationId,
  })
  if (!context.ok) {
    return {
      status: "rejected",
      response: back(knowledgePath(knowledgeObjectId), "DEPENDENCY_UNAVAILABLE"),
    }
  }

  return {
    status: "ready",
    scope: {
      baseUrl: environment.consoleApiBaseUrl,
      organizationId: context.value.organizationId,
      accessToken: outcome.session.accessToken,
      correlationId,
    },
    fields: { knowledgeObjectId, idempotencyKey, form },
    sessionContext: context.value,
  }
}

export type PendingMutationDraft = Omit<
  PendingMutation,
  "providerSessionId" | "expiresAt"
>

export const knowledgePendingMutation = (
  fields: KnowledgeCommandFields,
  mutationPath: string,
): PendingMutationDraft => ({
  returnPath: knowledgePath(fields.knowledgeObjectId),
  mutationPath,
  gate: "knowledge_lifecycle",
  actionClass: actionClassForGate("knowledge_lifecycle"),
  fields: formFieldsFrom(fields.form),
})

export const guardKnowledgeFreshness = async (
  sessionContext: SessionContext,
  pending: PendingMutationDraft,
): Promise<NextResponse | undefined> => {
  if (isSessionReauthenticationFresh(sessionContext)) return undefined
  const sessionId = sessionContext.session?.id
  if (typeof sessionId !== "string" || sessionId === "") {
    return undefined
  }
  return redirectForReauthentication(pending, sessionId)
}

/**
 * Turn a command result into the next page.
 *
 * The four knowledge response codes travel back as themselves rather than as a
 * generic success, because none of them is a published error code and the
 * shared reader would fail closed on one, telling the customer the outcome is
 * unknown for a command that committed and changed state.
 *
 * A published stable code travels back so the surface can explain a refusal.
 * Retryability deliberately does not: it belongs to the backend payload that
 * produced it, and a boolean re-derived on a later request would be the UI
 * asserting something no backend told it.
 */
export const finishKnowledgeCommand = async (
  knowledgeObjectId: string,
  result: ConsoleResult<KnowledgeReceipt>,
  pending?: PendingMutationDraft,
  sessionContext?: SessionContext,
): Promise<NextResponse> => {
  const path = knowledgePath(knowledgeObjectId)
  if (result.ok) return back(path, result.value.responseCode)

  switch (result.failure.kind) {
    case "error":
      if (result.failure.error.error.code === "REAUTHENTICATION_REQUIRED") {
        const sessionId = sessionContext?.session?.id
        if (
          pending !== undefined &&
          typeof sessionId === "string" &&
          sessionId !== ""
        ) {
          return redirectForReauthentication(pending, sessionId)
        }
      }
      return back(path, result.failure.error.error.code)
    case "unsupported":
      return back(path, "UNSUPPORTED_SERVER_RESPONSE")
    case "unreachable":
      return back(path, "DEPENDENCY_UNAVAILABLE")
    default: {
      const exhaustive: never = result.failure
      throw new Error(`unhandled console failure: ${JSON.stringify(exhaustive)}`)
    }
  }
}
