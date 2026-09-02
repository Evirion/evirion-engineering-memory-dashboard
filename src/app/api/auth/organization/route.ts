import { NextResponse, type NextRequest } from "next/server"

import { COOKIE_ATTRIBUTES } from "@/lib/auth/session-cookies"
import { SESSION_POLICY } from "@/lib/auth/session-policy"
import { guardMutation, sessionBindingFrom } from "@/server/actions/mutation-guard"
import { canonicalRedirect } from "@/server/actions/redirects"

export const dynamic = "force-dynamic"

export const ORGANIZATION_PREFERENCE_COOKIE = "__Host-console-organization"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Change the active organization.
 *
 * This is a navigation preference and nothing else. It mints no capability:
 * every backend path carries an explicit organization target and re-derives
 * tenant access from trusted relationships, so editing this cookie cannot open
 * another tenant. It is stored only to choose where to land after a reload.
 */
export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const guard = await guardMutation(request, sessionBindingFrom)
  if (!guard.ok) {
    return NextResponse.redirect(canonicalRedirect("/auth/sign-in"), 303)
  }

  const organizationId = guard.form.get("organizationId")
  const response = NextResponse.redirect(canonicalRedirect("/onboarding"), 303)

  // A malformed value is dropped rather than stored, so the preference can
  // never carry something a later request would have to interpret.
  if (typeof organizationId === "string" && UUID.test(organizationId)) {
    response.cookies.set({
      name: ORGANIZATION_PREFERENCE_COOKIE,
      value: organizationId,
      ...COOKIE_ATTRIBUTES,
      maxAge: SESSION_POLICY.absoluteSessionSeconds,
    })
  }

  response.headers.set("cache-control", "private, no-store, max-age=0, must-revalidate")
  return response
}
