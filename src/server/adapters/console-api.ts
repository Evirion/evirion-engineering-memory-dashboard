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
 * Every response arrives inside the contract envelope, and both halves are
 * checked the same way: the envelope first, then the payload against the
 * generated runtime schema. An unrecognised shape is an explicit unsupported
 * state, not a partially rendered document, and a raw SQL, Supabase, GitHub,
 * worker or provider error is never forwarded.
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
  | {
      readonly ok: true
      readonly value: T
      /** The backend request identifier, quoted to support without a retry. */
      readonly requestId: string
    }
  | { readonly ok: false; readonly failure: ConsoleFailure }

export type SuccessEnvelope = {
  readonly contractVersion: "1.0"
  readonly requestId: string
  readonly data: unknown
}

const UUID =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

/**
 * The success half of the response envelope, checked exactly as the generated
 * `isConsoleError` checks the failure half.
 *
 * Both halves must agree. Unwrapping `data` without pinning `contractVersion`
 * would let a backend version bump pass silently on success while the error
 * path still rejected it, which is precisely what the field exists to prevent.
 * `data` carries no schema in the contract, so only its presence is asserted
 * here and the payload validator owns its shape.
 */
export const isSuccessEnvelope = (value: unknown): value is SuccessEnvelope => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false
  const envelope = value as Record<string, unknown>

  return (
    Object.keys(envelope).every((key) =>
      ["contractVersion", "data", "requestId"].includes(key),
    ) &&
    envelope["contractVersion"] === "1.0" &&
    "data" in envelope &&
    typeof envelope["requestId"] === "string" &&
    UUID.test(envelope["requestId"])
  )
}

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

/**
 * Join a contract path onto the configured base.
 *
 * `new URL("/v1/session/context", base)` looks like it does this and does not:
 * an absolute path replaces the base's own path entirely. Supabase serves an
 * Edge Function under `/functions/v1/<name>`, so that silently addressed the
 * project root, which answers `requested path is invalid` in a shape no
 * contract validator accepts. The Console then failed closed with an unknown
 * outcome, and the backend logged nothing because it was never reached.
 *
 * Contract paths stay absolute, as the contract writes them; the base keeps
 * whatever prefix it carries.
 */
export const resolveConsoleUrl = (baseUrl: string, path: string): string => {
  const target = new URL(baseUrl)
  // Split path from query against a throwaway origin: assigning a path that
  // still carries `?` to `pathname` percent-encodes the separator, which turns
  // a paged read into a request for one absurdly named collection.
  const relative = new URL(path, "https://console.invalid")

  target.pathname = `${target.pathname.replace(/\/+$/, "")}${relative.pathname}`
  target.search = relative.search
  return target.toString()
}

export const callConsoleApi = async <T>(
  baseUrl: string,
  request: ConsoleRequest,
  isExpected: (value: unknown) => value is T,
  transport: ConsoleTransport = fetch,
): Promise<ConsoleResult<T>> => {
  let response: { status: number; json: () => Promise<unknown> }

  try {
    response = await transport(resolveConsoleUrl(baseUrl, request.path), {
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

  if (!isSuccessEnvelope(payload) || !isExpected(payload.data)) {
    return { ok: false, failure: { kind: "unsupported", status: response.status } }
  }

  return { ok: true, value: payload.data, requestId: payload.requestId }
}

/**
 * The private session bootstrap.
 *
 * It is absent from the customer OpenAPI on purpose, so it has no generated
 * validator. The exact bearer token alone is not sufficient: the backend also
 * requires the one-time BFF-signed proof, which no browser can mint. Being
 * internal does not exempt it from the envelope: the backend answers every
 * route, this one included, through its single success responder.
 */
export const SESSION_BOOTSTRAP_PATH = "/internal/console/v1/session/bootstrap"

/**
 * The step between a verified code and a session.
 *
 * `bootstrap_console_auth_session` will not create a session unless a pre-auth
 * transaction already exists in `otp_verified`, keyed by the identifier the
 * bootstrap names. Only the backend can create one, and it does so here. The
 * BFF used to invent an identifier of its own and send that, so the row was
 * never found and every sign-in was refused.
 *
 * Two routes issue it. An established member takes `/v1/session/pre-auth`. A
 * reader holding an invitation takes the acceptance route, which additionally
 * turns their membership from `invited` into `active` — the only way that
 * transition ever happens. Both answer with a transaction already advanced to
 * `otp_verified`.
 */
export const SESSION_PRE_AUTH_PATH = "/v1/session/pre-auth"

export const invitationAcceptancePath = (invitationId: string): string =>
  `/v1/invitations/${invitationId}/accept`

export type PreAuthTransaction = { readonly preAuthTransactionId: string }

const isPreAuthTransaction = (value: unknown): value is PreAuthTransaction =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as { preAuthTransactionId?: unknown }).preAuthTransactionId === "string"

export const issuePreAuthTransaction = async (
  baseUrl: string,
  path: string,
  request: Omit<ConsoleRequest, "method" | "path" | "body">,
  transport?: ConsoleTransport,
): Promise<ConsoleResult<PreAuthTransaction>> =>
  callConsoleApi<PreAuthTransaction>(
    baseUrl,
    { ...request, method: "POST", path, body: {} },
    isPreAuthTransaction,
    transport,
  )

/**
 * What the backend actually answers, which is a command receipt.
 *
 * The BFF used to require `registered: true`, a field no route has ever sent.
 * Once the request finally became well formed the bootstrap succeeded, the
 * session row was written, and the BFF then discarded the result as
 * unrecognisable and told the reader their session could not be started.
 */
export type BootstrapReceipt = { readonly sessionId: string }

const BOOTSTRAP_RESPONSE_CODE = "CONSOLE_AUTH_SESSION_BOOTSTRAPPED"

const isBootstrapReceipt = (value: unknown): value is BootstrapReceipt => {
  if (typeof value !== "object" || value === null) return false
  const receipt = value as Record<string, unknown>
  if (receipt.status !== "completed") return false
  if (receipt.responseCode !== BOOTSTRAP_RESPONSE_CODE) return false
  const payload = receipt.responsePayload
  if (typeof payload !== "object" || payload === null) return false
  const session = (payload as Record<string, unknown>).session
  if (typeof session !== "object" || session === null) return false
  return typeof (session as Record<string, unknown>).id === "string"
}

export const bootstrapSession = async (
  baseUrl: string,
  request: Omit<ConsoleRequest, "method" | "path">,
  transport?: ConsoleTransport,
): Promise<ConsoleResult<BootstrapReceipt>> =>
  callConsoleApi<BootstrapReceipt>(
    baseUrl,
    { ...request, method: "POST", path: SESSION_BOOTSTRAP_PATH },
    isBootstrapReceipt,
    transport,
  )

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
