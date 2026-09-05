import "server-only"

import { NextResponse, type NextRequest } from "next/server"

import type {
  InvitationReceipt,
  MembershipReceipt,
  OffboardingReceipt,
  SessionContext,
} from "@contracts/console"

import { actionClassForGate } from "@/lib/auth/reauthentication-action-class"
import { isSessionReauthenticationFresh } from "@/lib/auth/reauthentication-freshness"
import { formFieldsFrom, type PendingMutation } from "@/lib/auth/reauthentication-state"
import { readSession } from "@/lib/auth/session-broker"
import { readServerEnvironment } from "@/lib/env/server"
import type { ConsoleResult } from "@/server/adapters/console-api"
import { fetchSessionContext } from "@/server/adapters/console-api"
import { redirectForReauthentication } from "@/server/actions/reauthentication-resume"
import { isUuid } from "@/server/adapters/repositories"
import { guardMutation, sessionBindingFrom } from "@/server/actions/mutation-guard"
import { canonicalRedirect } from "@/server/actions/redirects"

/**
 * The one path a membership mutation takes.
 *
 * Order matches import and repository commands: the frozen mutation boundary
 * settles before any form field is read or any backend effect exists.
 */

export type MembershipCommandFields = {
  readonly idempotencyKey: string
  readonly form: FormData
}

export type MembershipCommandOutcome =
  | {
      readonly status: "ready"
      readonly scope: {
        readonly baseUrl: string
        readonly organizationId: string
        readonly accessToken: string
        readonly correlationId: string
      }
      readonly fields: MembershipCommandFields
      readonly sessionContext: SessionContext
    }
  | { readonly status: "rejected"; readonly response: NextResponse }

const NO_STORE = "private, no-store, max-age=0, must-revalidate"

export const settingsPath = (): string => "/settings/members"

const back = (result: string): NextResponse => {
  const response = NextResponse.redirect(
    canonicalRedirect(`${settingsPath()}?result=${encodeURIComponent(result)}`),
    303,
  )
  response.headers.set("cache-control", NO_STORE)
  return response
}

export const refuseMembershipCommand = (code: "REQUEST_INVALID"): NextResponse =>
  back(code)

const parseVersion = (raw: FormDataEntryValue | null): number | undefined => {
  if (typeof raw !== "string" || raw === "") return undefined
  const value = Number(raw)
  return Number.isInteger(value) && value >= 1 ? value : undefined
}

export const beginMembershipCommand = async (
  request: NextRequest,
): Promise<MembershipCommandOutcome> => {
  const guard = await guardMutation(request, sessionBindingFrom)
  if (!guard.ok) {
    return {
      status: "rejected",
      response: NextResponse.redirect(canonicalRedirect("/auth/sign-in"), 303),
    }
  }

  const form = guard.form
  const idempotencyKey = String(form.get("idempotencyKey") ?? "")
  if (!isUuid(idempotencyKey)) {
    return { status: "rejected", response: refuseMembershipCommand("REQUEST_INVALID") }
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
  const context = await fetchSessionContext(environment.consoleApiBaseUrl, {
    accessToken: outcome.session.accessToken,
    correlationId,
  })
  if (!context.ok) {
    return { status: "rejected", response: back("DEPENDENCY_UNAVAILABLE") }
  }

  return {
    status: "ready",
    scope: {
      baseUrl: environment.consoleApiBaseUrl,
      organizationId: context.value.organizationId,
      accessToken: outcome.session.accessToken,
      correlationId,
    },
    fields: { idempotencyKey, form },
    sessionContext: context.value,
  }
}

export type PendingMutationDraft = Omit<
  PendingMutation,
  "providerSessionId" | "expiresAt"
>

export const membershipPendingMutation = (
  fields: MembershipCommandFields,
  mutationPath: string,
): PendingMutationDraft => ({
  returnPath: settingsPath(),
  mutationPath,
  gate: "membership_change",
  actionClass: actionClassForGate("membership_change"),
  fields: formFieldsFrom(fields.form),
})

export const guardMembershipFreshness = async (
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
 * The receipt code travels back as itself rather than as a generic success.
 * None of the seven membership, invitation and offboarding codes is a published
 * error code, so the surface reads them with its own notice; the unsupported
 * sentinel falls through to the shared reader and lands on unknown outcome,
 * which is what a response the Console cannot interpret must say.
 */
export const finishMembershipCommand = async (
  result: ConsoleResult<InvitationReceipt | MembershipReceipt | OffboardingReceipt>,
  pending?: PendingMutationDraft,
  sessionContext?: SessionContext,
): Promise<NextResponse> => {
  if (result.ok) return back(result.value.responseCode)

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
      return back(result.failure.error.error.code)
    case "unsupported":
      return back("UNSUPPORTED_SERVER_RESPONSE")
    case "unreachable":
      return back("DEPENDENCY_UNAVAILABLE")
    default: {
      const exhaustive: never = result.failure
      throw new Error(`unhandled console failure: ${JSON.stringify(exhaustive)}`)
    }
  }
}

export const readExpectedVersion = (form: FormData): number | undefined =>
  parseVersion(form.get("expectedVersion"))

export const readInvitationId = (form: FormData): string | undefined => {
  const raw = String(form.get("invitationId") ?? "")
  return isUuid(raw) ? raw : undefined
}

export const readMembershipId = (form: FormData): string | undefined => {
  const raw = String(form.get("membershipId") ?? "")
  return isUuid(raw) ? raw : undefined
}

export const readMembershipRole = (
  form: FormData,
): "admin" | "reviewer" | "viewer" | undefined => {
  const raw = String(form.get("role") ?? "")
  return raw === "admin" || raw === "reviewer" || raw === "viewer" ? raw : undefined
}

export const readInvitationRole = readMembershipRole

/**
 * A floor, not the authority. The backend owns which address it will accept;
 * this only refuses input no address can be, before a mutation is attempted.
 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const readInvitationEmail = (form: FormData): string | undefined => {
  const raw = String(form.get("email") ?? "").trim()
  return EMAIL.test(raw) ? raw : undefined
}

export const readOffboardingReason = (form: FormData): string | undefined => {
  const raw = String(form.get("reason") ?? "").trim()
  return raw === "" ? undefined : raw
}
