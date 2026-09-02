import type { ReactNode } from "react"

import { ConsoleNavigation } from "@/components/layout/console-navigation"
import { requireSessionContext } from "@/server/queries/session-context"

// A tenant response must never enter the Next.js data, router or CDN cache.
export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"

/**
 * The protected shell. It loads the live session context once per request and
 * passes an immutable bounded projection down; no route re-derives identity
 * and nothing is held at module scope.
 */
const ConsoleLayout = async ({ children }: { children: ReactNode }) => {
  const result = await requireSessionContext()

  if (result.status === "unavailable") {
    return (
      <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-3 p-8">
        <h1 className="text-xl font-semibold tracking-tight">Console unavailable</h1>
        <p className="text-sm text-slate-600">{result.message}</p>
      </main>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <ConsoleNavigation context={result.context} />
      <main className="mx-auto w-full max-w-5xl flex-1 p-6">{children}</main>
    </div>
  )
}

export default ConsoleLayout
