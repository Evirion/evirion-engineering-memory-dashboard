"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Calendar as CalendarGlyph } from "lucide-react"

import { formatInstant } from "@/lib/format/display"
import { Calendar } from "@/components/ui/calendar"
import { Input, Label } from "@/components/ui/field"

/**
 * Choosing the last day automatic extraction consent is valid.
 *
 * A native `<input type="datetime-local">` draws a calendar glyph on the
 * field and opens its picker from that field. It also draws the placeholder
 * and the picker in the browser locale, so a Russian system showed
 * `ДД.ММ.ГГГГ` inside an English Console. This keeps the one-field control
 * and the glyph, and uses the shared English calendar on click.
 *
 * Only the hidden field travels. The route still wants an instant, so a
 * chosen day posts as the end of that local day.
 */

const pad = (value: number): string => String(value).padStart(2, "0")

const isoDay = (day: Date): string =>
  `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`

const toPostedExpiry = (day: Date): string => `${isoDay(day)}T23:59`

const dayFromInstant = (value: string | undefined): Date | undefined => {
  if (value === undefined || value === "") return undefined
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return undefined
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate())
}

export const ExpiresPicker = ({
  defaultValue,
}: {
  readonly defaultValue?: string | undefined
}) => {
  const initial = dayFromInstant(defaultValue)
  const [selected, setSelected] = useState<Date | undefined>(initial)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const today = useMemo(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  }, [])

  const firstSelectable = useMemo(() => {
    const now = new Date()
    const endOfToday = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      23,
      59,
    )
    if (now.getTime() >= endOfToday.getTime()) {
      return new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
    }
    return today
  }, [today])

  const horizon = useMemo(
    () => new Date(today.getFullYear() + 10, today.getMonth(), today.getDate()),
    [today],
  )

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node) !== true) {
        setOpen(false)
      }
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const posted = selected !== undefined ? toPostedExpiry(selected) : ""

  return (
    <div
      ref={rootRef}
      className="relative flex flex-col gap-2"
      data-testid="consent-expires-picker"
    >
      <Label htmlFor="expires-display">Expires</Label>
      <div className="relative">
        <Input
          id="expires-display"
          type="text"
          readOnly
          required
          value={selected !== undefined ? formatInstant(isoDay(selected)) : ""}
          placeholder="Pick a date"
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-controls="consent-expires-calendar"
          onClick={() => setOpen((current) => !current)}
          className="cursor-pointer pr-9"
        />
        <CalendarGlyph
          aria-hidden
          data-testid="consent-expires-icon"
          className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2"
          strokeWidth={1.5}
        />
      </div>
      <input type="hidden" name="expiresAt" value={posted} />
      {open ? (
        <div id="consent-expires-calendar" className="absolute top-full z-50 mt-1">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={(day) => {
              if (day === undefined) return
              setSelected(day)
              setOpen(false)
            }}
            disabled={{ before: firstSelectable }}
            defaultMonth={selected ?? firstSelectable}
            captionLayout="dropdown"
            startMonth={firstSelectable}
            endMonth={horizon}
            aria-label="Expiry date"
            className="rounded-lg border border-input bg-card shadow-panel"
          />
        </div>
      ) : null}
    </div>
  )
}
