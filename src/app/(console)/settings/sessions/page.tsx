import { requireSessionContext } from "@/server/queries/session-context"

export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"

/**
 * The principal's own application-session inventory.
 *
 * Rows carry bounded device and time labels only: no IP address, no
 * User-Agent payload and no token. Revoking denies application access
 * immediately; the provider sign-out is a reconciled follow-up, and revoking
 * one selected non-current session is application-only because the standard
 * provider API cannot revoke an arbitrary session by ID.
 */
const SessionsPage = async () => {
  const result = await requireSessionContext()

  if (result.status === "unavailable") {
    return <p className="text-sm text-slate-600">{result.message}</p>
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">Your sessions</h1>
        <p className="text-sm text-slate-600">
          At most three sessions stay active. Signing in a fourth time replaces the
          oldest one, and you are told when that happens.
        </p>
      </div>

      <form
        action="/api/auth/sessions/revoke"
        method="post"
        className="flex flex-wrap gap-3"
      >
        <button
          name="selection"
          value="others"
          type="submit"
          className="rounded border border-slate-300 px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Sign out other sessions
        </button>
        <button
          name="selection"
          value="all"
          type="submit"
          className="rounded border border-slate-300 px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Sign out everywhere
        </button>
      </form>

      <p className="rounded border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700">
        Ending one other session takes effect here immediately. That specific session
        cannot also be ended at the identity provider, so it is recorded as not
        applicable rather than retried.
      </p>
    </section>
  )
}

export default SessionsPage
