import { CopyIdentifier } from "./copy-identifier"

/**
 * Switching organization is a navigation preference and nothing more.
 *
 * It triggers a server reload; it mints no capability. Every backend path
 * carries an explicit organization target and re-derives tenant access from
 * trusted relationships, so changing this value cannot open another tenant.
 */
export const OrganizationSwitcher = ({
  organizationId,
  csrfToken,
}: {
  organizationId: string
  csrfToken: string
}) => (
  <form
    action="/api/auth/organization"
    method="post"
    className="flex min-w-0 items-center gap-1"
    aria-label="Active organization"
  >
    <input type="hidden" name="csrfToken" value={csrfToken} />
    {/*
      The identifier travels hidden and is shown as text rather than in a
      read-only field. The contract publishes no display name for an
      organization, so a UUID is all the header can state; dressed as an input
      it promised an edit that does not exist, and at 36 characters it ran off
      the end of its box and simply could not be read.
    */}
    <input type="hidden" name="organizationId" value={organizationId} />
    <span
      // The full value stays reachable: `title` for a pointer, and the copy
      // control beside it for everyone else.
      title={organizationId}
      data-testid="organization-identifier"
      className="text-ink-secondary min-w-0 truncate font-mono text-xs tabular-nums"
    >
      {organizationId}
    </span>
    <CopyIdentifier value={organizationId} label="organization identifier" />
  </form>
)
