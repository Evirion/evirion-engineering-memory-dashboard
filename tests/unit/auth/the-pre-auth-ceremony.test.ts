import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { describe, expect, it, vi } from "vitest"

import {
  type ConsoleTransport,
  SESSION_PRE_AUTH_PATH,
  invitationAcceptancePath,
  issuePreAuthTransaction,
} from "@/server/adapters/console-api"

import { repositoryRoot } from "../../support/source-tree"

/**
 * A session needs a transaction the backend issued, not one the BFF invented.
 *
 * `api.bootstrap_console_auth_session` looks the pre-auth transaction up by the
 * identifier the bootstrap names and requires it in `otp_verified`. The BFF
 * minted its own identifier in a cookie and sent that, so the row was never
 * found and every sign-in was refused with `AUTHENTICATION_REQUIRED`. Nothing
 * caught it because `private.console_pre_auth_transactions` being permanently
 * empty looked like an unused table rather than a broken ceremony.
 */

const REQUEST_ID = "00000000-0000-4000-8000-0000000001aa"
const TRANSACTION_ID = "00000000-0000-4000-8000-000000000301"
const INVITATION_ID = "2075c072-5208-4164-b57f-bc135bb57f8c"

const enveloped = (data: unknown): unknown => ({
  contractVersion: "1.0",
  requestId: REQUEST_ID,
  data,
})

const transportReturning = (status: number, payload: unknown): ConsoleTransport =>
  vi.fn(async () => ({ status, json: async () => payload }))

const request = {
  accessToken: "caller-access-token",
  correlationId: "00000000-0000-4000-8000-0000000002aa",
  idempotencyKey: "00000000-0000-4000-8000-0000000002bb",
} as const

describe("issuing the pre-auth transaction", () => {
  it("posts an empty body to the member route and returns the identifier", async () => {
    const transport = transportReturning(
      200,
      enveloped({ preAuthTransactionId: TRANSACTION_ID, state: "OTP_VERIFIED" }),
    )

    const result = await issuePreAuthTransaction(
      "https://backend.test",
      SESSION_PRE_AUTH_PATH,
      request,
      transport,
    )

    expect(result).toEqual({
      ok: true,
      value: { preAuthTransactionId: TRANSACTION_ID, state: "OTP_VERIFIED" },
      requestId: REQUEST_ID,
    })
    const call = vi.mocked(transport).mock.calls[0]
    expect(call).toBeDefined()
    expect(call?.[0]).toContain(SESSION_PRE_AUTH_PATH)
    expect(call?.[1].method).toBe("POST")
    // The route accepts an object with no members, and an absent body is not one.
    expect(call?.[1].body).toBe("{}")
  })

  it("addresses the acceptance route when a reader holds an invitation", () => {
    expect(invitationAcceptancePath(INVITATION_ID)).toBe(
      `/v1/invitations/${INVITATION_ID}/accept`,
    )
  })

  it("refuses a response that carries no identifier", async () => {
    const result = await issuePreAuthTransaction(
      "https://backend.test",
      SESSION_PRE_AUTH_PATH,
      request,
      transportReturning(200, enveloped({ state: "OTP_VERIFIED" })),
    )

    expect(result.ok).toBe(false)
  })

  it("reports a refusal rather than inventing a transaction", async () => {
    const result = await issuePreAuthTransaction(
      "https://backend.test",
      SESSION_PRE_AUTH_PATH,
      request,
      transportReturning(403, {
        contractVersion: "1.0",
        requestId: REQUEST_ID,
        error: {
          code: "ORGANIZATION_MEMBERSHIP_REQUIRED",
          message: "Membership required.",
          retryable: false,
        },
      }),
    )

    expect(result.ok).toBe(false)
  })
})

const source = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(relative, repositoryRoot)), "utf8")

const VERIFY_OTP = "src/app/api/auth/verify-otp/route.ts"

describe("the ceremony the verify route performs", () => {
  it("issues the transaction before it signs anything", () => {
    const route = source(VERIFY_OTP)
    const issue = route.indexOf("await issuePreAuthTransaction(")
    const sign = route.indexOf("await signBootstrapProof(")

    expect(issue).toBeGreaterThan(-1)
    expect(sign).toBeGreaterThan(-1)
    expect(issue).toBeLessThan(sign)
  })

  it("chooses the acceptance route only for a reader holding an invitation", () => {
    const route = source(VERIFY_OTP)

    expect(route).toContain("SESSION_PRE_AUTH_PATH")
    expect(route).toContain("invitationAcceptancePath(invitationId)")
  })

  it("sends the identifier the backend issued, never a local one", () => {
    const route = source(VERIFY_OTP)

    expect(route).toContain("preAuthTransactionId: preAuth.value.preAuthTransactionId")
    // The cookie identifier binds CSRF and is not a backend transaction.
    expect(route).not.toContain("preAuthTransactionId: guard.binding.transactionId")
  })

  it("carries the exact body keys the route declares", () => {
    const route = source(VERIFY_OTP)

    expect(route).toContain("deviceLabel: CONSOLE_DEVICE_LABEL")
    expect(route).toContain("preAuthTransactionId: preAuth.value.preAuthTransactionId")
  })

  it("uses a UUID idempotency key, which the backend requires", () => {
    const route = source(VERIFY_OTP)

    expect(route).toContain("const idempotencyKey = crypto.randomUUID()")
    expect(route).not.toContain("`bootstrap:${user.value.sessionId}`")
  })

  it("fails closed when the transaction cannot be issued", () => {
    const route = source(VERIFY_OTP)
    const issue = route.indexOf("await issuePreAuthTransaction(")
    const refusal = route.indexOf("if (!preAuth.ok) return denied(", issue)
    const bootstrap = route.indexOf("await bootstrapSession(")

    expect(refusal).toBeGreaterThan(issue)
    expect(refusal).toBeLessThan(bootstrap)
  })
})
