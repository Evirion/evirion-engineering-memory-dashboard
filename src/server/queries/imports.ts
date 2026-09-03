import "server-only"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import type {
  Repository,
  RepositoryImport,
  RepositoryImportFailures,
} from "@contracts/console"

import { readSession } from "@/lib/auth/session-broker"
import { readServerEnvironment } from "@/lib/env/server"
import { type ViewFailure, UNKNOWN_ERROR } from "@/lib/errors/console-errors"
import {
  fetchRepositoryImport,
  fetchRepositoryImportFailures,
} from "@/server/adapters/imports"
import type { RepositoryScope } from "@/server/adapters/repositories"
import { fetchRepository } from "@/server/adapters/repositories"
import { describeFailure } from "@/server/queries/repositories"
import { requireSessionContext } from "@/server/queries/session-context"

/**
 * Historical-import reads for a server-rendered page.
 *
 * The caller token is resolved and spent inside this module and never reaches
 * a page or a component, so no render path can put it in the document. Pages
 * receive a view model and nothing else.
 */

/** The absent import is a state of its own, never a refusal and never zero. */
export type ImportFailuresView =
  | { readonly status: "ready"; readonly failures: RepositoryImportFailures }
  | { readonly status: "unavailable"; readonly failure: ViewFailure }
  | { readonly status: "not-applicable" }

export type ImportView =
  | {
      readonly status: "ready"
      readonly repository: Repository
      /** `null` is a repository with no import yet, which is the empty state. */
      readonly current: RepositoryImport | null
      readonly failures: ImportFailuresView
      readonly capabilities: readonly string[]
    }
  | { readonly status: "unavailable"; readonly failure: ViewFailure }

/**
 * The codes the backend uses for an import that is not there.
 *
 * The contract cannot distinguish "this repository has no import yet" from
 * "that import is not yours", because refusing a foreign resource without
 * disclosing whether it exists is the point. This module only reads them as
 * empty after the repository read has already succeeded, which is what decides
 * the tenant boundary; a foreign repository never reaches the import call.
 */
const ABSENT = new Set(["REPOSITORY_IMPORT_NOT_FOUND", "RESOURCE_NOT_FOUND"])

const correlationId = (): string => {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  return Buffer.from(bytes).toString("hex")
}

type ResolvedScope =
  | {
      readonly status: "ready"
      readonly scope: RepositoryScope
      readonly capabilities: readonly string[]
    }
  | { readonly status: "unavailable"; readonly failure: ViewFailure }

const resolveScope = async (): Promise<ResolvedScope> => {
  const context = await requireSessionContext()
  if (context.status === "unavailable") {
    return {
      status: "unavailable",
      failure: {
        code: UNKNOWN_ERROR.code,
        treatment: "retry-bounded",
        message: context.message,
        retryable: true,
      },
    }
  }

  const jar = await cookies()
  const outcome = readSession(
    Object.fromEntries(jar.getAll().map((cookie) => [cookie.name, cookie.value])),
  )
  if (outcome.status !== "active") redirect("/auth/sign-in")

  return {
    status: "ready",
    capabilities: context.context.capabilities,
    scope: {
      baseUrl: readServerEnvironment().consoleApiBaseUrl,
      organizationId: context.context.organizationId,
      accessToken: outcome.session.accessToken,
      correlationId: correlationId(),
    },
  }
}

const readFailures = async (
  scope: RepositoryScope,
  current: RepositoryImport,
): Promise<ImportFailuresView> => {
  // The projection's own count decides whether there is anything to list, so a
  // run with no failed work makes no second call.
  if (current.counts.failed === 0) return { status: "not-applicable" }

  const failures = await fetchRepositoryImportFailures(scope, current.importId)
  // A failed read is reported as unavailable rather than as an empty list. An
  // empty list would claim there is nothing to recover, which is a different
  // statement from not knowing.
  return failures.ok
    ? { status: "ready", failures: failures.value }
    : { status: "unavailable", failure: describeFailure(failures.failure) }
}

export const readRepositoryImport = async (
  repositoryId: string,
): Promise<ImportView> => {
  const resolved = await resolveScope()
  if (resolved.status === "unavailable") return resolved

  // The repository read comes first and decides the tenant boundary. It also
  // supplies the entitlement state, which is what BF-001 gates preparing on.
  const repository = await fetchRepository(resolved.scope, repositoryId)
  if (!repository.ok) {
    return { status: "unavailable", failure: describeFailure(repository.failure) }
  }

  const current = await fetchRepositoryImport(resolved.scope, repositoryId)
  if (!current.ok) {
    const failure = current.failure
    if (failure.kind === "error" && ABSENT.has(failure.error.error.code)) {
      return {
        status: "ready",
        repository: repository.value,
        current: null,
        failures: { status: "not-applicable" },
        capabilities: resolved.capabilities,
      }
    }
    return { status: "unavailable", failure: describeFailure(failure) }
  }

  return {
    status: "ready",
    repository: repository.value,
    current: current.value,
    failures: await readFailures(resolved.scope, current.value),
    capabilities: resolved.capabilities,
  }
}
