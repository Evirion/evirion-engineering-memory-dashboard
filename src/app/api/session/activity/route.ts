import { NextResponse, type NextRequest } from "next/server"

import { readSession } from "@/lib/auth/session-broker"
import { readServerEnvironment } from "@/lib/env/server"
import { mapConsoleError } from "@/lib/errors/console-errors"
import { guardMutation, sessionBindingFrom } from "@/server/actions/mutation-guard"
import { fetchSessionContext, newCorrelationId } from "@/server/adapters/console-api"

export const dynamic = "force-dynamic"

const NO_STORE = "private, no-store, max-age=0, must-revalidate"

const answer = (status: number): NextResponse =>
  new NextResponse(null, { status, headers: { "cache-control": NO_STORE } })

/**
 * Report that a human is still here.
 *
 * The idle window belongs to the database and is extended by
 * `touch_current_console_session`, which every authenticated read already
 * calls. Reading a page is not a navigation, so a reader who is present but not
 * clicking never reaches that routine and the window closes under them. This
 * route performs one ordinary session-context read on their behalf.
 *
 * It is a POST behind the mutation guard rather than a GET because extending a
 * session is a state change: a cross-site page must not be able to keep someone
 * signed in without their knowledge.
 *
 * It answers with a status and no body. Nothing about the session, the
 * organization or the remaining window is disclosed here, and the backend
 * remains the only authority on when a session ends.
 */
export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const guard = await guardMutation(request, sessionBindingFrom)
  if (!guard.ok) {
    return answer(guard.failure.kind === "unauthenticated" ? 401 : 403)
  }

  const outcome = readSession(
    Object.fromEntries(
      request.cookies.getAll().map((cookie) => [cookie.name, cookie.value]),
    ),
  )
  if (outcome.status !== "active") return answer(401)

  const result = await fetchSessionContext(readServerEnvironment().consoleApiBaseUrl, {
    accessToken: outcome.session.accessToken,
    correlationId: newCorrelationId(),
  })
  if (result.ok) return answer(204)

  if (result.failure.kind === "error") {
    const mapped = mapConsoleError(result.failure.error)
    // The window has already closed, or the session is gone. The caller reloads
    // and the protected shell decides where they go.
    return answer(mapped.treatment === "sign-in-required" ? 401 : 503)
  }
  return answer(503)
}
