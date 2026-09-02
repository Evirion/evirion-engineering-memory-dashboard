import { describe, expect, it, vi } from "vitest"

import { isSessionContext } from "@contracts/console"

import {
  type ConsoleTransport,
  bootstrapSession,
  buildConsoleHeaders,
  callConsoleApi,
} from "@/server/adapters/console-api"

const baseRequest = {
  method: "GET",
  path: "/v1/session/context",
  accessToken: "caller-access-token",
  correlationId: "correlation-1",
} as const

const sessionContext = {
  actorId: "00000000-0000-4000-8000-000000000101",
  organizationId: "00000000-0000-4000-8000-000000000102",
  role: "reviewer",
  capabilities: ["knowledge.read"],
}

const REQUEST_ID = "00000000-0000-4000-8000-0000000001aa"

/**
 * What `supabase/functions/console-api/index.ts` actually puts on the wire.
 *
 * The earlier fixtures sent the bare payload, which matched the generated
 * validator instead of the backend, so no test could see that the adapter
 * never unwrapped the envelope.
 */
const enveloped = (data: unknown, requestId: string = REQUEST_ID): unknown => ({
  contractVersion: "1.0",
  requestId,
  data,
})

const transportReturning = (status: number, payload: unknown): ConsoleTransport =>
  vi.fn(async () => ({ status, json: async () => payload }))

describe("what the BFF forwards", () => {
  it("forwards the caller token, correlation, idempotency key and expected versions", () => {
    const headers = buildConsoleHeaders({
      ...baseRequest,
      method: "POST",
      idempotencyKey: "key-1",
      expectedVersions: { review: 4, lifecycle: 2 },
      body: { note: "x" },
    })

    expect(headers.get("authorization")).toBe("Bearer caller-access-token")
    expect(headers.get("x-correlation-id")).toBe("correlation-1")
    expect(headers.get("idempotency-key")).toBe("key-1")
    // Optimistic versions come from the backend and travel unchanged.
    expect(headers.get("expected-review-version")).toBe("4")
    expect(headers.get("expected-lifecycle-version")).toBe("2")
  })

  it("forwards no service role, no DSN and no caller-supplied organization claim", () => {
    const headers = buildConsoleHeaders({
      ...baseRequest,
      idempotencyKey: "key-1",
      expectedVersions: { review: 1 },
    })

    const names = [...headers.keys()]
    expect(names).not.toContain("x-organization-id")
    expect(names).not.toContain("apikey")
    for (const [, value] of headers.entries()) {
      expect(value).not.toMatch(/service_role|postgres(ql)?:\/\//)
    }
  })

  it("bounds the correlation identifier", () => {
    const headers = buildConsoleHeaders({
      ...baseRequest,
      correlationId: "c".repeat(500),
    })

    expect((headers.get("x-correlation-id") ?? "").length).toBe(64)
  })

  it("sends no bootstrap proof unless one was minted", () => {
    expect(buildConsoleHeaders(baseRequest).has("x-console-bff-proof")).toBe(false)
    expect(
      buildConsoleHeaders({ ...baseRequest, bootstrapProof: "proof" }).get(
        "x-console-bff-proof",
      ),
    ).toBe("proof")
  })
})

describe("what the BFF accepts back", () => {
  it("unwraps the success envelope and returns the contract-valid projection", async () => {
    const result = await callConsoleApi(
      "https://api.evirion.test",
      baseRequest,
      isSessionContext,
      transportReturning(200, enveloped(sessionContext)),
    )

    expect(result).toEqual({
      ok: true,
      value: sessionContext,
      requestId: REQUEST_ID,
    })
  })

  it("never caches an authenticated tenant response", async () => {
    const transport = transportReturning(200, enveloped(sessionContext))

    await callConsoleApi(
      "https://api.evirion.test",
      baseRequest,
      isSessionContext,
      transport,
    )

    expect(transport).toHaveBeenCalledWith(
      "https://api.evirion.test/v1/session/context",
      expect.objectContaining({ cache: "no-store", redirect: "error" }),
    )
  })

  it("fails closed on a payload the contract does not describe", async () => {
    const result = await callConsoleApi(
      "https://api.evirion.test",
      baseRequest,
      isSessionContext,
      transportReturning(
        200,
        enveloped({ role: "sovereign", capabilities: "everything" }),
      ),
    )

    expect(result).toEqual({ ok: false, failure: { kind: "unsupported", status: 200 } })
  })

  it("rejects a success body that carries no envelope", async () => {
    // The projection itself is valid. Accepting it would mean the adapter
    // cannot tell a contract response from an arbitrary JSON document.
    const result = await callConsoleApi(
      "https://api.evirion.test",
      baseRequest,
      isSessionContext,
      transportReturning(200, sessionContext),
    )

    expect(result).toEqual({ ok: false, failure: { kind: "unsupported", status: 200 } })
  })

  it("rejects an unannounced contract version on the success path", async () => {
    // `isConsoleError` already pins "1.0". Without the same check on success,
    // a backend bump would pass silently one way and fail the other.
    const result = await callConsoleApi(
      "https://api.evirion.test",
      baseRequest,
      isSessionContext,
      transportReturning(200, {
        contractVersion: "1.1",
        requestId: REQUEST_ID,
        data: sessionContext,
      }),
    )

    expect(result).toEqual({ ok: false, failure: { kind: "unsupported", status: 200 } })
  })

  it("rejects a success envelope whose request identifier is not a UUID", async () => {
    const result = await callConsoleApi(
      "https://api.evirion.test",
      baseRequest,
      isSessionContext,
      transportReturning(200, enveloped(sessionContext, "not-a-uuid")),
    )

    expect(result).toEqual({ ok: false, failure: { kind: "unsupported", status: 200 } })
  })

  it("rejects a success envelope carrying an unexpected key", async () => {
    const result = await callConsoleApi(
      "https://api.evirion.test",
      baseRequest,
      isSessionContext,
      transportReturning(200, {
        contractVersion: "1.0",
        requestId: REQUEST_ID,
        data: sessionContext,
        debug: { sql: "select 1" },
      }),
    )

    expect(result).toEqual({ ok: false, failure: { kind: "unsupported", status: 200 } })
  })

  it("maps a contract-shaped error and forwards nothing raw", async () => {
    const error = {
      contractVersion: "1.0",
      error: { code: "CAPABILITY_REQUIRED", message: "denied", retryable: false },
      requestId: "00000000-0000-4000-8000-0000000001ff",
    }

    const result = await callConsoleApi(
      "https://api.evirion.test",
      baseRequest,
      isSessionContext,
      transportReturning(403, error),
    )

    expect(result).toEqual({
      ok: false,
      failure: { kind: "error", error, status: 403 },
    })
  })

  it("treats a non-contract error body as unsupported rather than passing it through", async () => {
    const result = await callConsoleApi(
      "https://api.evirion.test",
      baseRequest,
      isSessionContext,
      transportReturning(500, {
        message: 'relation "core.knowledge_objects" does not exist',
        hint: "check the search_path",
      }),
    )

    // A raw SQL, Supabase, GitHub, worker or provider error never reaches UI.
    expect(result).toEqual({ ok: false, failure: { kind: "unsupported", status: 500 } })
  })

  it("reports an unreachable backend without inventing an outcome", async () => {
    const result = await callConsoleApi(
      "https://api.evirion.test",
      baseRequest,
      isSessionContext,
      vi.fn(async () => {
        throw new Error("connect ECONNREFUSED")
      }),
    )

    expect(result).toEqual({ ok: false, failure: { kind: "unreachable" } })
  })

  it("treats an unparsable body as unsupported", async () => {
    const unparsable: ConsoleTransport = vi.fn(async () => ({
      status: 200,
      json: async () => {
        throw new Error("not json")
      },
    }))

    const result = await callConsoleApi(
      "https://api.evirion.test",
      baseRequest,
      isSessionContext,
      unparsable,
    )

    expect(result).toEqual({ ok: false, failure: { kind: "unsupported", status: 200 } })
  })
})

describe("the private session bootstrap", () => {
  const bootstrapRequest = {
    accessToken: "caller-access-token",
    correlationId: "correlation-1",
    idempotencyKey: "00000000-0000-4000-8000-0000000002aa",
    bootstrapProof: "proof",
  }

  it("accepts the receipt through the same envelope as every customer route", async () => {
    // The internal route is absent from the customer OpenAPI, but the backend
    // answers it with the one `succeed` responder, so it is enveloped too.
    const result = await bootstrapSession(
      "https://api.evirion.test",
      bootstrapRequest,
      transportReturning(200, enveloped({ registered: true })),
    )

    expect(result).toEqual({
      ok: true,
      value: { registered: true },
      requestId: REQUEST_ID,
    })
  })

  it("rejects a bare receipt with no envelope", async () => {
    const result = await bootstrapSession(
      "https://api.evirion.test",
      bootstrapRequest,
      transportReturning(200, { registered: true }),
    )

    expect(result).toEqual({ ok: false, failure: { kind: "unsupported", status: 200 } })
  })
})
