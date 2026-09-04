import {
  INVALID_CHALLENGE,
  PENDING_EXPIRED,
  PENDING_SESSION_MISMATCH,
} from "@/lib/auth/reauthentication-result-codes"
import type { ReauthenticationGate } from "@/lib/auth/reauthentication-action-class"
import {
  ReauthenticationCeremony,
  ReauthenticationUnavailable,
} from "@/components/auth/reauthentication-ceremony"

/**
 * Step-up offer for a gated command.
 *
 * Ordinary command receipts stay on the surface-specific outcome notice so a
 * refusal and a step-up request are never rendered twice.
 */
export const ReauthenticationOutcome = ({
  result,
  reauthRequired,
  csrfToken,
  hasPending,
  gate,
  returnPath,
}: {
  result: string | undefined
  reauthRequired: boolean
  csrfToken: string
  hasPending: boolean
  gate: ReauthenticationGate
  returnPath: string
}) => {
  const ceremonyRequested =
    reauthRequired ||
    result === "REAUTHENTICATION_REQUIRED" ||
    result === INVALID_CHALLENGE ||
    result === PENDING_EXPIRED ||
    result === PENDING_SESSION_MISMATCH

  if (!ceremonyRequested) return null

  if (!hasPending) {
    return <ReauthenticationUnavailable />
  }

  return (
    <ReauthenticationCeremony
      csrfToken={csrfToken}
      result={result}
      revokesOtherSessions
      gate={gate}
      returnPath={returnPath}
    />
  )
}

export { INVALID_CHALLENGE }
