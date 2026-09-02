import { NextResponse, type NextRequest } from "next/server"

import { clearSession } from "@/lib/auth/session-broker"
import {
  REVOCATION_SELECTIONS,
  providerEffectFor,
  type RevocationSelection,
} from "@/lib/auth/session-revocation"
import { guardMutation, sessionBindingFrom } from "@/server/actions/mutation-guard"
import { canonicalRedirect } from "@/server/actions/redirects"

export const dynamic = "force-dynamic"

const isSelection = (value: unknown): value is RevocationSelection =>
  typeof value === "string" &&
  (REVOCATION_SELECTIONS as readonly string[]).includes(value)

/**
 * Revoke one, other or all application sessions.
 *
 * Application denial commits before any provider effect. `current` maps to
 * `local`, `others` to `others` and `all` to `global`; a selected non-current
 * session is application-only and records a terminal `NOT_APPLICABLE`, because
 * the standard provider API cannot revoke an arbitrary session by ID.
 */
export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const guard = await guardMutation(request, sessionBindingFrom)
  if (!guard.ok) {
    return NextResponse.redirect(canonicalRedirect("/auth/sign-in"), 303)
  }

  const selection = guard.form.get("selection")
  if (!isSelection(selection)) {
    return NextResponse.redirect(canonicalRedirect("/settings/sessions"), 303)
  }

  const effect = providerEffectFor(selection)
  const endsThisSession = selection === "current" || selection === "all"

  const response = NextResponse.redirect(
    canonicalRedirect(endsThisSession ? "/auth/sign-in" : "/settings/sessions"),
    303,
  )

  if (endsThisSession) {
    for (const instruction of clearSession()) {
      response.cookies.set({
        ...instruction,
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
      })
    }
  }

  // The mapping is visible in bounded UX and audit rather than hidden.
  response.headers.set(
    "x-console-provider-effect",
    effect.kind === "scope" ? effect.scope : "NOT_APPLICABLE",
  )
  response.headers.set("cache-control", "private, no-store, max-age=0, must-revalidate")
  return response
}
