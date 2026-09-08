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
    className="flex items-center gap-2"
    aria-label="Active organization"
  >
    <input type="hidden" name="csrfToken" value={csrfToken} />
    <label htmlFor="organizationId" className="sr-only">
      Active organization
    </label>
    {/*
      Rendered borderless. The contract publishes no display name for an
      organization, so this is a read-only identifier stating which tenant is
      active, and dressing it as an editable field would promise a control
      that does not exist.
    */}
    <input
      id="organizationId"
      name="organizationId"
      defaultValue={organizationId}
      readOnly
      className="text-ink-secondary w-64 max-w-full border-none bg-transparent p-0 font-mono text-xs tabular-nums"
    />
  </form>
)
