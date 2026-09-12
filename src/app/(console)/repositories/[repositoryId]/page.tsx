import { ConsoleUnavailable } from "@/components/console/console-unavailable"
import {
  INVALID_CHALLENGE,
  ReauthenticationOutcome,
} from "@/components/auth/reauthentication-outcome"
import {
  CommandOutcomeNotice,
  readCommandResult,
} from "@/components/repositories/command-outcome"
import {
  ActivateForm,
  ConsentForm,
  DisableForm,
  ImportEntry,
  OperatorManagedNotice,
  PolicyForm,
  RequestChangeForm,
} from "@/components/repositories/repository-actions"
import { RepositoryAxisList } from "@/components/repositories/repository-axes"
import { RepositoryCounters } from "@/components/repositories/repository-counters"
import {
  BackToRepositories,
  ChangeRequestNotice,
  ConsentFacts,
  EntitlementFacts,
  PolicyVocabulary,
} from "@/components/repositories/repository-detail"
import { reauthenticationFreshUntil } from "@/lib/auth/reauthentication-freshness"
import { productStateLabel, repositoryControls } from "@/lib/repositories/presentation"
import { readSessionCsrfToken } from "@/server/actions/session-csrf-read"
import { pendingReauthenticationContext } from "@/server/actions/reauthentication-resume"
import { readRepositoryDetail, validRepositoryId } from "@/server/queries/repositories"
import { requireSessionContext } from "@/server/queries/session-context"

export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"

/** One key per rendered form, so a duplicate click replays instead of repeating. */
const mintIdempotencyKeys = (): Record<string, string> =>
  Object.fromEntries(
    ["activate", "disable", "request-change", "policy", "consent"].map((action) => [
      action,
      crypto.randomUUID(),
    ]),
  )

/**
 * One repository: access versus entitlement versus policy.
 *
 * The repository counters are EEM-9/06 content on an EEM-9/03 page, which is
 * open decision 6 answered: `repository-overview.json` arrived in
 * `console-contract-v1.0.1` and requirements Section 10 gives the overview no
 * route of its own, so this is the only route that could carry it. They resolve
 * separately from the repository, so they can be unavailable without taking the
 * entitlement and policy controls with them.
 */
const RepositoryDetailPage = async ({
  params,
  searchParams,
}: {
  params: Promise<{ repositoryId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) => {
  const { repositoryId } = await params
  const identifier = validRepositoryId(repositoryId)
  const parameters = await searchParams
  const requested = parameters["result"]
  const outcomeRaw = typeof requested === "string" ? requested : undefined
  const outcome = readCommandResult(outcomeRaw)
  const reauthRequired = parameters["reauth"] === "required"
  const session = await requireSessionContext()
  const freshUntil =
    session.status === "ready" ? reauthenticationFreshUntil(session.context) : undefined
  const csrfToken = await readSessionCsrfToken()
  const pending = await pendingReauthenticationContext()
  const repositoryReturnPath =
    identifier === undefined ? "/repositories" : `/repositories/${identifier}`

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
      : await readRepositoryDetail(identifier)

  if (view.status === "unavailable") {
    return (
      <section className="flex flex-col gap-6">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          Repository
        </h1>
        <ConsoleUnavailable
          failure={view.failure}
          heading="This repository is not available"
        />
        <BackToRepositories />
      </section>
    )
  }

  const { repository, candidates, candidatesTruncated } = view
  const controls = repositoryControls(repository, view.summary.limit, view.capabilities)
  const context = {
    repository,
    controls,
    csrfToken,
    idempotencyKeys: mintIdempotencyKeys(),
    reauthenticationFreshUntil: freshUntil,
    repositoryReturnPath,
  }

  const ceremony =
    reauthRequired ||
    outcomeRaw === "REAUTHENTICATION_REQUIRED" ||
    outcomeRaw === INVALID_CHALLENGE ||
    outcomeRaw === "PENDING_EXPIRED" ||
    outcomeRaw === "PENDING_SESSION_MISMATCH"

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          {repository.nameWithOwner}
        </h1>
        <p className="text-sm text-ink-secondary">
          {productStateLabel(repository.productState)}
        </p>
      </div>

      <ReauthenticationOutcome
        result={outcomeRaw}
        reauthRequired={reauthRequired}
        csrfToken={csrfToken}
        hasPending={pending.hasPending}
        gate={pending.hasPending ? pending.gate : "repository_policy"}
        returnPath={pending.hasPending ? pending.returnPath : repositoryReturnPath}
      />
      {ceremony || !outcome ? null : <CommandOutcomeNotice result={outcome} />}

      <RepositoryAxisList repository={repository} />
      <ChangeRequestNotice repository={repository} />
      <EntitlementFacts repository={repository} />
      <ConsentFacts repository={repository} modelProfiles={view.modelProfiles} />
      <RepositoryCounters view={view.overview} />

      <div className="flex flex-col gap-3">
        <ActivateForm {...context} />
        {/* Live processing decides what happens next; import decides what
            happens about everything before now. They are the pair a reader is
            choosing between, so they sit together and ahead of the controls
            that take something away. */}
        <PolicyForm {...context} />
        <ImportEntry {...context} />
        <ConsentForm {...context} modelProfiles={view.modelProfiles} />
        <DisableForm {...context} />
        <RequestChangeForm
          {...context}
          candidates={candidates}
          candidatesTruncated={candidatesTruncated}
        />
        <OperatorManagedNotice controls={controls} />
      </div>

      <PolicyVocabulary />
      <BackToRepositories />
    </section>
  )
}

export default RepositoryDetailPage
