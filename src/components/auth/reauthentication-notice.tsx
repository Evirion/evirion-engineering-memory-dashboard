/**
 * Published precondition for a gated mutation.
 *
 * The contract names recent reauthentication; the Console states that
 * requirement without claiming to know whether it is already satisfied.
 */
export const ReauthenticationPreconditionNotice = ({
  testId = "reauth-precondition-notice",
}: {
  testId?: string
}) => (
  <p data-testid={testId} className="text-xs text-slate-600">
    This action may require confirming your identity again before it is applied.
  </p>
)
