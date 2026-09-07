import { describe, expect, it } from "vitest"

import { startGithubInstallation } from "@/server/adapters/repositories"

/**
 * Both GitHub commands answer the durable receipt every Console mutation
 * carries, with the command's own result inside `responsePayload`. The Console
 * validated that interior as if it were the whole body, so a successful start
 * was discarded as unrecognisable and the reader was told the service was busy.
 *
 * Observed on the deployed Console on 2026-09-07: the backend answered `200`,
 * wrote the setup intent, and the Console rendered `DEPENDENCY_UNAVAILABLE`.
 * The generated `isCommandReceipt` cannot stand in — its `responseCode` is
 * closed over four entitlement codes, which is the defect ADR 0016 records.
 */

const scope = {
  baseUrl: "https://backend.test",
  organizationId: "00000000-0000-4000-8000-000000000001",
  accessToken: "token",
  correlationId: "00000000-0000-4000-8000-0000000000c1",
} as const

const KEY = "00000000-0000-4000-8000-0000000000e1"

const respond = (data: unknown) => async () => ({
  status: 200,
  json: async () => ({
    contractVersion: "1.0",
    requestId: "00000000-0000-4000-8000-0000000000f1",
    data,
  }),
})

const receipt = {
  receiptId: "00000000-0000-4000-8000-0000000000a1",
  status: "completed",
  responseCode: "GITHUB_INSTALLATION_SETUP_STARTED",
  responsePayload: {
    changed: true,
    organizationId: scope.organizationId,
    currentInstallationId: null,
    setupIntent: {
      id: "00000000-0000-4000-8000-0000000000b1",
      status: "CREATED",
      state: "one-time-state",
      expiresAt: "2026-09-07T12:16:31.000000Z",
    },
  },
}

describe("starting a GitHub installation", () => {
  it("accepts the receipt the backend sends", async () => {
    const result = await startGithubInstallation(scope, KEY, respond(receipt) as never)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.responsePayload.setupIntent.state).toBe("one-time-state")
    expect(result.value.responsePayload.setupIntent.status).toBe("CREATED")
  })

  it("refuses a bare setup intent, which no route sends", async () => {
    const result = await startGithubInstallation(
      scope,
      KEY,
      respond(receipt.responsePayload.setupIntent) as never,
    )

    expect(result.ok).toBe(false)
  })

  it("refuses a receipt whose payload carries no intent", async () => {
    const result = await startGithubInstallation(
      scope,
      KEY,
      respond({ ...receipt, responsePayload: { changed: true } }) as never,
    )

    expect(result.ok).toBe(false)
  })
})
