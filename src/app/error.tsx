"use client"

/**
 * The error boundary shows a correlation-free generic message. A backend
 * message may carry a stable code but never a raw SQL, Supabase, GitHub,
 * worker or provider error, so nothing from `error` is rendered.
 */
const ErrorBoundary = ({ reset }: { error: Error; reset: () => void }) => (
  <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-4 p-8">
    <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
    <p className="text-sm text-slate-600">
      The Console could not complete that request. Nothing was changed.
    </p>
    <button
      type="button"
      onClick={reset}
      className="w-fit rounded border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      Try again
    </button>
  </main>
)

export default ErrorBoundary
