"use client"

import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"

import { heartbeatIsDue, idleStateAt, minutesRemaining } from "@/lib/auth/idle-window"

/**
 * Keeps a present reader signed in, and warns one who is about to be signed out.
 *
 * The idle window is extended by requests that reach the backend, and reading a
 * page is not a request. A reader who was looking at the Console without
 * clicking was therefore signed out mid-sentence. Real interaction in a visible
 * tab now sends one heartbeat, no more often than the coalescing interval the
 * database itself applies.
 *
 * Three things deliberately do not count as activity, because the frozen
 * contract excludes them: a hidden tab, a tab that is merely visible and
 * untouched, and background polling. Only pointer, keyboard and scroll input
 * while the tab is visible is a person.
 *
 * The countdown shown here is this component's own mirror of the frozen policy.
 * The database owns the deadline and will refuse the next request on its own
 * clock regardless, so nothing is authorized on what is measured here.
 */
const TICK_MS = 15_000
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "scroll"] as const

export const SessionActivity = ({ csrfToken }: { readonly csrfToken: string }) => {
  const router = useRouter()
  // Both clocks start when the component mounts, not while it renders: reading
  // the wall clock during render is impure and would differ between passes.
  const lastActivityAt = useRef(0)
  const lastHeartbeatAt = useRef(0)
  const inFlight = useRef(false)
  const [idleForSeconds, setIdleForSeconds] = useState(0)

  const sendHeartbeat = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    try {
      const body = new FormData()
      body.set("csrfToken", csrfToken)
      const response = await fetch("/api/session/activity", {
        method: "POST",
        body,
        credentials: "same-origin",
        cache: "no-store",
      })
      lastHeartbeatAt.current = Date.now()
      // The window already closed, or the session is gone. Re-rendering the
      // route lets the protected shell decide, rather than guessing here.
      if (response.status === 401) router.refresh()
    } catch {
      // A failed heartbeat is not an outcome to report. The next request the
      // reader makes meets the backend's own answer.
    } finally {
      inFlight.current = false
    }
  }, [csrfToken, router])

  const recordActivity = useCallback(() => {
    if (document.visibilityState !== "visible") return
    lastActivityAt.current = Date.now()
    setIdleForSeconds(0)
    if (heartbeatIsDue((Date.now() - lastHeartbeatAt.current) / 1000)) {
      void sendHeartbeat()
    }
  }, [sendHeartbeat])

  useEffect(() => {
    lastActivityAt.current = Date.now()
    for (const name of ACTIVITY_EVENTS) {
      document.addEventListener(name, recordActivity, { passive: true })
    }
    const timer = setInterval(() => {
      setIdleForSeconds((Date.now() - lastActivityAt.current) / 1000)
    }, TICK_MS)

    return () => {
      for (const name of ACTIVITY_EVENTS) {
        document.removeEventListener(name, recordActivity)
      }
      clearInterval(timer)
    }
  }, [recordActivity])

  const state = idleStateAt(idleForSeconds)
  if (state === "active") return null

  if (state === "elapsed") {
    return (
      <output
        aria-live="assertive"
        data-testid="session-idle"
        data-idle-state="elapsed"
        className="rounded border border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-900"
      >
        This session has been inactive long enough to end. The next thing you do will
        ask you to sign in again.
      </output>
    )
  }

  return (
    <output
      aria-live="polite"
      data-testid="session-idle"
      data-idle-state="warning"
      className="flex flex-wrap items-center gap-3 rounded border border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
      <span>
        You will be signed out in about {minutesRemaining(idleForSeconds)} minutes
        without activity.
      </span>
      <button
        type="button"
        onClick={() => void sendHeartbeat().then(() => recordActivity())}
        className="rounded border border-amber-500 px-3 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        Stay signed in
      </button>
    </output>
  )
}
