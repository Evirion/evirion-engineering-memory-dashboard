import { NextResponse, type NextRequest } from "next/server"

import { backToRepositories, beginGithubCommand } from "@/server/actions/github-command"
import { githubInstallRedirect } from "@/server/actions/redirects"
import { startGithubInstallation } from "@/server/adapters/repositories"

export const dynamic = "force-dynamic"

/**
 * Hand the customer to GitHub to install the Evirion App.
 *
 * The Console creates no installation identity. It asks the backend for a
 * one-time setup intent, and the backend keeps only the hash of the state it
 * issued; the callback that resolves the installation is the backend control
 * plane's, not this one. No App private key, client secret or installation
 * token exists in this process to leak.
 *
 * The state travels in the URL because that is how the handoff works, and it
 * is a single-use nonce rather than a credential. It is never logged here.
 */
export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const command = await beginGithubCommand(request)
  if (command.status === "rejected") return command.response

  const intent = await startGithubInstallation(command.scope, command.idempotencyKey)
  if (!intent.ok) {
    return backToRepositories(
      intent.failure.kind === "error"
        ? intent.failure.error.error.code
        : "DEPENDENCY_UNAVAILABLE",
    )
  }

  const state = intent.value.state
  if (intent.value.status !== "CREATED" || !state) {
    // A consumed, expired or failed intent is not a handoff. Sending the
    // customer to GitHub anyway would produce a callback the backend refuses.
    return backToRepositories("GITHUB_SYNC_INCOMPLETE")
  }

  const response = NextResponse.redirect(githubInstallRedirect(state), 303)
  response.headers.set("cache-control", "private, no-store, max-age=0, must-revalidate")
  return response
}
