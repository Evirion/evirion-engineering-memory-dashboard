/**
 * Published precondition for a gated mutation.
 *
 * The contract names recent reauthentication. Saying only that, as this used
 * to, left a reader to guess how the requirement is met, and the reasonable
 * guess is the wrong one: that they must sign out and sign in again. Nothing
 * of the sort happens. `GatedForm` intercepts the submit, the backend stores
 * the request, the reader enters one code, and the same request is replayed
 * server-side and lands them back where they were.
 *
 * So this names the behaviour rather than the precondition, and it needs no
 * control of its own: the button the reader was already reaching for is the
 * one that starts the step-up. A second button would ask them to choose
 * between two ways of doing one thing, and the one they picked first would be
 * the one that already worked.
 */
export const ReauthenticationPreconditionNotice = ({
  testId = "reauth-precondition-notice",
}: {
  testId?: string
}) => (
  <p data-testid={testId} className="text-xs text-ink-secondary">
    Submitting may first ask for a code from your authenticator app. It then finishes on
    its own: you stay signed in, and nothing you entered here is lost.
  </p>
)
