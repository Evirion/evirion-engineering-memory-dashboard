import "server-only"

import {
  type ConsoleError,
  type SessionContext,
  isConsoleError,
  isSessionContext,
} from "@contracts/console"

/**
 * The only path from the Console to the backend.
 *
 * Every response is validated with the generated runtime schema before it
 * reaches a page. An unrecognised shape is an explicit unsupported state, not
 * a partially rendered document, and a raw SQL, Supabase, GitHub, worker or
 * provider error is never forwarded.
 *
 * This adapter forwards the caller token, a canonical idempotency key, the
 * exact expected-version set and a bounded correlation ID. It never sends a
 * service-role key, a DSN, or a caller-supplied organization claim.
 */

export type ConsoleFailure =
  | { readonly kind: "error"; readonly error: ConsoleError; readonly status: number }
  | { readonly kind: "unsupported"; readonly status: number }
  | { readonly kind: "unreachable" }

export type ConsoleResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly failure: ConsoleFailure }

export type ConsoleRequest = {
  readonly method: "GET" | "POST" | "PATCH" | "DELETE"
  readonly path: string
  readonly accessToken: string
  readonly correlationId: string
  readonly idempotencyKey?: string
  readonly expectedVersions?: Readonly<Record<string, number>>
  readonly body?: unknown
  /** Only the private bootstrap call carries one, and only the BFF can sign it. */
  readonly bootstrapProof?: string
}

export type ConsoleTransport = (
  url: string,
  init: RequestInit,
) => Promise<{ status: number; json: () => Promise<unknown> }>

const bounded = (value: string, limit: number): string => value.slice(0, limit)

export const buildConsoleHeaders = (request: ConsoleRequest): Headers => {
  const headers = new Headers({
    accept: "application/json",
    authorization: `Bearer ${request.accessToken}`,
    "x-correlation-id": bounded(request.correlationId, 64),
  })

  if (request.body !== undefined) headers.set("content-type", "application/json")
  if (request.idempotencyKey) {
    headers.set("idempotency-key", bounded(request.idempotencyKey, 128))
  }
  for (const [name, version] of Object.entries(request.expectedVersions ?? {})) {
    // Optimistic versions come from the backend and are forwarded unchanged.
    headers.set(`expected-${name}-version`, String(version))
  }
  if (request.bootstrapProof) headers.set("x-console-bff-proof", request.bootstrapProof)

  return headers
}

export const callConsoleApi = async <T>(
  baseUrl: string,
  request: ConsoleRequest,
  isExpected: (value: unknown) => value is T,
  transport: ConsoleTransport = fetch,
): Promise<ConsoleResult<T>> => {
  let response: { status: number; json: () => Promise<unknown> }

  try {
    response = await transport(new URL(request.path, baseUrl).toString(), {
      method: request.method,
      headers: buildConsoleHeaders(request),
      ...(request.body === undefined ? {} : { body: JSON.stringify(request.body) }),
      // Alpha forbids caching any authenticated tenant response.
      cache: "no-store",
      redirect: "error",
    })
  } catch {
    return { ok: false, failure: { kind: "unreachable" } }
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    return { ok: false, failure: { kind: "unsupported", status: response.status } }
  }

  if (response.status >= 400) {
    return isConsoleError(payload)
      ? {
          ok: false,
          failure: { kind: "error", error: payload, status: response.status },
        }
      : { ok: false, failure: { kind: "unsupported", status: response.status } }
  }

  if (!isExpected(payload)) {
    return { ok: false, failure: { kind: "unsupported", status: response.status } }
  }

  return { ok: true, value: payload }
}

export const fetchSessionContext = async (
  baseUrl: string,
  request: Omit<ConsoleRequest, "method" | "path" | "body">,
  transport?: ConsoleTransport,
): Promise<ConsoleResult<SessionContext>> =>
  callConsoleApi<SessionContext>(
    baseUrl,
    { ...request, method: "GET", path: "/v1/session/context" },
    isSessionContext,
    transport,
  )
