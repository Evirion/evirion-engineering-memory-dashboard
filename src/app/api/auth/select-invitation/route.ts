import { NextResponse, type NextRequest } from "next/server"

import { importProofKey, signBootstrapProof } from "@/lib/auth/bootstrap-proof"
import {
  PRE_AUTH_EMAIL_COOKIE,
  PRE_AUTH_TRANSACTION_COOKIE,
  clearPreAuthCookies,
} from "@/lib/auth/pre-auth-cookies"
import { readSession } from "@/lib/auth/session-broker"
import { readServerEnvironment } from "@/lib/env/server"
import { guardMutation } from "@/server/actions/mutation-guard"
import { canonicalRedirect } from "@/server/actions/redirects"
import { SESSION_BOOTSTRAP_PATH, bootstrapSession } from "@/server/adapters/console-api"

export const dynamic = "force-dynamic"

const OPAQUE_ID = /^[A-Za-z0-9_-]{1,128}$/

/**
 * Accept one invitation when several were eligible.
 *
 * The email is already verified at this point, so the choice is explicit and
 * carries only an opaque identifier. The backend rechecks the invitation, the
 * verified user and the membership under its own locks; nothing here decides
 * whether the selection is legitimate.
 */
export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const guard = await guardMutation(request, (cookies) => {
    const transactionId = cookies[PRE_AUTH_TRANSACTION_COOKIE]
    if (!transactionId) return undefined
    return {
      kind: "pre-auth",
      transactionId,
      emailIdentityHmac: cookies[PRE_AUTH_EMAIL_COOKIE] ?? "",
      generation: 1,
    }
  })

  if (!guard.ok || guard.binding.kind !== "pre-auth") {
    return NextResponse.redirect(canonicalRedirect("/auth/sign-in"), 303)
  }

  const invitationId = guard.form.get("invitationId")
  if (typeof invitationId !== "string" || !OPAQUE_ID.test(invitationId)) {
    return NextResponse.redirect(canonicalRedirect("/auth/invite"), 303)
  }

  const cookies = Object.fromEntries(
    request.cookies.getAll().map((cookie) => [cookie.name, cookie.value]),
  )
  const outcome = readSession(cookies)
  if (outcome.status !== "active") {
    return NextResponse.redirect(canonicalRedirect("/auth/sign-in"), 303)
  }

  const environment = readServerEnvironment()
  const idempotencyKey = `bootstrap:${outcome.session.providerSessionId}:${invitationId}`
  const body = { invitationId }

  const { proof } = await signBootstrapProof(
    await importProofKey(environment.bootstrapProofSigningKey),
    {
      accessToken: outcome.session.accessToken,
      method: "POST",
      path: SESSION_BOOTSTRAP_PATH,
      subject: outcome.session.providerSessionId,
      sessionId: outcome.session.providerSessionId,
      preAuthTransactionId: guard.binding.transactionId,
      invitationId,
      idempotencyKey,
      body,
      issuedAt: Math.floor(Date.now() / 1000),
    },
  )

  const bootstrap = await bootstrapSession(environment.consoleApiBaseUrl, {
    accessToken: outcome.session.accessToken,
    correlationId: idempotencyKey,
    idempotencyKey,
    body,
    bootstrapProof: proof,
  })

  // A terminal refusal activates nothing and returns the customer to the
  // choice; a transient failure keeps the pre-auth state so the same selection
  // can be replayed under the same idempotency key.
  const target =
    !bootstrap.ok && bootstrap.failure.kind === "error" ? "/auth/invite" : "/onboarding"
  const response = NextResponse.redirect(canonicalRedirect(target), 303)

  if (bootstrap.ok) {
    for (const instruction of clearPreAuthCookies()) {
      response.cookies.set({
        ...instruction,
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
      })
    }
  }

  response.headers.set("cache-control", "private, no-store, max-age=0, must-revalidate")
  return response
}
