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

  return (
    <output className="text-sm text-slate-600">
      Processing activity is still running. This page refreshes automatically.
    </output>
  )
}
