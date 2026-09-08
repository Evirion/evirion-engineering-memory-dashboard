"use client"

import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"

import { buttonVariants } from "@/components/ui/button"
import { panelVariants } from "@/components/ui/panel"

/**
 * A bounded poll while an import is still running.
 *
 * The parent renders it only for a non-terminal run, so reaching a terminal
 * state unmounts it rather than being checked for here. Three bounds hold:
 * the interval doubles up to a ceiling, the number of refreshes is capped, and
 * an inactive tab stops polling entirely until it is looked at again.
 *
 * It refreshes the server-rendered route and reads nothing itself. Every fact
 * on the page still comes from the server component, so the caller token stays
 * where it was and no projection is assembled in the browser.
 */
export const ImportPoll = ({
  firstDelayMs = 5_000,
  ceilingMs = 60_000,
  maximumRefreshes = 20,
}: {
  readonly firstDelayMs?: number
  readonly ceilingMs?: number
  readonly maximumRefreshes?: number
}) => {
  const router = useRouter()
  const [refreshes, setRefreshes] = useState(0)

  const exhausted = refreshes >= maximumRefreshes

  const handleReset = useCallback(() => {
    setRefreshes(0)
    router.refresh()
  }, [router])

  useEffect(() => {
    if (exhausted) return

    const delay = Math.min(firstDelayMs * 2 ** refreshes, ceilingMs)
    let timer: ReturnType<typeof setTimeout> | undefined

    const schedule = () => {
      timer = setTimeout(() => {
        // A hidden tab stops rather than backing off. Nothing reschedules
        // until it is visible again, which is what the visibility listener is
        // for; a background tab must not keep asking the backend.
        if (document.visibilityState !== "visible") return
        router.refresh()
        setRefreshes((value) => value + 1)
      }, delay)
    }

    const handleVisibility = () => {
      if (document.visibilityState !== "visible") return
      clearTimeout(timer)
      schedule()
    }

    schedule()
    document.addEventListener("visibilitychange", handleVisibility)

    return () => {
      clearTimeout(timer)
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [refreshes, exhausted, firstDelayMs, ceilingMs, router])

  if (exhausted) {
    return (
      <output
        aria-live="polite"
        data-testid="import-poll"
        data-polling="stopped"
        className={panelVariants({
          variant: "sunken",
          padding: "compact",
          className: "text-ink-secondary flex flex-col items-start gap-2 text-sm",
        })}
      >
        <span>Stopped checking automatically. This import is still running.</span>
        <button
          type="button"
          onClick={handleReset}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Check again
        </button>
      </output>
    )
  }

  // A 2px rule, so a refresh never blanks content the reader is part way
  // through.
  return (
    <output
      aria-live="polite"
      data-testid="import-poll"
      data-polling="running"
      className={panelVariants({
        variant: "sunken",
        padding: "compact",
        className: "text-ink-secondary flex flex-col gap-2 text-sm",
      })}
    >
      <span className="poll-rule rounded-full" aria-hidden />
      Checking for progress. This page updates on its own while you are looking at it.
    </output>
  )
}
