export const dynamic = "force-dynamic"

/**
 * Declared root entry. It carries no customer data and reaches no backend:
 * the Auth phase replaces this body with a server-side redirect to the
 * authorized destination. See ADR-0003 for why the route is declared rather
 * than frozen.
 */
const HomePage = () => (
  <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-4 p-8">
    <h1 className="text-2xl font-semibold tracking-tight">
      Evirion Engineering Memory Console
    </h1>
    <p className="text-sm text-slate-600">
      This deployment carries no customer functionality yet.
    </p>
  </main>
)

export default HomePage
