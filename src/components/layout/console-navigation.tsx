import type { SessionContext } from "@contracts/console"

import { roleLabel, visibleNavigation } from "@/lib/auth/capabilities"
import { OrganizationSwitcher } from "./organization-switcher"

/**
 * Navigation reflects backend capabilities. A hidden entry is a convenience:
 * reaching the same route directly is still refused by the backend, and the
 * refusal path is rendered rather than assumed unreachable.
 */
export const ConsoleNavigation = ({
  context,
  csrfToken,
}: {
  context: SessionContext
  csrfToken: string
}) => (
  <header className="border-b border-slate-200">
    <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-4 p-4">
      <span className="text-sm font-semibold tracking-tight">Engineering Memory</span>
      <OrganizationSwitcher
        organizationId={context.organizationId}
        csrfToken={csrfToken}
      />
      <nav aria-label="Console" className="flex flex-1 flex-wrap gap-3">
        {visibleNavigation(context).map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="rounded px-2 py-1 text-sm text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {item.label}
          </a>
        ))}
      </nav>
      <span className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
        {roleLabel(context.role)}
      </span>
      <form action="/api/auth/logout" method="post">
        <input type="hidden" name="csrfToken" value={csrfToken} />
        <button
          type="submit"
          className="rounded border border-slate-300 px-3 py-1 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Sign out
        </button>
      </form>
    </div>
  </header>
)
