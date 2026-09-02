import { describe, expect, it, vi } from "vitest"

import type { ConsoleTransport } from "@/server/adapters/console-api"
import {
  activateRepositoryEntitlement,
  disableRepositoryEntitlement,
  fetchGithubInstallation,
  fetchGithubSyncRun,
  fetchRepository,
  fetchRepositoryPage,
  isUuid,
  requestRepositoryEntitlementChange,
  startGithubInstallation,
  startGithubRepositorySync,
  updateRepositoryProcessingPolicy,
} from "@/server/adapters/repositories"

/**
 * EEM-9/03 C03-1.
 *
 * The contract declares exactly two headers, `Idempotency-Key` and
 * `X-Correlation-ID`, and carries `expectedVersion` in the request body. The
 * adapter inherited an `expected-<name>-version` header mechanism that no
 * operation reads, so a version sent that way would be silently dropped and the
 * optimistic check would never run. These tests pin the body form.
 */

const ORGANIZATION = "00000000-0000-4000-8000-0000000000a1"
const REPOSITORY = "00000000-0000-4000-8000-0000000000b2"
const SYNC_RUN = "00000000-0000-4000-8000-0000000000c3"
const IDEMPOTENCY_KEY = "00000000-0000-4000-8000-0000000000d4"
const REQUEST_ID = "00000000-0000-4000-8000-0000000000e5"

const scope = {
  baseUrl: "https://api.evirion.test",
  organizationId: ORGANIZATION,
  accessToken: "caller-access-token",
  correlationId: "correlation-1",
} as const

const repository = {
  id: REPOSITORY,
  nameWithOwner: "acme/console",
  archived: false,
  accessible: true,
  productState: "ACTIVE_SOURCE_ONLY",
  entitlement: { generation: 1, source: "DESIGN_PARTNER", state: "ACTIVE", version: 3 },
  policy: { mode: "SOURCE_ONLY", version: 2 },
  effectiveConsent: null,
  changeRequest: null,
}

const repositoryPage = {
  items: [repository],
  page: { nextCursor: null },
  summary: {
    accessibleRepositories: 4,
    activeRepositories: 1,
    limit: {
      maxActiveRepositories: 1,
      mode: "FIXED",
      replacementMode: "OPERATOR_ONLY",
    },
  },
}

const receipt = {
  receiptId: "00000000-0000-4000-8000-0000000000f6",
  responseCode: "REPOSITORY_ENTITLEMENT_ACTIVE",
  responsePayload: { repositoryId: REPOSITORY },
  status: "completed",
}

const installation = {
  installation: {
    accountLogin: "acme",
    connectedAt: "2026-09-01T10:00:00Z",
    id: "00000000-0000-4000-8000-000000000101",
    status: "ACTIVE",
  },
  latestSyncRun: null,
  organizationId: ORGANIZATION,
  repositorySummary: { accessibleRepositories: 4, inaccessibleRepositories: 0 },
  setupIntent: null,
}

const syncRun = {
  attemptCount: 1,
  generation: 7,
  id: SYNC_RUN,
  progress: {
    pagesApplied: 2,
    repositoriesMarkedInaccessible: 0,
    repositoriesSeen: 4,
  },
  requestedAt: "2026-09-01T10:00:00Z",
  status: "COMPLETED",
  version: 3,
}

const setupIntent = {
  expiresAt: "2026-09-01T10:10:00Z",
  id: "00000000-0000-4000-8000-000000000202",
  state: "a".repeat(64),
  status: "CREATED",
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

describe("repository reads", () => {
  it("lists a tenant page with the contract cursor parameters", async () => {
    const { transport, calls } = recordingTransport(repositoryPage)

    const result = await fetchRepositoryPage(
      scope,
      { pageSize: 25, after: REPOSITORY },
      transport,
    )

    expect(result.ok).toBe(true)
    expect(calls[0]?.url).toBe(
      `https://api.evirion.test/v1/organizations/${ORGANIZATION}` +
        `/repositories?pageSize=25&after=${REPOSITORY}`,
    )
    expect(calls[0]?.init.method).toBe("GET")
  })

  it("omits the cursor entirely on a first page rather than sending an empty one", async () => {
    const { transport, calls } = recordingTransport(repositoryPage)

    await fetchRepositoryPage(scope, {}, transport)

    expect(calls[0]?.url).toBe(
      `https://api.evirion.test/v1/organizations/${ORGANIZATION}/repositories`,
    )
  })

  it("reads one repository and returns the validated projection", async () => {
    const { transport, calls } = recordingTransport(repository)

    const result = await fetchRepository(scope, REPOSITORY, transport)

    expect(result).toEqual({ ok: true, value: repository, requestId: REQUEST_ID })
    expect(calls[0]?.url).toBe(
      `https://api.evirion.test/v1/organizations/${ORGANIZATION}/repositories/${REPOSITORY}`,
    )
  })

  it("fails closed when the backend describes a product state the contract does not publish", async () => {
    const { transport } = recordingTransport({
      ...repository,
      productState: "ACTIVE_SOMETHING_NEW",
    })

    const result = await fetchRepository(scope, REPOSITORY, transport)

    expect(result).toEqual({ ok: false, failure: { kind: "unsupported", status: 200 } })
  })

  it("reads GitHub installation status and a synchronization run", async () => {
    const installationCall = recordingTransport(installation)
    const syncCall = recordingTransport(syncRun)

    await fetchGithubInstallation(scope, installationCall.transport)
    await fetchGithubSyncRun(scope, SYNC_RUN, syncCall.transport)

    expect(installationCall.calls[0]?.url).toBe(
      `https://api.evirion.test/v1/organizations/${ORGANIZATION}/github/installation`,
    )
    expect(syncCall.calls[0]?.url).toBe(
      `https://api.evirion.test/v1/organizations/${ORGANIZATION}/github/sync-runs/${SYNC_RUN}`,
    )
  })
})

describe("repository commands", () => {
  it("sends the expected version in the body, never as a header", async () => {
    const { transport, calls } = recordingTransport(receipt)

    await activateRepositoryEntitlement(
      scope,
      { repositoryId: REPOSITORY, expectedVersion: 3, idempotencyKey: IDEMPOTENCY_KEY },
      transport,
    )

    const init = calls[0]?.init as RequestInit
    expect(bodyOf(init)).toEqual({ expectedVersion: 3, confirmationAccepted: true })
    // The contract declares no expected-version header. One sent that way is
    // dropped, and the optimistic check silently never happens.
    expect(headerOf(init, "expected-entitlement-version")).toBeNull()
    expect([...(init.headers as Headers).keys()]).not.toContain("expected-version")
  })

  it("carries a null expected version for a first activation", async () => {
    const { transport, calls } = recordingTransport(receipt)

    await activateRepositoryEntitlement(
      scope,
      {
        repositoryId: REPOSITORY,
        expectedVersion: null,
        idempotencyKey: IDEMPOTENCY_KEY,
      },
      transport,
    )

    expect(bodyOf(calls[0]?.init as RequestInit)).toEqual({
      expectedVersion: null,
      confirmationAccepted: true,
    })
  })

  it("puts the canonical idempotency key in the header and never in the body", async () => {
    const { transport, calls } = recordingTransport(receipt)

    await disableRepositoryEntitlement(
      scope,
      { repositoryId: REPOSITORY, expectedVersion: 3, idempotencyKey: IDEMPOTENCY_KEY },
      transport,
    )

    const init = calls[0]?.init as RequestInit
    expect(headerOf(init, "idempotency-key")).toBe(IDEMPOTENCY_KEY)
    expect(bodyOf(init)).not.toHaveProperty("idempotencyKey")
    expect(calls[0]?.url).toBe(
      `https://api.evirion.test/v1/organizations/${ORGANIZATION}` +
        `/repositories/${REPOSITORY}/disable`,
    )
  })

  it("omits an absent disable reason rather than sending an empty string", async () => {
    const { transport, calls } = recordingTransport(receipt)

    await disableRepositoryEntitlement(
      scope,
      {
        repositoryId: REPOSITORY,
        expectedVersion: 3,
        idempotencyKey: IDEMPOTENCY_KEY,
        reason: "   ",
      },
      transport,
    )

    expect(bodyOf(calls[0]?.init as RequestInit)).toEqual({ expectedVersion: 3 })
  })

  it("requests an operator-owned change with the target repository", async () => {
    const { transport, calls } = recordingTransport({
      ...receipt,
      responseCode: "REPOSITORY_ENTITLEMENT_CHANGE_REQUESTED",
    })

    await requestRepositoryEntitlementChange(
      scope,
      {
        repositoryId: REPOSITORY,
        requestedRepositoryId: SYNC_RUN,
        expectedVersion: 3,
        idempotencyKey: IDEMPOTENCY_KEY,
        reason: "team moved",
      },
      transport,
    )

    expect(bodyOf(calls[0]?.init as RequestInit)).toEqual({
      expectedVersion: 3,
      requestedRepositoryId: SYNC_RUN,
      reason: "team moved",
    })
  })

  it("patches the processing policy with an explicit null consent below AUTO_EXTRACT", async () => {
    const { transport, calls } = recordingTransport({
      ...receipt,
      responseCode: "REPOSITORY_POLICY_UPDATED",
    })

    await updateRepositoryProcessingPolicy(
      scope,
      {
        repositoryId: REPOSITORY,
        expectedVersion: 2,
        mode: "SOURCE_ONLY",
        consent: null,
        idempotencyKey: IDEMPOTENCY_KEY,
      },
      transport,
    )

    const init = calls[0]?.init as RequestInit
    expect(init.method).toBe("PATCH")
    // `consent` is required, so an omitted key is a contract violation rather
    // than a default.
    expect(bodyOf(init)).toEqual({
      expectedVersion: 2,
      mode: "SOURCE_ONLY",
      consent: null,
    })
  })

  it("carries the complete consent when AUTO_EXTRACT is selected", async () => {
    const { transport, calls } = recordingTransport({
      ...receipt,
      responseCode: "REPOSITORY_POLICY_UPDATED",
    })

    await updateRepositoryProcessingPolicy(
      scope,
      {
        repositoryId: REPOSITORY,
        expectedVersion: 2,
        mode: "AUTO_EXTRACT",
        consent: {
          scope: "LIVE_REPOSITORY",
          allowedModelProfiles: ["default"],
          callCeiling: 100,
          budgetCeilingUsd: "25.000000",
          retryPolicy: "NO_RETRY",
          expiresAt: "2026-12-01T00:00:00Z",
        },
        idempotencyKey: IDEMPOTENCY_KEY,
      },
      transport,
    )

    expect(bodyOf(calls[0]?.init as RequestInit)).toEqual({
      expectedVersion: 2,
      mode: "AUTO_EXTRACT",
      consent: {
        scope: "LIVE_REPOSITORY",
        allowedModelProfiles: ["default"],
        callCeiling: 100,
        budgetCeilingUsd: "25.000000",
        retryPolicy: "NO_RETRY",
        expiresAt: "2026-12-01T00:00:00Z",
      },
    })
  })

  it("starts a setup intent and a synchronization run with an empty contract body", async () => {
    const intentCall = recordingTransport(setupIntent)
    const syncCall = recordingTransport(syncRun)

    await startGithubInstallation(scope, IDEMPOTENCY_KEY, intentCall.transport)
    await startGithubRepositorySync(scope, IDEMPOTENCY_KEY, syncCall.transport)

    expect(bodyOf(intentCall.calls[0]?.init as RequestInit)).toEqual({})
    expect(bodyOf(syncCall.calls[0]?.init as RequestInit)).toEqual({})
    expect(intentCall.calls[0]?.url).toBe(
      `https://api.evirion.test/v1/organizations/${ORGANIZATION}` +
        `/github/installation-intents`,
    )
    expect(syncCall.calls[0]?.url).toBe(
      `https://api.evirion.test/v1/organizations/${ORGANIZATION}/github/sync-runs`,
    )
  })

  it("forwards no service role, no DSN and no caller-supplied organization claim", async () => {
    const { transport, calls } = recordingTransport(receipt)

    await activateRepositoryEntitlement(
      scope,
      {
        repositoryId: REPOSITORY,
        expectedVersion: null,
        idempotencyKey: IDEMPOTENCY_KEY,
      },
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

describe("path identity", () => {
  it("accepts only a UUID as a resource identifier", () => {
    expect(isUuid(REPOSITORY)).toBe(true)
    expect(isUuid("../../v1/organizations/other/repositories")).toBe(false)
    expect(isUuid("")).toBe(false)
    expect(isUuid("00000000-0000-4000-8000-0000000000b2 ")).toBe(false)
  })

  it("refuses to build a path from an identifier that could traverse", () => {
    const { transport, calls } = recordingTransport(repository)

    // Synchronously, at the call site: `encodeURIComponent` leaves `..`
    // intact, so a traversal must be refused before a URL is ever resolved.
    expect(() =>
      fetchRepository(scope, "../../../internal/console/v1/session", transport),
    ).toThrow(/identifier/)
    expect(calls).toHaveLength(0)
  })
})
