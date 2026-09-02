import "server-only"

import type { NextRequest } from "next/server"

import { readSession } from "@/lib/auth/session-broker"
import { readServerEnvironment } from "@/lib/env/server"
import { importCsrfKey, verifyCsrfToken, type CsrfBinding } from "@/lib/security/csrf"
import {
  assertMutationOrigin,
  type MutationRejection,
} from "@/lib/security/request-origin"

/**
 * The single boundary every state-changing BFF route passes through.
 *
 * Order matters. Origin, host, Fetch Metadata, content type and trusted-proxy
 * normalization are checked before the CSRF proof, and the proof is checked
 * before any Auth, bootstrap or domain effect. A request that fails here has
 * performed no side effect at all.
 */

export type GuardFailure =
  | { readonly kind: "origin"; readonly reason: MutationRejection }
  | { readonly kind: "csrf"; readonly reason: string }
  | { readonly kind: "unauthenticated" }

export type GuardResult<T> =
  | { readonly ok: true; readonly form: FormData; readonly binding: T }
  | { readonly ok: false; readonly failure: GuardFailure }

const cookieRecord = (request: NextRequest): Record<string, string> =>
  Object.fromEntries(
    request.cookies.getAll().map((cookie) => [cookie.name, cookie.value]),
  )

/**
 * A request arrives through the trusted edge when the deployment puts one in
 * front of it. Locally and in staging that is always true; a direct hit is
 * evaluated on its own Host instead of on headers the caller supplied.
 */
const viaTrustedProxy = (request: NextRequest): boolean =>
  readServerEnvironment().trustedProxyHops > 0 &&
  request.headers.has("x-forwarded-proto")

export const guardMutation = async (
  request: NextRequest,
  binding: (cookies: Record<string, string>) => CsrfBinding | undefined,
): Promise<GuardResult<CsrfBinding>> => {
  const environment = readServerEnvironment()

  const origin = assertMutationOrigin(
    {
      method: request.method,
      headers: request.headers,
      viaTrustedProxy: viaTrustedProxy(request),
    },
    {
      canonicalOrigin: environment.canonicalOrigin,
      trustedProxyHops: environment.trustedProxyHops,
    },
  )
  if (!origin.allowed)
    return { ok: false, failure: { kind: "origin", reason: origin.reason } }

  const cookies = cookieRecord(request)
  const expected = binding(cookies)
  if (!expected) return { ok: false, failure: { kind: "unauthenticated" } }

  const form = await request.formData()
  const submitted = form.get("csrfToken")
  const cookieName =
    expected.kind === "pre-auth"
      ? "__Host-console-pre-auth-csrf"
      : "__Host-console-session-csrf"

  const verification = await verifyCsrfToken(
    await importCsrfKey(environment.csrfSigningKey),
    {
      cookieToken: cookies[cookieName],
      submittedToken: typeof submitted === "string" ? submitted : undefined,
      expectedBinding: expected,
      now: Math.floor(Date.now() / 1000),
    },
  )

  if (!verification.valid) {
    return { ok: false, failure: { kind: "csrf", reason: verification.reason } }
  }

  return { ok: true, form, binding: verification.binding }
}

export const sessionBindingFrom = (
  cookies: Record<string, string>,
): CsrfBinding | undefined => {
  const outcome = readSession(cookies)
  return outcome.status === "active"
    ? { kind: "session", sessionId: outcome.session.providerSessionId }
    : undefined
}
