import type { ReactNode } from "react"

import { panelVariants } from "@/components/ui/panel"

// Every Auth response is nonce-bearing and must never enter a cache.
export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"

/**
 * The one screen a partner sees before the product.
 *
 * The task sits on a raised panel because every other surface in the Console
 * does, and this was the only screen still speaking a different language —
 * which made the product's first impression the one page that looked
 * unfinished. Here the panel earns its elevation for a second reason: the
 * page holds nothing else, so the card is what says "this is the thing to
 * do".
 *
 * The wordmark above and the invitation note below stay outside it. They
 * describe the page rather than belonging to the task, and the Brand Book
 * keeps titles and captions off the card for exactly that reason.
 */
const AuthLayout = ({ children }: { children: ReactNode }) => (
  <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 p-6">
    <header className="flex flex-col gap-1">
      <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
        Evirion
      </p>
      <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
        Engineering Memory Console
      </h1>
    </header>
    <main
      className={panelVariants({
        padding: "roomy",
        className: "flex flex-col gap-6",
      })}
    >
      {children}
    </main>
    <footer className="text-xs text-muted-foreground">
      Access is by invitation. Evirion never asks for a password.
    </footer>
  </div>
)

export default AuthLayout
