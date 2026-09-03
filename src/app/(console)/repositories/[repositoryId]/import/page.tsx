import Link from "next/link"

import type { Repository } from "@contracts/console"

import { ConsoleUnavailable } from "@/components/console/console-unavailable"
import {
  ApproveForm,
  ImportFailureList,
  PrepareForm,
  RunStateForms,
} from "@/components/imports/import-actions"
import { ImportPoll } from "@/components/imports/import-poll"
import { ImportCost, ImportProgress } from "@/components/imports/import-progress"
import {
  AuthorizationPanel,
  ImportStatusPanel,
} from "@/components/imports/import-status"
import { ImportOutcomeNotice } from "@/components/imports/import-outcome"
import { importControls, isProgressing } from "@/lib/imports/presentation"
import { readSessionCsrfToken } from "@/server/actions/session-csrf-read"
import { readRepositoryImport } from "@/server/queries/imports"
import { validRepositoryId } from "@/server/queries/repositories"

export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"

/** One key per rendered form, so a duplicate click replays instead of repeating. */
const mintIdempotencyKeys = (actions: readonly string[]): Record<string, string> =>
  Object.fromEntries(actions.map((action) => [action, crypto.randomUUID()]))

/**
 * Historical import for one repository.
 *
 * The two waits this page exists to tell apart are rendered by
 * `AuthorizationPanel`: waiting for the customer's approval is the only state
 * with a control, and waiting for Evirion operational authorization has none
 * and says so. There is no generic Retry here. `/processing` owns that, and
 * recovery on this page exists only where the import projection declares it.
 */
const RepositoryImportPage = async ({
  params,
  searchParams,
}: {
  params: Promise<{ repositoryId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) => {
  const { repositoryId } = await params
  const identifier = validRepositoryId(repositoryId)
  const requested = (await searchParams)["result"]
  const outcome = typeof requested === "string" ? requested : undefined

  // A malformed identifier gets the same answer as a foreign one. Anything
  // else would tell the caller which identifiers are well formed.
  const view =
    identifier === undefined
      ? ({
          status: "unavailable",
          failure: {
            code: "RESOURCE_NOT_FOUND",
            treatment: "not-permitted",
            message: "This is not available for your account.",
            retryable: false,
          },
        } as const)
      : await readRepositoryImport(identifier)

  if (view.status === "unavailable") {
    return (
      <section className="flex flex-col gap-6">
        <h1 className="text-xl font-semibold tracking-tight">Historical import</h1>
        <ConsoleUnavailable
          failure={view.failure}
          heading="This import is not available"
        />
        <BackToRepository repositoryId={identifier} />
      </section>
    )
  }

  const { repository, current, failures } = view
  const context = {
    repository,
    current,
    controls: importControls(repository, current, view.capabilities),
    csrfToken: await readSessionCsrfToken(),
    idempotencyKeys: mintIdempotencyKeys([
      "prepare",
      "approve",
      "pause",
      "resume",
      "cancel",
      ...(failures.status === "ready"
        ? failures.failures.failures.map((failure) => `retry:${failure.itemId}`)
        : []),
    ]),
  }

  return (
    <section data-testid="import-surface" className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">Historical import</h1>
        <p className="text-sm text-slate-600">{repository.nameWithOwner}</p>
      </div>

      <ImportOutcomeNotice result={outcome} />

      {current === null ? (
        <EmptyImport repository={repository} />
      ) : (
        <>
          {isProgressing(current.status) ? <ImportPoll /> : null}
          <ImportStatusPanel current={current} />
          <AuthorizationPanel current={current} />
          <ImportProgress current={current} />
          <ImportCost current={current} />
        </>
      )}

      <div className="flex flex-col gap-3">
        <PrepareForm {...context} />
        <ApproveForm {...context} />
        <RunStateForms {...context} />
        <ImportFailureList {...context} failures={failures} />
      </div>

      <BackToRepository repositoryId={repository.id} />
    </section>
  )
}

/**
 * No import yet.
 *
 * This is the empty state rather than a refusal. The tenant boundary was
 * already decided by the repository read that succeeded before it, so an
 * absent current import here means exactly that.
 */
const EmptyImport = ({ repository }: { repository: Repository }) => (
  <section
    aria-labelledby="import-empty-heading"
    data-testid="import-empty"
    className="flex flex-col gap-2 rounded border border-slate-300 bg-white px-4 py-3"
  >
    <h2 id="import-empty-heading" className="text-sm font-semibold text-slate-900">
      No import has been prepared
    </h2>
    <p className="text-sm text-slate-700">
      {repository.entitlement?.state === "ACTIVE"
        ? "Nothing has been imported from this repository's history yet."
        : "Historical import needs an active entitlement for this repository."}
    </p>
  </section>
)

const BackToRepository = ({ repositoryId }: { repositoryId: string | undefined }) => (
  <Link
    href={
      repositoryId === undefined ? "/repositories" : `/repositories/${repositoryId}`
    }
    className="self-start text-sm text-slate-700 underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
  >
    {repositoryId === undefined ? "Back to repositories" : "Back to this repository"}
  </Link>
)

export default RepositoryImportPage
