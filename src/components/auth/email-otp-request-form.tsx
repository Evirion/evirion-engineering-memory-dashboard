import { Field, Input, Label } from "@/components/ui/field"
import { SubmitButton } from "@/components/ui/submit-button"

/**
 * Requests an email code. The response is identical for a known and an
 * unknown address, so nothing here can be used to enumerate accounts. The
 * code is never placed in a URL and never stored in the browser.
 *
 * This was a client component only to hold a "sending" flag, which the submit
 * control now owns for every form in the Console. It also carried a "sent"
 * branch that nothing ever set, so the page shipped a state it could not
 * reach. Both are gone and the sign-in screen ships no component JavaScript
 * of its own.
 */
export const EmailOtpRequestForm = ({
  csrfToken,
  invitationId = "",
}: {
  csrfToken: string
  /**
   * Present when the reader followed an invitation link. It selects the backend
   * sign-in path that an invited reader needs, because their membership is
   * still `invited` and the member path requires `active`.
   */
  invitationId?: string
}) => (
  <form action="/api/auth/request-otp" method="post" className="flex flex-col gap-4">
    <input type="hidden" name="csrfToken" value={csrfToken} />
    {invitationId ? (
      <input type="hidden" name="invitationId" value={invitationId} />
    ) : null}
    <Field className="gap-2">
      <Label htmlFor="email" className="text-sm">
        Email address
      </Label>
      <Input
        id="email"
        name="email"
        type="email"
        required
        autoComplete="email"
        inputMode="email"
        spellCheck={false}
      />
    </Field>
    <SubmitButton variant="primary" size="lg">
      Send code
    </SubmitButton>
  </form>
)
