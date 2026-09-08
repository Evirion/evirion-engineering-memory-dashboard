import Link from "next/link"

import type { ProcessingActivityQuery } from "@/server/adapters/processing"
import { buttonVariants } from "@/components/ui/button"
import { Field, Label, Select } from "@/components/ui/field"
import { panelVariants } from "@/components/ui/panel"
import { SubmitButton } from "@/components/ui/submit-button"

/**
 * A GET form, so a filtered view is a URL a customer can bookmark and paste
 * into a support message.
 */
export const ProcessingFilters = ({
  query,
  repositoryChoices,
}: {
  query: ProcessingActivityQuery
  repositoryChoices: readonly { readonly id: string; readonly nameWithOwner: string }[]
}) => (
  <form
    method="get"
    className={panelVariants({
      padding: "compact",
      className: "flex flex-wrap items-end gap-3",
    })}
  >
    <Field className="min-w-56 flex-1">
      <Label htmlFor="repositoryId">Repository</Label>
      <Select
        id="repositoryId"
        name="repositoryId"
        defaultValue={query.repositoryId ?? ""}
        aria-label="Filter by repository"
      >
        <option value="">All repositories</option>
        {repositoryChoices.map((choice) => (
          <option key={choice.id} value={choice.id}>
            {choice.nameWithOwner}
          </option>
        ))}
      </Select>
    </Field>
    <SubmitButton className={buttonVariants({ variant: "primary" })}>
      Apply filter
    </SubmitButton>
    {query.repositoryId ? (
      <Link
        href="/processing"
        prefetch={false}
        className={buttonVariants({ variant: "ghost" })}
      >
        Clear filter
      </Link>
    ) : null}
  </form>
)
