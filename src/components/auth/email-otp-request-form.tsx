"use client"

import { useState } from "react"

/**
 * Requests an email code. The response is identical for a known and an
 * unknown address, so nothing here can be used to enumerate accounts. The
 * code is never placed in a URL and never stored in the browser.
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
}) => {
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle")

  const handleSubmit = () => {
    setStatus("sending")
  }

  if (status === "sent") {
    return (
      <output className="text-sm text-slate-700">
        If that address has an invitation, a code is on its way.
      </output>
    )
  }

  return (
    <form
      action="/api/auth/request-otp"
      method="post"
      onSubmit={handleSubmit}
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="csrfToken" value={csrfToken} />
      {invitationId ? (
        <input type="hidden" name="invitationId" value={invitationId} />
      ) : null}
      <div className="flex flex-col gap-2">
        <label htmlFor="email" className="text-sm font-medium">
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          spellCheck={false}
          className="rounded border border-slate-300 px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        />
      </div>
      <button
        type="submit"
        disabled={status === "sending"}
        className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        {status === "sending" ? "Sending" : "Send code"}
      </button>
    </form>
  )
}
