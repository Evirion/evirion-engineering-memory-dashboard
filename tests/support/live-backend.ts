/**
 * Access to a real backend for the conformance tier.
 *
 * The tier compares the backend's actual bytes against this Console's generated
 * validators. Without a backend there is nothing to compare, and a silent skip
 * would report success for the exact comparison the tier exists to perform. So
 * it fails closed and says what to start.
 */
export type LiveBackend = {
  readonly baseUrl: string
}

export const LIVE_BACKEND_VARIABLE = "CONSOLE_LIVE_BACKEND_URL"

export const liveBackendUrl = (): string | undefined => {
  const value = process.env[LIVE_BACKEND_VARIABLE]
  return value === undefined || value.trim() === "" ? undefined : value.trim()
}

export const requireLiveBackend = (): LiveBackend => {
  const baseUrl = liveBackendUrl()
  if (baseUrl === undefined) {
    throw new Error(
      `${LIVE_BACKEND_VARIABLE} is not set. The conformance tier needs a running ` +
        "backend: start the local stack in the sibling checkout and set it to the " +
        "console-api function origin. This tier never skips, because a skipped " +
        "conformance run proves nothing.",
    )
  }
  return { baseUrl: baseUrl.replace(/\/+$/, "") }
}
