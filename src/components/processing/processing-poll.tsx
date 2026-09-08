"use client"

import { useRouter } from "next/navigation"
import { useEffect, useRef } from "react"

/**
 * Bounded refresh while any row is still moving on its own.
 *
 * Waits are excluded, so a customer reading authorization detail is not
 * interrupted by a reload.
 */
export const ProcessingPoll = () => {
  const router = useRouter()
  const attempts = useRef(0)

  useEffect(() => {
    if (document.hidden) return undefined

    const interval = window.setInterval(() => {
      if (document.hidden) return
      attempts.current += 1
      if (attempts.current > 8) {
        window.clearInterval(interval)
        return
      }
      router.refresh()
    }, 4000)

    return () => window.clearInterval(interval)
  }, [router])

  // A 2px rule rather than a blanked page: the reader was in the middle of
  // this table and the refresh must not take it away from them.
  return (
    <div className="flex flex-col gap-2">
      <div className="poll-rule rounded-full" aria-hidden />
      <output className="text-muted-foreground text-xs">
        Processing activity is still running. This page refreshes automatically.
      </output>
    </div>
  )
}
