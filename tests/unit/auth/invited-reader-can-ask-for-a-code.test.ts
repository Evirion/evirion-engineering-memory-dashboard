import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * An invited reader must be able to ask for a code and get one.
 *
 * The invitation carries a code that lives ten minutes while the invitation
 * itself lives seven days, so nearly every invited reader arrives with a dead
 * one. Pressing the button refused them: their address exists but is
 * unconfirmed, and Supabase answers a code request for an unconfirmed account
 * with `signup_disabled`, which this project sets deliberately. Resending the
 * signup confirmation reaches the same code by the route that is allowed.
 */

const signInWithOtp = vi.fn()
const resend = vi.fn()

vi.mock("server-only", () => ({}))

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: { signInWithOtp, resend } }),
}))

vi.mock("@/lib/env/server", () => ({
  readServerEnvironment: () => ({
    supabaseUrl: "https://project.supabase.co",
    supabasePublishableKey: "sb_publishable_test",
  }),
}))

const { createSupabaseAuthProvider } = await import("@/lib/auth/auth-provider")

const SIGNUP_DISABLED = { message: "Signups not allowed for this instance" }

describe("requesting a code as an invited reader", () => {
  beforeEach(() => {
    signInWithOtp.mockReset()
    resend.mockReset()
  })

  it("does not resend when the ordinary request is accepted", async () => {
    signInWithOtp.mockResolvedValue({ error: null })

    const outcome =
      await createSupabaseAuthProvider().requestEmailOtp("reader@evirion.test")

    expect(outcome).toEqual({ status: "ok", value: null })
    expect(resend).not.toHaveBeenCalled()
  })

  it("resends the signup confirmation when the address is not yet confirmed", async () => {
    signInWithOtp.mockResolvedValue({ error: SIGNUP_DISABLED })
    resend.mockResolvedValue({ error: null })

    const outcome =
      await createSupabaseAuthProvider().requestEmailOtp("invited@evirion.test")

    expect(outcome).toEqual({ status: "ok", value: null })
    expect(resend).toHaveBeenCalledWith({
      type: "signup",
      email: "invited@evirion.test",
    })
  })

  it("answers a refused address exactly as it answers an accepted one", async () => {
    signInWithOtp.mockResolvedValue({ error: SIGNUP_DISABLED })
    resend.mockResolvedValue({ error: { message: "User not found" } })

    const outcome = await createSupabaseAuthProvider().requestEmailOtp(
      "stranger@evirion.test",
    )

    // Denial is reported to the caller, which renders the same page either way;
    // what must not differ is anything the browser can observe.
    expect(outcome).toEqual({ status: "denied", reason: "otp-request-denied" })
  })

  it("reports an unknown outcome when the transport itself fails", async () => {
    signInWithOtp.mockRejectedValue(new Error("network"))

    const outcome =
      await createSupabaseAuthProvider().requestEmailOtp("reader@evirion.test")

    expect(outcome).toEqual({ status: "unknown" })
    expect(resend).not.toHaveBeenCalled()
  })
})
