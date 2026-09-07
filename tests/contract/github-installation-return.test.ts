import { describe, expect, it } from "vitest"

import { completeGithubInstallation } from "@/server/adapters/repositories"

const scope = {
  baseUrl: "https://backend.test",
  organizationId: "00000000-0000-4000-8000-000000000001",
  accessToken: "token",
  correlationId: "00000000-0000-4000-8000-0000000000c1",
} as const

const KEY = "00000000-0000-4000-8000-0000000000e1"
const STATE = "ab".repeat(32)

const respond = (data: unknown) => async () => ({
  status: 200,
  json: async () => ({
    contractVersion: "1.0",
    requestId: "00000000-0000-4000-8000-0000000000f1",
    data,
  }),
})

const connectedReceipt = {
  receiptId: "00000000-0000-4000-8000-0000000000a1",
  status: "completed",
  responseCode: "GITHUB_INSTALLATION_CONNECTED",
  responsePayload: {
    changed: true,
    organizationId: scope.organizationId,
    setupIntent: {
      id: "00000000-0000-4000-8000-0000000000b1",
      status: "CONSUMED",
      resolvedAt: "2026-09-07T12:16:31.000000Z",
      failureCode: null,
    },
    installation: {
      id: "00000000-0000-4000-8000-0000000000d1",
      status: "ACTIVE",
      accountLogin: "acme",
      connectedAt: "2026-09-07T12:16:31.000000Z",
    },
  },
}

const pendingReceipt = {
  ...connectedReceipt,
  responseCode: "GITHUB_INSTALLATION_PENDING_PROVIDER",
  responsePayload: {
    ...connectedReceipt.responsePayload,
    installation: null,
  },
}

describe("completing a GitHub installation return", () => {
  it("never sends accountLogin in the callback body", async () => {
    let body: unknown
    const transport = async (_url: string, init: RequestInit) => {
      body = JSON.parse(String(init.body))
      return respond(connectedReceipt)()
    }

    const result = await completeGithubInstallation(
      scope,
      {
        state: STATE,
        providerInstallationId: 991001,
        idempotencyKey: KEY,
      },
      transport as never,
    )

    expect(result.ok).toBe(true)
    expect(body).toEqual({ state: STATE, providerInstallationId: 991001 })
  })

  it("accepts the connected receipt shape", async () => {
    const result = await completeGithubInstallation(
      scope,
      { state: STATE, providerInstallationId: 991001, idempotencyKey: KEY },
      respond(connectedReceipt) as never,
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.responseCode).toBe("GITHUB_INSTALLATION_CONNECTED")
  })

  it("accepts the pending-provider receipt shape", async () => {
    const result = await completeGithubInstallation(
      scope,
      { state: STATE, providerInstallationId: 991001, idempotencyKey: KEY },
      respond(pendingReceipt) as never,
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.responseCode).toBe("GITHUB_INSTALLATION_PENDING_PROVIDER")
    expect(result.value.responsePayload.installation).toBeNull()
  })

  it("forwards a malformed state without adding accountLogin", async () => {
    let body: unknown
    const transport = async (_url: string, init: RequestInit) => {
      body = JSON.parse(String(init.body))
      return respond(connectedReceipt)()
    }

    await completeGithubInstallation(
      scope,
      { state: "not-a-state", providerInstallationId: 991001, idempotencyKey: KEY },
      transport as never,
    )

    expect(body).toEqual({ state: "not-a-state", providerInstallationId: 991001 })
  })

  it("refuses a replayed backend error envelope", async () => {
    const result = await completeGithubInstallation(
      scope,
      { state: STATE, providerInstallationId: 991001, idempotencyKey: KEY },
      async () => ({
        status: 409,
        json: async () => ({
          contractVersion: "1.0",
          requestId: "00000000-0000-4000-8000-0000000000f1",
          error: {
            code: "SUPERSESSION_INVALID",
            message: "The setup state was already consumed.",
            retryable: false,
          },
        }),
      }),
    )

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.failure.kind).toBe("error")
    if (result.failure.kind === "error") {
      expect(result.failure.error.error.code).toBe("SUPERSESSION_INVALID")
    }
  })

  it("refuses a sessionless transport response", async () => {
    const result = await completeGithubInstallation(
      scope,
      { state: STATE, providerInstallationId: 991001, idempotencyKey: KEY },
      async () => ({
        status: 401,
        json: async () => ({
          contractVersion: "1.0",
          requestId: "00000000-0000-4000-8000-0000000000f1",
          error: {
            code: "AUTHENTICATION_REQUIRED",
            message: "Sign in is required.",
            retryable: false,
          },
        }),
      }),
    )

    expect(result.ok).toBe(false)
  })
})
