import type { ReactNode } from "react"

import { ConsoleBar, ConsoleSidebar } from "@/components/layout/console-navigation"
import { SessionActivity } from "@/components/session/session-activity"
import { Panel } from "@/components/ui/panel"
import { Lede, PageTitle } from "@/components/ui/text"
import { readSessionCsrfToken } from "@/server/actions/session-csrf-read"
import { requireSessionContext } from "@/server/queries/session-context"

// A tenant response must never enter the Next.js data, router or CDN cache.
export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"

/**
 * The protected shell. It loads the live session context once per request and
 * passes an immutable bounded projection down; no route re-derives identity
 * and nothing is held at module scope.
 *
 * The layout is a sidebar and one content column, deliberately. A second
 * column would have to be fed from somewhere, and every page here already
 * carries its own three-axis or two-axis breakdown inside its rows; a rail
 * repeating that is a place for two versions of the same fact to disagree.
 */
const ConsoleLayout = async ({ children }: { children: ReactNode }) => {
  const result = await requireSessionContext()
  const csrfToken = await readSessionCsrfToken()

  if (result.status === "unavailable") {
    return (
      <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-4 p-8">
        <PageTitle>Console unavailable</PageTitle>
        <Panel>
          <Lede>{result.message}</Lede>
        </Panel>
      </main>
    )
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-[248px_minmax(0,1fr)]">
      {/*
        A keyboard reader meets seven navigation links before the document on
        every single page once the navigation is a sidebar. The skip link is
        what makes that bearable, and it is the first thing in the tab order
        by construction.
      */}
      <a
        href="#console-content"
        className="focus:bg-primary focus:text-primary-foreground sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-lg focus:px-4 focus:py-2 focus:text-sm focus:font-medium"
      >
        Skip to content
      </a>

      <ConsoleSidebar context={result.context} />

      {/*
        One measure, shared by the bar and the document beneath it, so the
        sign-out control always sits over the right edge of the content.
        1100px is a reading width and it is right for prose and card rows; a
        table is not prose and suffocates in it. A page opts out by marking
        its own content `data-wide`, which this reads with `:has()` and turns
        into a wider measure for both.

        It is a custom property set by a class rather than a style attribute,
        because the Content-Security-Policy refuses one that arrives in
        server-rendered markup.
      */}
      <div className="flex min-w-0 flex-col [--console-measure:1100px] has-[[data-wide]]:[--console-measure:1520px]">
        <ConsoleBar context={result.context} csrfToken={csrfToken} />
        <main
          id="console-content"
          className="mx-auto flex w-full max-w-(--console-measure) flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-10"
        >
          <SessionActivity csrfToken={csrfToken} />
          {children}
        </main>
      </div>
    </div>
  )
}

export default ConsoleLayout
