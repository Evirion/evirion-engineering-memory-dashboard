"use client"

import { useCallback, useEffect, useState } from "react"

import { buttonVariants } from "@/components/ui/button"
import { panelVariants } from "@/components/ui/panel"
import { Spinner } from "@/components/ui/spinner"
import {
  type ImportProgressSnapshot,
  importProgressMoved,
  isImportPollAbsent,
  isImportProgressSnapshot,
} from "@/lib/imports/presentation"

/**
 * A bounded poll while an import is still running.
 *
 * The parent renders it only while the backend is moving the run on its own.
 * It reads a payload-free progress snapshot from the BFF and reloads only when
 * that snapshot differs from what this page rendered. A soft `router.refresh()`
 * left the discovering and extracting labels on screen after the backend had
 * already moved; a full load is what a manual reload did.
 *
 * Unchanged snapshots do not reload, so a run that is honestly still
 * extracting does not flash the page every few seconds. Three bounds hold:
 * the interval doubles up to a ceiling, the number of checks is capped, and
 * an inactive tab stops polling until it is looked at again.
 */
export const ImportPoll = ({
  repositoryId,
  snapshot,
  firstDelayMs = 5_000,
  ceilingMs = 60_000,
  maximumRefreshes = 20,
}: {
  readonly repositoryId: string
  readonly snapshot: ImportProgressSnapshot
  readonly firstDelayMs?: number
  readonly ceilingMs?: number
  readonly maximumRefreshes?: number
}) => {
  const [refreshes, setRefreshes] = useState(0)
  const { status, discovered, completed, failed } = snapshot

  const exhausted = refreshes >= maximumRefreshes

  const handleReset = useCallback(() => {
    setRefreshes(0)
  }, [])

  useEffect(() => {
    if (exhausted) return

    const delay = Math.min(firstDelayMs * 2 ** refreshes, ceilingMs)
    let timer: ReturnType<typeof setTimeout> | undefined
    const controller = new AbortController()

    const schedule = () => {
      timer = setTimeout(() => {
        void (async () => {
          if (document.visibilityState !== "visible") return
          const rendered: ImportProgressSnapshot = {
            status,
            discovered,
            completed,
            failed,
          }
          const response = await fetch(
            `/api/imports/status?repositoryId=${encodeURIComponent(repositoryId)}`,
            {
              method: "GET",
              cache: "no-store",
              signal: controller.signal,
              headers: { accept: "application/json" },
            },
          )
          if (response.status === 401) {
            window.location.reload()
            return
          }
          if (!response.ok) {
            setRefreshes((value) => value + 1)
            return
          }
          const body: unknown = await response.json()
          if (isImportPollAbsent(body)) {
            window.location.reload()
            return
          }
          if (!isImportProgressSnapshot(body) || !importProgressMoved(rendered, body)) {
            setRefreshes((value) => value + 1)
            return
          }
          window.location.reload()
        })().catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return
          setRefreshes((value) => value + 1)
        })
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
      controller.abort()
      clearTimeout(timer)
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [
    refreshes,
    exhausted,
    firstDelayMs,
    ceilingMs,
    repositoryId,
    status,
    discovered,
    completed,
    failed,
  ])

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
        <span>
          This import has not progressed. Check again, or cancel this run below and
          prepare another.
        </span>
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
      <span className="flex items-center gap-2">
        <Spinner className="size-3.5" />
        Checking for progress. This page updates when the import actually moves.
      </span>
    </output>
  )
}
