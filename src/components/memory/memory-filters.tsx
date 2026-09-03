import {
  type KnowledgeFilters,
  LIFECYCLE_STATES,
  REVIEW_STATUSES,
} from "@/lib/knowledge/filters"
import { lifecycleStateLabel, reviewDecisionLabel } from "@/lib/knowledge/presentation"
import type { RepositoryChoice } from "@/server/queries/knowledge"

/**
 * The review-queue predicates.
 *
 * This is a read, so it is a `GET` form with no action: the browser submits to
 * the page's own URL and the filter state ends up in the query string, which
 * is what `MEM-002` means by shareable. Nothing here is a mutation, so no CSRF
 * proof and no BFF route are involved.
 *
 * Submitting deliberately drops the cursor. Changing a predicate restarts the
 * scan rather than resuming a page computed for a different predicate, which
 * would silently skip rows.
 *
 * The placement of these controls is open decision 4.
 */

const field = "flex flex-col gap-1"
const label = "text-xs font-medium tracking-wide text-slate-500 uppercase"
const control =
  "rounded border border-slate-300 px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"

export const MemoryFilters = ({
  filters,
  repositoryChoices,
}: {
  filters: KnowledgeFilters
  repositoryChoices: readonly RepositoryChoice[]
}) => (
  <form
    method="get"
    aria-label="Filter Knowledge Objects"
    className="flex flex-col gap-4 rounded border border-slate-300 bg-white px-4 py-3"
  >
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className={field}>
        <label htmlFor="reviewStatus" className={label}>
          Review status
        </label>
        <select
          id="reviewStatus"
          name="reviewStatus"
          defaultValue={filters.reviewStatus ?? ""}
          className={control}
        >
          {/* An empty value is submitted as an absent predicate, which the
              backend answers with its own PENDING default. */}
          <option value="">Awaiting review (default)</option>
          {REVIEW_STATUSES.map((status) => (
            <option key={status} value={status}>
              {reviewDecisionLabel(status)}
            </option>
          ))}
        </select>
      </div>

      <div className={field}>
        <label htmlFor="lifecycleState" className={label}>
          Lifecycle
        </label>
        <select
          id="lifecycleState"
          name="lifecycleState"
          defaultValue={filters.lifecycleState ?? ""}
          className={control}
        >
          <option value="">Any lifecycle</option>
          {LIFECYCLE_STATES.map((state) => (
            <option key={state} value={state}>
              {lifecycleStateLabel(state)}
            </option>
          ))}
        </select>
      </div>

      {repositoryChoices.length > 0 ? (
        <div className={field}>
          <label htmlFor="repositoryId" className={label}>
            Repository
          </label>
          <select
            id="repositoryId"
            name="repositoryId"
            defaultValue={filters.repositoryId ?? ""}
            className={control}
          >
            <option value="">Any repository</option>
            {repositoryChoices.map((choice) => (
              <option key={choice.id} value={choice.id}>
                {choice.nameWithOwner}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className={field}>
        <label htmlFor="knowledgeType" className={label}>
          Knowledge type
        </label>
        <input
          id="knowledgeType"
          name="knowledgeType"
          type="text"
          inputMode="text"
          pattern="[A-Za-z]{1,64}"
          defaultValue={filters.knowledgeType ?? ""}
          className={control}
        />
      </div>

      <div className={field}>
        <label htmlFor="authorLogin" className={label}>
          Pull request author
        </label>
        <input
          id="authorLogin"
          name="authorLogin"
          type="text"
          pattern="[A-Za-z0-9._-]{1,64}"
          defaultValue={filters.authorLogin ?? ""}
          className={control}
        />
      </div>

      <div className={field}>
        <label htmlFor="mergedFrom" className={label}>
          Merged from (UTC)
        </label>
        <input
          id="mergedFrom"
          name="mergedFrom"
          type="text"
          placeholder="2026-08-01T00:00:00Z"
          defaultValue={filters.mergedFrom ?? ""}
          className={control}
        />
      </div>

      <div className={field}>
        <label htmlFor="mergedTo" className={label}>
          Merged to (UTC)
        </label>
        <input
          id="mergedTo"
          name="mergedTo"
          type="text"
          placeholder="2026-09-01T00:00:00Z"
          defaultValue={filters.mergedTo ?? ""}
          className={control}
        />
      </div>
    </div>

    <div>
      <button
        type="submit"
        className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        Apply filters
      </button>
    </div>
  </form>
)
