"use client"

import { useMemo, useState } from "react"

import { formatInstant } from "@/lib/format/display"
import { Calendar } from "@/components/ui/calendar"
import { Label, Select } from "@/components/ui/field"

/**
 * Choosing when automatic extraction consent expires.
 *
 * A native `<input type="datetime-local">` renders its placeholder, its
 * picker and even "Today" / "Clear" in the browser's locale, so a Russian
 * system showed `ДД.ММ.ГГГГ` and `сентябрь` inside an English Console. The
 * calendar already owns English for the import range; this is the same
 * control with a time, because a consent expires at an instant.
 *
 * Only the hidden field travels. The calendar and the two selects are the
 * control the reader uses.
 */

const pad = (value: number): string => String(value).padStart(2, "0")

const HOURS = Array.from({ length: 24 }, (_, hour) => hour)
const MINUTES = Array.from({ length: 60 }, (_, minute) => minute)

const toDatetimeLocal = (day: Date, hour: number, minute: number): string =>
  `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}T${pad(hour)}:${pad(minute)}`

const fromInstant = (
  value: string | undefined,
):
  | { readonly day: Date; readonly hour: number; readonly minute: number }
  | undefined => {
  if (value === undefined || value === "") return undefined
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return undefined
  return {
    day: new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()),
    hour: parsed.getHours(),
    minute: parsed.getMinutes(),
  }
}

export const ExpiresPicker = ({
  defaultValue,
}: {
  readonly defaultValue?: string | undefined
}) => {
  const initial = fromInstant(defaultValue)
  const [selected, setSelected] = useState<Date | undefined>(initial?.day)
  const [hour, setHour] = useState(initial?.hour ?? 23)
  const [minute, setMinute] = useState(initial?.minute ?? 59)

  const today = useMemo(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  }, [])

  const horizon = useMemo(
    () => new Date(today.getFullYear() + 10, today.getMonth(), today.getDate()),
    [today],
  )

  const complete = selected !== undefined
  const posted = complete ? toDatetimeLocal(selected, hour, minute) : ""

  return (
    <div className="flex flex-col gap-2" data-testid="consent-expires-picker">
      <Label htmlFor="expires-display">Expires</Label>
      <input
        id="expires-display"
        type="text"
        readOnly
        required
        value={complete ? formatInstant(posted) : ""}
        placeholder="Pick a date and time"
        className="border-input bg-card text-foreground placeholder:text-muted-foreground h-10 w-full rounded-lg border px-3 text-sm outline-none"
      />
      <input type="hidden" name="expiresAt" value={posted} />
      <Calendar
        mode="single"
        selected={selected}
        onSelect={setSelected}
        disabled={{ before: today }}
        defaultMonth={selected ?? today}
        captionLayout="dropdown"
        startMonth={today}
        endMonth={horizon}
        aria-label="Expiry date"
        className="rounded-lg border border-input bg-card"
      />
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="expires-hour">Hour</Label>
          <Select
            id="expires-hour"
            value={String(hour)}
            onChange={(event) => setHour(Number(event.target.value))}
            aria-label="Expiry hour"
          >
            {HOURS.map((value) => (
              <option key={value} value={value}>
                {pad(value)}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="expires-minute">Minute</Label>
          <Select
            id="expires-minute"
            value={String(minute)}
            onChange={(event) => setMinute(Number(event.target.value))}
            aria-label="Expiry minute"
          >
            {MINUTES.map((value) => (
              <option key={value} value={value}>
                {pad(value)}
              </option>
            ))}
          </Select>
        </div>
      </div>
    </div>
  )
}
