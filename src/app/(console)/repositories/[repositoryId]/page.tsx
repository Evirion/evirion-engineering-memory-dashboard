import { ConsoleUnavailable } from "@/components/console/console-unavailable"
import {
  CommandOutcomeNotice,
  readCommandResult,
} from "@/components/repositories/command-outcome"
import {
  ActivateForm,
  ConsentForm,
  DisableForm,
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
import { productStateLabel, repositoryControls } from "@/lib/repositories/presentation"
import { readSessionCsrfToken } from "@/server/actions/session-csrf-read"
import { readRepositoryDetail, validRepositoryId } from "@/server/queries/repositories"

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
  const requested = (await searchParams)["result"]
  const outcome = readCommandResult(
    typeof requested === "string" ? requested : undefined,
  )

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
        <h1 className="text-xl font-semibold tracking-tight">Repository</h1>
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
    csrfToken: await readSessionCsrfToken(),
    idempotencyKeys: mintIdempotencyKeys(),
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">
          {repository.nameWithOwner}
        </h1>
        <p className="text-sm text-slate-600">
          {productStateLabel(repository.productState)}
        </p>
      </div>

      {outcome ? <CommandOutcomeNotice result={outcome} /> : null}

      <RepositoryAxisList repository={repository} />
      <ChangeRequestNotice repository={repository} />
      <EntitlementFacts repository={repository} />
      <ConsentFacts repository={repository} />
      <RepositoryCounters view={view.overview} />

      <div className="flex flex-col gap-3">
        <ActivateForm {...context} />
        <PolicyForm {...context} />
        <ConsentForm {...context} />
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
