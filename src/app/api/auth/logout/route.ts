import { NextResponse, type NextRequest } from "next/server"

import { clearSession, readSession } from "@/lib/auth/session-broker"
import {
  providerEffectFor,
  type RevocationSelection,
} from "@/lib/auth/session-revocation"
import { clearReauthenticationCookies } from "@/lib/auth/reauthentication-state"
import { guardMutation, sessionBindingFrom } from "@/server/actions/mutation-guard"
import { clearPreAuthCookies } from "@/lib/auth/pre-auth-cookies"
import { canonicalRedirect } from "@/server/actions/redirects"

export const dynamic = "force-dynamic"

/**
 * Logout.
 *
 * Application denial commits first: the cookies are cleared and the response
 * is sent regardless of what the provider does next. The provider sign-out is
 * a reconciled follow-up, because its access token can remain valid until
 * `exp` and must never be able to restore authorization by itself.
 */
export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const guard = await guardMutation(request, sessionBindingFrom)

  // Even a refused logout clears local state: refusing to sign out because a
  // proof expired would be a worse failure than signing out.
  const response = NextResponse.redirect(canonicalRedirect("/auth/sign-in"), 303)

  const cookies = Object.fromEntries(
    request.cookies.getAll().map((cookie) => [cookie.name, cookie.value]),
  )
  const outcome = readSession(cookies)

  for (const instruction of [
    ...clearSession(),
    ...clearPreAuthCookies(),
    ...clearReauthenticationCookies(),
  ]) {
    response.cookies.set({
      ...instruction,
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
    })
  }

  if (!guard.ok || outcome.status !== "active") return response

  const selection =
    (guard.form.get("selection") as RevocationSelection | null) ?? "current"
  const effect = providerEffectFor(selection)
  response.headers.set("x-console-provider-effect", effect.kind)

  return response
}
