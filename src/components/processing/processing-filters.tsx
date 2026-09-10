import Link from "next/link"

import { processingPath, type ProcessingViewQuery } from "@/lib/processing/query"
import { buttonVariants } from "@/components/ui/button"
import { Field, Label, Select } from "@/components/ui/field"
import { panelVariants } from "@/components/ui/panel"
import { SubmitButton } from "@/components/ui/submit-button"

/**
 * A GET form, so a filtered view is a URL a customer can bookmark and paste
 * into a support message. Changing the repository restarts the scan: the
 * cursor is omitted so it cannot skip rows that belonged to the previous
 * filter. Sort is preserved because it is an independent presentation axis.
 */
export const ProcessingFilters = ({
  query,
  repositoryChoices,
}: {
  query: ProcessingViewQuery
  repositoryChoices: readonly { readonly id: string; readonly nameWithOwner: string }[]
}) => (
  <form
    method="get"
    className={panelVariants({
      padding: "compact",
      className: "flex flex-wrap items-end gap-3",
    })}
  >
    {query.sort === undefined ? null : (
      <>
        <input type="hidden" name="sort" value={query.sort} />
        <input type="hidden" name="dir" value={query.dir ?? "asc"} />
      </>
    )}
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
        href={processingPath(
          query.sort === undefined ? {} : { sort: query.sort, dir: query.dir ?? "asc" },
        )}
        prefetch={false}
        className={buttonVariants({ variant: "ghost" })}
      >
        Clear filter
      </Link>
    ) : null}
  </form>
)
