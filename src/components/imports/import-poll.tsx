"use client"

import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"

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
        className="flex flex-col gap-2 rounded border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700"
      >
        <span>Stopped checking automatically. This import is still running.</span>
        <button
          type="button"
          onClick={handleReset}
          className="self-start rounded border border-slate-400 px-3 py-1 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Check again
        </button>
      </output>
    )
  }

  return (
    <output
      aria-live="polite"
      data-testid="import-poll"
      data-polling="running"
      className="rounded border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700"
    >
      Checking for progress. This page updates on its own while you are looking at it.
    </output>
  )
}
