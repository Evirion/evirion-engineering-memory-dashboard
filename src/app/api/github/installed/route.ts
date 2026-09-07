import { NextResponse, type NextRequest } from "next/server"

import { readSession } from "@/lib/auth/session-broker"
import { readServerEnvironment } from "@/lib/env/server"
import { readInstallationReturn } from "@/lib/repositories/github-installation-return"
import { canonicalRedirect } from "@/server/actions/redirects"
import { fetchSessionContext } from "@/server/adapters/console-api"
import { completeGithubInstallation } from "@/server/adapters/repositories"

export const dynamic = "force-dynamic"

const NO_STORE = "private, no-store, max-age=0, must-revalidate"

const redirectToSettings = (result: string): NextResponse => {
  const response = NextResponse.redirect(
    canonicalRedirect(`/settings/github?result=${encodeURIComponent(result)}`),
    303,
  )
  response.headers.set("cache-control", NO_STORE)
  return response
}

/**
 * Complete the GitHub App installation after the browser returns from GitHub.
 *
 * GitHub supplies only the tenant-bound state and provider installation
 * identifier. Account login proof arrives separately through the signed
 * webhook and is never accepted from this request.
 */
export const GET = async (request: NextRequest): Promise<NextResponse> => {
  const returned = readInstallationReturn(request.nextUrl.searchParams)
  if (returned === null) {
    return redirectToSettings("REQUEST_INVALID")
  }

  const outcome = readSession(
    Object.fromEntries(
      request.cookies.getAll().map((cookie) => [cookie.name, cookie.value]),
    ),
  )
  if (outcome.status !== "active") {
    return NextResponse.redirect(canonicalRedirect("/auth/sign-in"), 303)
  }

  const environment = readServerEnvironment()
  const correlationId = crypto.randomUUID()
  const context = await fetchSessionContext(environment.consoleApiBaseUrl, {
    accessToken: outcome.session.accessToken,
    correlationId,
  })
  if (!context.ok) {
    return redirectToSettings("DEPENDENCY_UNAVAILABLE")
  }

  const completion = await completeGithubInstallation(
    {
      baseUrl: environment.consoleApiBaseUrl,
      organizationId: context.value.organizationId,
      accessToken: outcome.session.accessToken,
      correlationId,
    },
    {
      state: returned.state,
      providerInstallationId: returned.providerInstallationId,
      idempotencyKey: crypto.randomUUID(),
    },
  )

  if (!completion.ok) {
    return redirectToSettings(
      completion.failure.kind === "error"
        ? completion.failure.error.error.code
        : "DEPENDENCY_UNAVAILABLE",
    )
  }

  const code = completion.value.responseCode
  if (
    code !== "GITHUB_INSTALLATION_CONNECTED" &&
    code !== "GITHUB_INSTALLATION_PENDING_PROVIDER"
  ) {
    return redirectToSettings(code)
  }

  // `applied` is the vocabulary the shared outcome notice already publishes.
  return redirectToSettings(
    code === "GITHUB_INSTALLATION_CONNECTED" ? "applied" : "pending",
  )
}
