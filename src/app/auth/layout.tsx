import type { ReactNode } from "react"

// Every Auth response is nonce-bearing and must never enter a cache.
export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"

const AuthLayout = ({ children }: { children: ReactNode }) => (
  <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 p-6">
    <header>
      <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
        Evirion
      </p>
      <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
        Engineering Memory Console
      </h1>
    </header>
    <main className="flex flex-col gap-6">{children}</main>
    <footer className="text-xs text-muted-foreground">
      Access is by invitation. Evirion never asks for a password.
    </footer>
  </div>
)

export default AuthLayout
