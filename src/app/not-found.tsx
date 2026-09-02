/**
 * Not-found and forbidden are deliberately indistinguishable. The backend
 * refuses a foreign resource without disclosing whether it exists, and this
 * page must not undo that.
 */
const NotFound = () => (
  <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-4 p-8">
    <h1 className="text-2xl font-semibold tracking-tight">Not available</h1>
    <p className="text-sm text-slate-600">
      This page is not available for your account.
    </p>
  </main>
)

export default NotFound
