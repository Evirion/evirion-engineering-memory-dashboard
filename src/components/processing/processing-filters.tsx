import Link from "next/link"

import type { ProcessingActivityQuery } from "@/server/adapters/processing"

export const ProcessingFilters = ({
  query,
  repositoryChoices,
}: {
  query: ProcessingActivityQuery
  repositoryChoices: readonly { readonly id: string; readonly nameWithOwner: string }[]
}) => (
  <form method="get" className="flex flex-wrap items-end gap-3">
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-slate-700">Repository</span>
      <select
        name="repositoryId"
        defaultValue={query.repositoryId ?? ""}
        className="rounded border border-slate-300 px-2 py-1"
        aria-label="Filter by repository"
      >
        <option value="">All repositories</option>
        {repositoryChoices.map((choice) => (
          <option key={choice.id} value={choice.id}>
            {choice.nameWithOwner}
          </option>
        ))}
      </select>
    </label>
    <button
      type="submit"
      className="rounded border border-slate-900 bg-slate-900 px-3 py-1 text-sm text-white"
    >
      Apply filter
    </button>
    {query.repositoryId ? (
      <Link href="/processing" prefetch={false} className="text-sm underline">
        Clear filter
      </Link>
    ) : null}
  </form>
)
