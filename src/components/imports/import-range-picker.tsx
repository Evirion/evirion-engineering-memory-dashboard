"use client"

import { useMemo, useState } from "react"
import type { DateRange } from "react-day-picker"

import { Calendar } from "@/components/ui/calendar"

/**
 * Choosing which merged history to prepare.
 *
 * Two things this fixes. The date fields used to be drawn whatever the reader
 * had chosen, so a reader preparing the entire history was asked for a range
 * that would be ignored. And they were native `<input type="date">`, whose
 * placeholder and picker come from the browser's locale, so an English Console
 * asked for `дд.мм.гггг`. The calendar owns both its language and its bounds.
 *
 * The bound is real rather than decorative: a merge cannot have happened
 * tomorrow, so tomorrow is not selectable. Without it a reader could ask for a
 * window the repository can never fill and get an empty import that looks like
 * a fault.
 */

/** What the backend route accepts: a calendar day, no instant, no zone. */
const isoDay = (date: Date): string =>
  [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-")

const readable = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
})

/** GitHub's first year. Nothing was merged there before it existed. */
const GITHUB_EPOCH = new Date(2008, 0, 1)

const RANGES = [
  { value: "ENTIRE_HISTORY", label: "Entire repository history" },
  { value: "LAST_12_MONTHS", label: "Last 12 months" },
  { value: "CUSTOM", label: "Custom date range" },
] as const

type RangeValue = (typeof RANGES)[number]["value"]

export const ImportRangePicker = () => {
  const [range, setRange] = useState<RangeValue>("ENTIRE_HISTORY")
  const [selected, setSelected] = useState<DateRange | undefined>(undefined)

  // Local midnight, so "today" is the reader's day rather than the server's.
  // Computed once: a picker whose bound moved mid-session would silently
  // change what the reader may choose.
  const today = useMemo(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  }, [])

  const from = selected?.from
  const to = selected?.to
  const complete = from !== undefined && to !== undefined

  return (
    <div className="flex flex-col gap-3">
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-foreground">Range</legend>
        {RANGES.map((option) => (
          <label
            key={option.value}
            className="flex items-center gap-2 text-sm text-foreground"
          >
            <input
              type="radio"
              name="range"
              value={option.value}
              checked={range === option.value}
              onChange={() => setRange(option.value)}
            />
            {option.label}
          </label>
        ))}
      </fieldset>

      {range === "CUSTOM" ? (
        <div className="flex flex-col gap-2" data-testid="import-range-calendar">
          {/* Only the chosen days travel. The calendar is the control; these
              carry its answer in the shape the route parses. */}
          {complete ? (
            <>
              <input type="hidden" name="mergedFrom" value={isoDay(from)} />
              <input type="hidden" name="mergedTo" value={isoDay(to)} />
            </>
          ) : null}
          <Calendar
            mode="range"
            selected={selected}
            onSelect={setSelected}
            disabled={{ after: today }}
            defaultMonth={today}
            numberOfMonths={2}
            // A repository can carry a decade of history, and paging back to it
            // a month at a time is not a thing anyone will do. The floor is
            // GitHub's own first year: no pull request can have been merged
            // before the host existed, so an earlier year is not a real choice.
            captionLayout="dropdown"
            startMonth={GITHUB_EPOCH}
            endMonth={today}
            aria-label="Merged between"
            className="rounded-lg border border-input bg-card"
          />
          <p
            className="text-xs text-ink-secondary"
            data-testid="import-range-summary"
            aria-live="polite"
          >
            {complete
              ? `Merged between ${readable.format(from)} and ${readable.format(to)}, both days included.`
              : "Pick the first and the last day. Both are included, and days after today cannot be chosen."}
          </p>
        </div>
      ) : null}
    </div>
  )
}
