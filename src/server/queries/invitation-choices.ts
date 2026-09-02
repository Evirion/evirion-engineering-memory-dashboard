import "server-only"

import { cookies } from "next/headers"

import { isConsoleError } from "@contracts/console"

import { readSession } from "@/lib/auth/session-broker"
import { readServerEnvironment } from "@/lib/env/server"
import { describeTreatment, mapConsoleError } from "@/lib/errors/console-errors"
import { readPreAuthCsrfToken } from "@/server/actions/pre-auth"
import { isSuccessEnvelope } from "@/server/adapters/console-api"

/**
 * Post-authentication invitation choices.
 *
 * Labels are only ever read after the email is verified, and each choice is
 * carried as an opaque identifier. Nothing here reveals an organization name,
 * slug or count to an unauthenticated caller.
 */

export type InvitationChoice = {
  readonly invitationId: string
  readonly organizationLabel: string
}

export type InvitationChoices =
  | { readonly status: "unauthenticated" }
  | { readonly status: "none" }
  | { readonly status: "single"; readonly only: InvitationChoice }
  | {
      readonly status: "multiple"
      readonly invitations: readonly InvitationChoice[]
      readonly csrfToken: string
    }
  | { readonly status: "unavailable"; readonly message: string }

const asChoices = (value: unknown): InvitationChoice[] | undefined => {
  if (!Array.isArray(value)) return undefined
  const choices: InvitationChoice[] = []
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) return undefined
    const candidate = entry as Record<string, unknown>
    if (
      typeof candidate["invitationId"] !== "string" ||
      typeof candidate["organizationLabel"] !== "string"
    ) {
      return undefined
    }
    choices.push({
      invitationId: candidate["invitationId"],
      organizationLabel: candidate["organizationLabel"],
    })
  }
  return choices
}

/**
 * This route is read directly rather than through `callConsoleApi`, so it
 * reuses that adapter's envelope guard instead of carrying a second one. Two
 * envelope handlers would drift apart, and this one already had.
 */
export const parseInvitationChoices = (
  payload: unknown,
): InvitationChoice[] | undefined => {
  if (!isSuccessEnvelope(payload)) return undefined
  const { data } = payload
  if (typeof data !== "object" || data === null) return undefined
  return asChoices((data as { invitations?: unknown }).invitations)
}

export const readInvitationChoices = async (): Promise<InvitationChoices> => {
  const jar = await cookies()
  const outcome = readSession(
    Object.fromEntries(jar.getAll().map((cookie) => [cookie.name, cookie.value])),
  )

  if (outcome.status !== "active") return { status: "unauthenticated" }

  const response = await fetch(
    new URL(
      "/v1/session/pre-auth",
      readServerEnvironment().consoleApiBaseUrl,
    ).toString(),
    {
      headers: {
        accept: "application/json",
        authorization: `Bearer ${outcome.session.accessToken}`,
      },
      cache: "no-store",
    },
  ).catch(() => undefined)

  if (!response) {
    return { status: "unavailable", message: describeTreatment("retry-bounded") }
  }

  const payload: unknown = await response.json().catch(() => undefined)

  if (response.status >= 400) {
    // Only a contract-shaped error is mapped; anything else is unknown.
    const mapped = isConsoleError(payload) ? mapConsoleError(payload) : undefined
    return {
      status: "unavailable",
      message: describeTreatment(mapped?.treatment ?? "unknown-outcome"),
    }
  }

  const choices = parseInvitationChoices(payload)
  // An unrecognised shape fails closed rather than rendering a partial list.
  if (!choices)
    return { status: "unavailable", message: describeTreatment("unknown-outcome") }

  if (choices.length === 0) return { status: "none" }
  if (choices.length === 1)
    return { status: "single", only: choices[0] as InvitationChoice }

  return {
    status: "multiple",
    invitations: choices,
    csrfToken: await readPreAuthCsrfToken(),
  }
}
