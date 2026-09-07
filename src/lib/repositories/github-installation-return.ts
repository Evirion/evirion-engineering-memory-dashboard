/**
 * The query GitHub puts on the Setup URL when a reader returns from installing.
 *
 * None of it is signed. The state is the only part that proves anything, and it
 * proves which organization asked, not what was installed. Everything here is
 * therefore shape validation whose job is to refuse rather than to interpret.
 */
export type GithubInstallationReturn = {
  readonly state: string
  readonly providerInstallationId: number
}

const SETUP_STATE = /^[0-9a-f]{64}$/
const PROVIDER_INSTALLATION_ID = /^[1-9][0-9]{0,17}$/

/**
 * A provider installation identifier that survives the round trip as a number.
 *
 * The digit pattern GitHub can produce reaches past `Number.MAX_SAFE_INTEGER`,
 * where `Number` rounds silently and would name a different installation than
 * the one the reader installed. The round-trip comparison is what catches it.
 */
export const safeInstallationId = (value: string): number | null => {
  if (!PROVIDER_INSTALLATION_ID.test(value)) return null
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && String(parsed) === value ? parsed : null
}

export const readInstallationReturn = (
  parameters: URLSearchParams,
): GithubInstallationReturn | null => {
  // GitHub sends `install`, `update` and `request`. Only a fresh install
  // carries a setup intent this Console issued; the others have nothing to
  // complete and are refused rather than half-handled.
  if (parameters.get("setup_action") !== "install") return null

  const state = parameters.get("state") ?? ""
  if (!SETUP_STATE.test(state)) return null

  const providerInstallationId = safeInstallationId(
    parameters.get("installation_id") ?? "",
  )
  if (providerInstallationId === null) return null

  return { state, providerInstallationId }
}
