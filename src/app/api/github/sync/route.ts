import type { NextRequest, NextResponse } from "next/server"

import { backToRepositories, beginGithubCommand } from "@/server/actions/github-command"
import { startGithubRepositorySync } from "@/server/adapters/repositories"

export const dynamic = "force-dynamic"

/**
 * Queue one repository synchronization generation.
 *
 * The response is a durable receipt, not the traversal. The customer returns
 * to the inventory, which reports the run's own status; access is only ever
 * changed by a complete traversal, so a run that is still going or that failed
 * leaves the previous inventory standing.
 */
export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const command = await beginGithubCommand(request)
  if (command.status === "rejected") return command.response

  const run = await startGithubRepositorySync(command.scope, command.idempotencyKey)
  if (!run.ok) {
    return backToRepositories(
      run.failure.kind === "error"
        ? run.failure.error.error.code
        : "DEPENDENCY_UNAVAILABLE",
    )
  }

  return backToRepositories("applied")
}
