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
    <input
      id="organizationId"
      name="organizationId"
      defaultValue={organizationId}
      readOnly
      className="w-64 rounded border border-slate-300 px-2 py-1 font-mono text-xs text-slate-600"
    />
  </form>
)
