import { ConsoleUnavailable } from "@/components/console/console-unavailable"
import { RepositoryAxisList } from "@/components/repositories/repository-axes"
import {
  BackToRepositories,
  ChangeRequestNotice,
  ConsentFacts,
  EntitlementFacts,
  PolicyVocabulary,
} from "@/components/repositories/repository-detail"
import { productStateLabel } from "@/lib/repositories/presentation"
import { readRepositoryDetail, validRepositoryId } from "@/server/queries/repositories"

export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"

/**
 * One repository: access versus entitlement versus policy.
 *
 * Repository counters are deliberately absent. Open decision 6 asks whether
 * they belong here, and it cannot be answered yet: the contract publishes no
 * schema for them, so neither this subtask nor EEM-9/06 can validate such a
 * response. That gap is recorded in the EEM-9/03 acceptance trace.
 */
const RepositoryDetailPage = async ({
  params,
}: {
  params: Promise<{ repositoryId: string }>
}) => {
  const { repositoryId } = await params
  const identifier = validRepositoryId(repositoryId)

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

  const { repository } = view

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

      <RepositoryAxisList repository={repository} />
      <ChangeRequestNotice repository={repository} />
      <EntitlementFacts repository={repository} />
      <ConsentFacts repository={repository} />
      <PolicyVocabulary />

      <BackToRepositories />
    </section>
  )
}

export default RepositoryDetailPage
