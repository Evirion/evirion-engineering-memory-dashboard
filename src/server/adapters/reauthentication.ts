import "server-only"

import {
  type SessionReauthenticationReceipt,
  isSessionReauthenticationReceipt,
} from "@contracts/console"

import { isReauthenticationActionClass } from "@/lib/auth/reauthentication-action-class"
import type { ReauthenticationActionClass } from "@/lib/auth/reauthentication-action-class"
import {
  callConsoleApi,
  type ConsoleRequest,
  type ConsoleResult,
} from "@/server/adapters/console-api"

export type ReauthenticationScope = {
  readonly baseUrl: string
  readonly accessToken: string
  readonly correlationId: string
}

export type IssuedChallenge = {
  readonly challengeId: string
  readonly actionClass: ReauthenticationActionClass
  readonly expiresAt: string
}

const issuedPayload = (
  receipt: SessionReauthenticationReceipt,
): IssuedChallenge | undefined => {
  if (receipt.responseCode !== "CONSOLE_REAUTHENTICATION_ISSUED") return undefined
  const payload = receipt.responsePayload
  const challengeId = payload["challengeId"]
  const actionClass = payload["actionClass"]
  const expiresAt = payload["expiresAt"]
  if (
    typeof challengeId !== "string" ||
    typeof actionClass !== "string" ||
    typeof expiresAt !== "string" ||
    !isReauthenticationActionClass(actionClass)
  ) {
    return undefined
  }
  return {
    challengeId,
    actionClass,
    expiresAt,
  }
}

export const issueSessionReauthentication = async (
  scope: ReauthenticationScope,
  input: {
    readonly actionClass: ReauthenticationActionClass
    readonly idempotencyKey: string
  },
): Promise<ConsoleResult<IssuedChallenge>> => {
  const request: ConsoleRequest = {
    method: "POST",
    path: "/v1/session/reauthentications",
    accessToken: scope.accessToken,
    correlationId: scope.correlationId,
    idempotencyKey: input.idempotencyKey,
    body: { actionClass: input.actionClass },
  }

  const result = await callConsoleApi<SessionReauthenticationReceipt>(
    scope.baseUrl,
    request,
    isSessionReauthenticationReceipt,
  )

  if (!result.ok) return result

  const issued = issuedPayload(result.value)
  if (issued === undefined) {
    return { ok: false, failure: { kind: "unsupported", status: 200 } }
  }

  return { ok: true, value: issued, requestId: result.requestId }
}

export const completeSessionReauthentication = async (
  scope: ReauthenticationScope,
  input: {
    readonly actionClass: ReauthenticationActionClass
    readonly challengeId: string
    readonly idempotencyKey: string
  },
): Promise<ConsoleResult<SessionReauthenticationReceipt>> =>
  callConsoleApi<SessionReauthenticationReceipt>(
    scope.baseUrl,
    {
      method: "POST",
      path: "/v1/session/reauthentication-completions",
      accessToken: scope.accessToken,
      correlationId: scope.correlationId,
      idempotencyKey: input.idempotencyKey,
      body: {
        actionClass: input.actionClass,
        challengeId: input.challengeId,
      },
    },
    isSessionReauthenticationReceipt,
  )
