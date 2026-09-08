import {
  type KnowledgeFilters,
  LIFECYCLE_STATES,
  REVIEW_STATUSES,
} from "@/lib/knowledge/filters"
import { lifecycleStateLabel, reviewDecisionLabel } from "@/lib/knowledge/presentation"
import type { RepositoryChoice } from "@/server/queries/knowledge"
import { buttonVariants } from "@/components/ui/button"
import { Field, Input, Label, Select } from "@/components/ui/field"
import { panelVariants } from "@/components/ui/panel"
import { SubmitButton } from "@/components/ui/submit-button"

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
    className={panelVariants({ className: "flex flex-col gap-5" })}
  >
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Field>
        <Label htmlFor="reviewStatus">Review status</Label>
        <Select
          id="reviewStatus"
          name="reviewStatus"
          defaultValue={filters.reviewStatus ?? ""}
        >
          {/* An empty value is submitted as an absent predicate, which the
              backend answers with its own PENDING default. */}
          <option value="">Awaiting review (default)</option>
          {REVIEW_STATUSES.map((status) => (
            <option key={status} value={status}>
              {reviewDecisionLabel(status)}
            </option>
          ))}
        </Select>
      </Field>

      <Field>
        <Label htmlFor="lifecycleState">Lifecycle</Label>
        <Select
          id="lifecycleState"
          name="lifecycleState"
          defaultValue={filters.lifecycleState ?? ""}
        >
          <option value="">Any lifecycle</option>
          {LIFECYCLE_STATES.map((state) => (
            <option key={state} value={state}>
              {lifecycleStateLabel(state)}
            </option>
          ))}
        </Select>
      </Field>

      {repositoryChoices.length > 0 ? (
        <Field>
          <Label htmlFor="repositoryId">Repository</Label>
          <Select
            id="repositoryId"
            name="repositoryId"
            defaultValue={filters.repositoryId ?? ""}
          >
            <option value="">Any repository</option>
            {repositoryChoices.map((choice) => (
              <option key={choice.id} value={choice.id}>
                {choice.nameWithOwner}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      <Field>
        <Label htmlFor="knowledgeType">Knowledge type</Label>
        <Input
          id="knowledgeType"
          name="knowledgeType"
          type="text"
          inputMode="text"
          pattern="[A-Za-z]{1,64}"
          defaultValue={filters.knowledgeType ?? ""}
        />
      </Field>

      <Field>
        <Label htmlFor="authorLogin">Pull request author</Label>
        <Input
          id="authorLogin"
          name="authorLogin"
          type="text"
          pattern="[A-Za-z0-9._-]{1,64}"
          defaultValue={filters.authorLogin ?? ""}
        />
      </Field>

      <Field>
        <Label htmlFor="mergedFrom">Merged from (UTC)</Label>
        <Input
          id="mergedFrom"
          name="mergedFrom"
          type="text"
          placeholder="2026-08-01T00:00:00Z"
          defaultValue={filters.mergedFrom ?? ""}
          className="font-mono"
        />
      </Field>

      <Field>
        <Label htmlFor="mergedTo">Merged to (UTC)</Label>
        <Input
          id="mergedTo"
          name="mergedTo"
          type="text"
          placeholder="2026-09-01T00:00:00Z"
          defaultValue={filters.mergedTo ?? ""}
          className="font-mono"
        />
      </Field>
    </div>

    <div className="border-border flex border-t pt-4">
      <SubmitButton className={buttonVariants({ variant: "primary" })}>
        Apply filters
      </SubmitButton>
    </div>
  </form>
)
