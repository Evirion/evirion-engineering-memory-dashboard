"use client"

import { DayPicker, type DayPickerProps } from "react-day-picker"
import { cn } from "cn"

import { buttonVariants } from "@/components/ui/button"

/**
 * The Console's date picker.
 *
 * A native `<input type="date">` renders its placeholder and its picker in the
 * browser's own locale, so a reader on a Russian system saw `дд.мм.гггг` inside
 * an English Console and no markup could change it. This carries its own
 * English locale and does not consult the visitor's, which is what makes the
 * whole surface one language.
 */
export const Calendar = ({ className, classNames, ...props }: DayPickerProps) => (
  <DayPicker
    // The nav is absolutely placed over the captions, so the root has to be
    // the thing it is placed against. Without this the arrows anchor to
    // whatever ancestor happens to be positioned and leave the calendar.
    className={cn("relative w-fit p-3", className)}
    classNames={{
      months: "flex flex-col gap-4 sm:flex-row",
      month: "flex flex-col gap-4",
      month_caption: "flex h-8 items-center justify-center px-8",
      caption_label:
        "inline-flex items-center gap-1 text-sm font-medium text-foreground [&_svg]:size-4",
      // Each dropdown is a real `<select>` laid transparently over the label it
      // controls, which is how the keyboard and a screen reader get a plain
      // native control while the page keeps its own look.
      dropdowns: "flex items-center gap-2",
      dropdown_root:
        "relative inline-flex h-8 items-center rounded-lg border border-input bg-card px-2 hover:border-line-strong focus-within:border-ring",
      dropdown: "absolute inset-0 cursor-pointer opacity-0",
      nav: "flex items-center justify-between absolute inset-x-3 top-3",
      button_previous: cn(
        buttonVariants({ variant: "ghost", size: "sm" }),
        "size-8 p-0",
      ),
      button_next: cn(buttonVariants({ variant: "ghost", size: "sm" }), "size-8 p-0"),
      month_grid: "w-full border-collapse",
      weekdays: "flex",
      weekday: "w-9 text-xs font-normal text-ink-secondary",
      week: "mt-1 flex w-full",
      day: "relative size-9 p-0 text-center text-sm",
      day_button: cn(
        "size-9 rounded-lg font-normal text-foreground",
        "hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        // A day the customer cannot choose says so by being unreachable, not
        // only by being pale: pointer events are off and the button is
        // disabled, so the keyboard reaches the same conclusion as the mouse.
        "disabled:pointer-events-none disabled:text-ink-disabled",
      ),
      today: "font-semibold underline underline-offset-4",
      // The fill sits on the cell and the rounding only on the two ends, so a
      // range reads as one band rather than a row of separate pills.
      selected: "bg-primary text-primary-foreground",
      range_start: "rounded-l-lg",
      range_end: "rounded-r-lg",
      outside: "text-ink-disabled",
      disabled: "text-ink-disabled",
      hidden: "invisible",
      ...classNames,
    }}
    {...props}
  />
)
