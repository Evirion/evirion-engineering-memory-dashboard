import { describe, expect, it, vi } from "vitest"

import type { ConsoleTransport } from "@/server/adapters/console-api"
import {
  approveRepositoryImport,
  createRepositoryImport,
  fetchRepositoryImport,
  fetchRepositoryImportFailures,
  retryRepositoryImportJob,
  setRepositoryImportState,
} from "@/server/adapters/imports"

/**
 * EEM-9/04 C04.
 *
 * Import mutations answer with `RepositoryImportReceipt`, not the entitlement
 * `CommandReceipt`, and they carry `expectedStatus` rather than
 * `expectedVersion` because `core.backfill_runs` has no version column. These
 * tests pin both, and pin that no request body can name a mode: customer
 * imports are fixed to `MISSING_ONLY` and `reextract` is operator-only.
 */

const ORGANIZATION = "00000000-0000-4000-8000-0000000000a1"
const REPOSITORY = "00000000-0000-4000-8000-0000000000b2"
const IMPORT = "00000000-0000-4000-8000-0000000000c3"
const EXTRACTION_JOB = "00000000-0000-4000-8000-0000000000d4"
const IDEMPOTENCY_KEY = "00000000-0000-4000-8000-0000000000e5"
const REQUEST_ID = "00000000-0000-4000-8000-0000000000f6"

const scope = {
  baseUrl: "https://api.evirion.test",
  organizationId: ORGANIZATION,
  accessToken: "caller-access-token",
  correlationId: "correlation-1",
} as const

const projection = {
  capabilities: {
    canApprove: true,
    canCancel: true,
    canPause: false,
    canResume: false,
  },
  cost: {
    budgetUsd: "25.000000",
    completeness: "RESERVED",
    measuredUsd: "0.000000",
    reservedUsd: "4.500000",
    unresolvedUsd: "0.000000",
  },
  counts: {
    completed: 2,
    discovered: 10,
    enqueued: 8,
    failed: 1,
    skipped: 0,
    sourceReady: 7,
  },
  createdAt: "2026-09-01T10:00:00Z",
  dispositions: { accepted: 1, quarantined: 0, rejected: 1 },
  filters: {},
  highWatermark: "2026-09-01T09:00:00Z",
  importId: IMPORT,
  missingPrerequisite: null,
  mode: "MISSING_ONLY",
  modelCallsApproved: true,
  paidAuthorizationStatus: "AUTHORIZED",
  recoveryAction: "NONE",
  repositoryId: REPOSITORY,
  status: "PROCESSING",
  terminationReasonCategory: null,
  updatedAt: "2026-09-01T11:00:00Z",
}

const receipt = {
  receiptId: "00000000-0000-4000-8000-000000000107",
  responseCode: "REPOSITORY_IMPORT_CREATED",
  responsePayload: projection,
  status: "completed",
}

const failures = {
  importId: IMPORT,
  failures: [
    {
      extractionJobId: EXTRACTION_JOB,
      itemId: "42",
      lastErrorCode: "SOURCE_FETCH_FAILED",
      pullRequestNumber: 17,
      recoveryAction: "RETRY_JOB",
      retryBlocker: null,
      retryable: true,
      status: "FAILED",
      updatedAt: "2026-09-01T11:00:00Z",
    },
  ],
}

const recordingTransport = (
  payload: unknown,
): { transport: ConsoleTransport; calls: { url: string; init: RequestInit }[] } => {
  const calls: { url: string; init: RequestInit }[] = []
  const transport: ConsoleTransport = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    return {
      status: 200,
      json: async () => ({
        contractVersion: "1.0",
        requestId: REQUEST_ID,
        data: payload,
      }),
    }
  })
  return { transport, calls }
}

const headerOf = (init: RequestInit, name: string): string | null =>
  (init.headers as Headers).get(name)

const bodyOf = (init: RequestInit): Record<string, unknown> =>
  JSON.parse(String(init.body)) as Record<string, unknown>

const organization = `https://api.evirion.test/v1/organizations/${ORGANIZATION}`

describe("import reads", () => {
  it("reads the current import for one repository", async () => {
    const { transport, calls } = recordingTransport(projection)

    const result = await fetchRepositoryImport(scope, REPOSITORY, transport)

    expect(result).toEqual({ ok: true, value: projection, requestId: REQUEST_ID })
    expect(calls[0]?.url).toBe(
      `${organization}/repositories/${REPOSITORY}/imports/current`,
    )
    expect(calls[0]?.init.method).toBe("GET")
  })

  it("lists failed work for one import", async () => {
    const { transport, calls } = recordingTransport(failures)

    const result = await fetchRepositoryImportFailures(scope, IMPORT, transport)

    expect(result).toEqual({ ok: true, value: failures, requestId: REQUEST_ID })
    expect(calls[0]?.url).toBe(`${organization}/imports/${IMPORT}/failures`)
  })

  it("fails closed on an import state the contract does not publish", async () => {
    const { transport } = recordingTransport({ ...projection, status: "RECONCILING" })

    const result = await fetchRepositoryImport(scope, REPOSITORY, transport)

    expect(result).toEqual({ ok: false, failure: { kind: "unsupported", status: 200 } })
  })

  it("fails closed on an authorization state the contract does not publish", async () => {
    const { transport } = recordingTransport({
      ...projection,
      paidAuthorizationStatus: "AWAITING_SOMETHING_NEW",
    })

    const result = await fetchRepositoryImport(scope, REPOSITORY, transport)

    expect(result).toEqual({ ok: false, failure: { kind: "unsupported", status: 200 } })
  })
})

describe("import commands", () => {
  it("prepares a bounded window and never names a mode", async () => {
    const { transport, calls } = recordingTransport(receipt)

    await createRepositoryImport(
      scope,
      {
        repositoryId: REPOSITORY,
        idempotencyKey: IDEMPOTENCY_KEY,
        filters: {
          mergedFrom: "2025-09-01T00:00:00Z",
          mergedTo: "2026-09-01T00:00:00Z",
        },
      },
      transport,
    )

    const init = calls[0]?.init as RequestInit
    expect(calls[0]?.url).toBe(`${organization}/repositories/${REPOSITORY}/imports`)
    expect(bodyOf(init)).toEqual({
      confirmationAccepted: true,
      filters: {
        mergedFrom: "2025-09-01T00:00:00Z",
        mergedTo: "2026-09-01T00:00:00Z",
      },
    })
    // `reextract` is operator-only, and the contract's create body admits no
    // mode field at all, so there is nothing here a caller could substitute.
    expect(bodyOf(init)).not.toHaveProperty("mode")
    expect(String(init.body)).not.toContain("reextract")
  })

  it("sends an empty filter object for the entire history", async () => {
    const { transport, calls } = recordingTransport(receipt)

    await createRepositoryImport(
      scope,
      { repositoryId: REPOSITORY, idempotencyKey: IDEMPOTENCY_KEY, filters: {} },
      transport,
    )

    // `filters` is required, so omitting both bounds is an empty object rather
    // than an absent key.
    expect(bodyOf(calls[0]?.init as RequestInit)).toEqual({
      confirmationAccepted: true,
      filters: {},
    })
  })

  it("approves with the observed status, never with a version", async () => {
    const { transport, calls } = recordingTransport({
      ...receipt,
      responseCode: "REPOSITORY_IMPORT_APPROVED",
    })

    await approveRepositoryImport(
      scope,
      {
        importId: IMPORT,
        idempotencyKey: IDEMPOTENCY_KEY,
        expectedStatus: "AWAITING_APPROVAL",
        costBudgetUsd: "25.000000",
      },
      transport,
    )

    const init = calls[0]?.init as RequestInit
    expect(calls[0]?.url).toBe(`${organization}/imports/${IMPORT}/approve`)
    expect(bodyOf(init)).toEqual({
      expectedStatus: "AWAITING_APPROVAL",
      costBudgetUsd: "25.000000",
      confirmationAccepted: true,
    })
    expect(bodyOf(init)).not.toHaveProperty("expectedVersion")
    expect(headerOf(init, "idempotency-key")).toBe(IDEMPOTENCY_KEY)
  })

  it.each(["PAUSED", "RESUMED", "CANCELLED"] as const)(
    "drives %s through the one state operation",
    async (state) => {
      const { transport, calls } = recordingTransport({
        ...receipt,
        responseCode: "REPOSITORY_IMPORT_PAUSED",
      })

      await setRepositoryImportState(
        scope,
        {
          importId: IMPORT,
          idempotencyKey: IDEMPOTENCY_KEY,
          state,
          expectedStatus: "PROCESSING",
        },
        transport,
      )

      const init = calls[0]?.init as RequestInit
      expect(init.method).toBe("PATCH")
      expect(calls[0]?.url).toBe(`${organization}/imports/${IMPORT}/state`)
      expect(bodyOf(init)).toEqual({
        state,
        expectedStatus: "PROCESSING",
        confirmationAccepted: true,
      })
    },
  )

  it("retries one declared-retryable job with no body at all", async () => {
    const { transport, calls } = recordingTransport({
      ...receipt,
      responseCode: "REPOSITORY_IMPORT_JOB_RETRIED",
    })

    await retryRepositoryImportJob(
      scope,
      {
        importId: IMPORT,
        idempotencyKey: IDEMPOTENCY_KEY,
        extractionJobId: EXTRACTION_JOB,
      },
      transport,
    )

    const init = calls[0]?.init as RequestInit
    expect(calls[0]?.url).toBe(
      `${organization}/imports/${IMPORT}/failures/${EXTRACTION_JOB}/retry`,
    )
    expect(init.body).toBeUndefined()
    expect(headerOf(init, "idempotency-key")).toBe(IDEMPOTENCY_KEY)
  })

  it("refuses an entitlement receipt in answer to an import mutation", async () => {
    // The reason the generator had to learn this type. `CommandReceipt` fixes
    // its response codes to the four entitlement ones, so accepting it here
    // would mean the Console could not tell the two receipts apart.
    const { transport } = recordingTransport({
      ...receipt,
      responseCode: "REPOSITORY_ENTITLEMENT_ACTIVE",
    })

    const result = await createRepositoryImport(
      scope,
      { repositoryId: REPOSITORY, idempotencyKey: IDEMPOTENCY_KEY, filters: {} },
      transport,
    )

    expect(result).toEqual({ ok: false, failure: { kind: "unsupported", status: 200 } })
  })

  it("forwards no service role, no DSN and no caller-supplied organization claim", async () => {
    const { transport, calls } = recordingTransport(receipt)

    await createRepositoryImport(
      scope,
      { repositoryId: REPOSITORY, idempotencyKey: IDEMPOTENCY_KEY, filters: {} },
      transport,
    )

    const headers = calls[0]?.init.headers as Headers
    expect([...headers.keys()]).not.toContain("x-organization-id")
    expect([...headers.keys()]).not.toContain("apikey")
    for (const [, value] of headers.entries()) {
      expect(value).not.toMatch(/service_role|postgres(ql)?:\/\//)
    }
  })
})

describe("import path identity", () => {
  it("refuses to build a path from an identifier that could traverse", () => {
    const { transport, calls } = recordingTransport(projection)

    expect(() =>
      fetchRepositoryImportFailures(
        scope,
        "../../../internal/console/v1/session",
        transport,
      ),
    ).toThrow(/identifier/)
    expect(() =>
      retryRepositoryImportJob(
        scope,
        { importId: IMPORT, idempotencyKey: IDEMPOTENCY_KEY, extractionJobId: ".." },
        transport,
      ),
    ).toThrow(/identifier/)
    expect(calls).toHaveLength(0)
  })

  it("refuses an idempotency key that is not the canonical UUID", () => {
    const { transport, calls } = recordingTransport(receipt)

    expect(() =>
      createRepositoryImport(
        scope,
        { repositoryId: REPOSITORY, idempotencyKey: "not-a-uuid", filters: {} },
        transport,
      ),
    ).toThrow(/idempotency key/)
    expect(calls).toHaveLength(0)
  })
})
