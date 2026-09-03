// A contract-shaped Console API for the local browser gate.
//
// This is a test double and an evaluation artifact. It is never a runtime
// input, it holds no credential, and it reaches no network. It exists because
// CONSOLE_API_BASE_URL otherwise points at a host that does not resolve, so
// every read fails `unreachable` and no journey, conflict or tenant-boundary
// assertion can be made at all.
//
// It answers exactly as the backend does: one success responder emitting
// {contractVersion, requestId, data}, published stable error codes with the
// retryability the backend declares, tenant-obscured refusal of a foreign
// resource, durable idempotency keyed by actor/organization/operation/target,
// and optimistic version conflicts carrying the current version.
import { createHash, randomUUID } from "node:crypto"
import { createServer } from "node:https"

import { readMaterial } from "../local-tls/generate-certificate.mjs"
import {
  CAPABILITIES,
  IMPORT_RUNS,
  MODEL_PROFILES,
  OVERVIEWS,
  PRINCIPALS,
  SCENARIOS,
} from "./fixtures.mjs"

const PORT = Number(process.env.CONSOLE_STUB_PORT ?? "3444")
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** code -> [http status, retryable]. Retryability is the backend's to declare. */
const ERRORS = {
  AUTHENTICATION_REQUIRED: [401, false],
  ORGANIZATION_MEMBERSHIP_REQUIRED: [403, false],
  CAPABILITY_REQUIRED: [403, false],
  RESOURCE_NOT_FOUND: [404, false],
  IDEMPOTENCY_KEY_REUSED: [409, false],
  VERSION_CONFLICT: [409, false],
  ORGANIZATION_LIMIT_NOT_PROVISIONED: [409, false],
  REPOSITORY_NOT_ENTITLED: [409, false],
  REPOSITORY_LIMIT_REACHED: [409, false],
  REPOSITORY_REPLACEMENT_REQUIRES_OPERATOR: [409, false],
  REPOSITORY_ACCESS_CHANGED: [409, false],
  ENTITLEMENT_GENERATION_STALE: [409, false],
  GITHUB_SYNC_INCOMPLETE: [409, true],
  REQUEST_INVALID: [400, false],
  DEPENDENCY_UNAVAILABLE: [503, true],
  INTERNAL_ERROR: [500, false],
  REPOSITORY_IMPORT_NOT_FOUND: [404, false],
  REPOSITORY_IMPORT_ALREADY_ACTIVE: [409, false],
  REPOSITORY_IMPORT_NOT_APPROVABLE: [409, false],
  REPOSITORY_IMPORT_NOT_PAUSABLE: [409, false],
  REPOSITORY_IMPORT_NOT_RESUMABLE: [409, false],
  REPOSITORY_IMPORT_NOT_CANCELLABLE: [409, false],
  REPOSITORY_IMPORT_JOB_NOT_RETRYABLE: [409, false],
  REPOSITORY_IMPORT_FILTERS_INVALID: [422, false],
  PAID_OPERATION_NOT_AUTHORIZED: [403, false],
}

const MESSAGES = {
  RESOURCE_NOT_FOUND: "The requested resource is not available.",
  CAPABILITY_REQUIRED: "The required capability is unavailable.",
  VERSION_CONFLICT: "The resource changed before this request was applied.",
}

/**
 * State is per isolation identifier, not global.
 *
 * The browser gate runs fully parallel against one double, so a single mutable
 * scenario would let one test change what every other test sees. The caller
 * token carries the identifier, and the Console forwards that token unchanged,
 * which makes the isolation boundary the same one the tenant check uses.
 */
const states = new Map()

function load(name) {
  const build = SCENARIOS[name]
  if (!build) throw new Error(`unknown scenario: ${name}`)
  return {
    name,
    // A scenario that names no import has none, which is the empty state and
    // not a missing key the lookups would have to guard against.
    imports: {},
    importFailures: {},
    ...build(),
    // Idempotency is durable for the life of the scenario, exactly as a stored
    // command receipt is: same key and same request returns the same receipt.
    receipts: new Map(),
    syncRuns: new Map(),
    setupIntents: new Map(),
  }
}

const stateFor = (isolation) => {
  const existing = states.get(isolation)
  if (existing) return existing
  const fresh = load("default")
  states.set(isolation, fresh)
  return fresh
}

const digest = (value) =>
  createHash("sha256")
    .update(JSON.stringify(value ?? null))
    .digest("hex")

const send = (response, status, payload) => {
  const body = JSON.stringify(payload)
  response.writeHead(status, {
    "content-type": "application/json",
    "cache-control": "no-store",
    "x-request-id": payload.requestId,
  })
  response.end(body)
}

const succeed = (response, data, status = 200) =>
  send(response, status, { contractVersion: "1.0", requestId: randomUUID(), data })

const fail = (response, code, extra = {}) => {
  const [status, retryable] = ERRORS[code] ?? [500, false]
  send(response, status, {
    contractVersion: "1.0",
    requestId: randomUUID(),
    error: {
      code,
      message: MESSAGES[code] ?? "The request was refused.",
      retryable,
      ...extra,
    },
  })
}

/**
 * The bearer token is `<principal>|<isolation>`. The principal decides the
 * tenant, exactly as a real token would; the isolation identifier decides which
 * scenario state this caller sees.
 */
const principalOf = (request) => {
  const authorization = request.headers["authorization"] ?? ""
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : ""
  const separator = token.indexOf("|")
  const name = separator === -1 ? token : token.slice(0, separator)
  const isolation = separator === -1 ? "shared" : token.slice(separator + 1)
  const principal = PRINCIPALS[name]
  return principal ? { ...principal, isolation } : undefined
}

const readBody = async (request) => {
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  if (chunks.length === 0) return undefined
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"))
  } catch {
    return Symbol.for("unparsable")
  }
}

/**
 * One receipt per (actor, organization, operation, target, key).
 *
 * Same key and same request returns the stored receipt, which is a success and
 * not an error. Same key with a different request is a conflict with no effect.
 */
const replay = (state, principal, organizationId, operation, target, key, request) => {
  const slot = [principal.actorId, organizationId, operation, target, key].join("|")
  const stored = state.receipts.get(slot)
  if (!stored) return { kind: "fresh", slot }
  return stored.requestDigest === digest(request)
    ? { kind: "replayed", receipt: stored.receipt }
    : { kind: "reused" }
}

const remember = (state, slot, request, receipt) => {
  state.receipts.set(slot, { requestDigest: digest(request), receipt })
  return receipt
}

const receiptFor = (responseCode, responsePayload) => ({
  receiptId: randomUUID(),
  responseCode,
  responsePayload,
  status: "completed",
})

const activeCount = (state) =>
  state.repositories.filter((entry) => entry.entitlement?.state === "ACTIVE").length

const entitlementPayload = (repository) => ({
  changed: true,
  entitlement: repository.entitlement,
  policy: repository.policy ?? { mode: "OFF", version: 1 },
  repositoryId: repository.id,
})

/** A foreign resource is refused without disclosing that it exists. */
const findRepository = (state, principal, repositoryId) => {
  if (principal.organizationId !== state.installation.organizationId) return undefined
  return state.repositories.find((entry) => entry.id === repositoryId)
}

const requireCapability = (principal, capability) =>
  CAPABILITIES[principal.role]?.includes(capability) ?? false

const page = (state, after) => {
  const size = state.pageSize
  const start = after ? state.repositories.findIndex((e) => e.id === after) + 1 : 0
  const items = state.repositories.slice(start, start + size)
  const nextIndex = start + size
  return {
    items,
    page: {
      nextCursor:
        nextIndex < state.repositories.length
          ? (state.repositories[nextIndex - 1]?.id ?? null)
          : null,
    },
    summary: {
      accessibleRepositories: state.repositories.filter((e) => e.accessible).length,
      activeRepositories: activeCount(state),
      limit: state.limit,
    },
  }
}

const handle = async (request, response, url) => {
  // Control surface. It exists only in this double and never in the product.
  if (url.pathname === "/__stub/ready" && request.method === "GET") {
    return succeed(response, { ready: true })
  }
  if (url.pathname === "/__stub/scenario" && request.method === "POST") {
    const body = await readBody(request)
    const isolation = body?.isolation ?? "shared"
    states.set(isolation, load(body?.scenario ?? "default"))
    return succeed(response, { scenario: body?.scenario ?? "default", isolation })
  }

  const principal = principalOf(request)
  if (!principal) return fail(response, "AUTHENTICATION_REQUIRED")

  const state = stateFor(principal.isolation)

  if (url.pathname === "/v1/session/context" && request.method === "GET") {
    return succeed(response, {
      actorId: principal.actorId,
      capabilities: CAPABILITIES[principal.role],
      organizationId: principal.organizationId,
      role: principal.role,
      session: { id: principal.sessionId, status: "ACTIVE", version: 1 },
    })
  }

  const organizationMatch = /^\/v1\/organizations\/([^/]+)(\/.*)?$/.exec(url.pathname)
  if (!organizationMatch) return fail(response, "RESOURCE_NOT_FOUND")

  const organizationId = organizationMatch[1]
  const rest = organizationMatch[2] ?? ""

  // Explicit organization scope, checked against live membership rather than
  // anything the caller supplied.
  if (organizationId !== principal.organizationId) {
    return fail(response, "ORGANIZATION_MEMBERSHIP_REQUIRED")
  }
  if (principal.organizationId !== state.installation.organizationId) {
    return fail(response, "RESOURCE_NOT_FOUND")
  }

  if (rest === "/github/installation" && request.method === "GET") {
    if (!requireCapability(principal, "organization.github.manage")) {
      return fail(response, "CAPABILITY_REQUIRED")
    }
    return succeed(response, state.installation)
  }

  if (rest === "/github/installation-intents" && request.method === "POST") {
    return withCommand(request, response, state, principal, organizationId, {
      operation: "github.installation-intent",
      target: organizationId,
      capability: "organization.github.manage",
      apply: () => {
        const intent = {
          expiresAt: new Date(Date.now() + 600_000)
            .toISOString()
            .replace(/\.\d+Z$/, "Z"),
          failureCode: null,
          id: randomUUID(),
          resolvedAt: null,
          state: createHash("sha256").update(randomUUID()).digest("hex"),
          status: "CREATED",
        }
        state.setupIntents.set(intent.id, intent)
        return { data: intent }
      },
    })
  }

  if (rest === "/github/sync-runs" && request.method === "POST") {
    return withCommand(request, response, state, principal, organizationId, {
      operation: "github.sync",
      target: organizationId,
      capability: "organization.github.manage",
      apply: () => {
        const run = {
          attemptCount: 1,
          failureCode: null,
          generation: (state.installation.latestSyncRun?.generation ?? 0) + 1,
          id: randomUUID(),
          progress: {
            pagesApplied: 0,
            repositoriesMarkedInaccessible: 0,
            repositoriesSeen: 0,
          },
          requestedAt: new Date().toISOString().replace(/\.\d+Z$/, "Z"),
          resolvedAt: null,
          startedAt: null,
          status: "QUEUED",
          version: 1,
        }
        state.syncRuns.set(run.id, run)
        state.installation = { ...state.installation, latestSyncRun: run }
        return { data: run }
      },
    })
  }

  const syncRunMatch = /^\/github\/sync-runs\/([^/]+)$/.exec(rest)
  if (syncRunMatch && request.method === "GET") {
    const run =
      state.syncRuns.get(syncRunMatch[1]) ??
      (state.installation.latestSyncRun?.id === syncRunMatch[1]
        ? state.installation.latestSyncRun
        : undefined)
    return run ? succeed(response, run) : fail(response, "RESOURCE_NOT_FOUND")
  }

  if (rest === "/repositories" && request.method === "GET") {
    if (state.listError) return fail(response, state.listError)
    return succeed(response, page(state, url.searchParams.get("after") ?? undefined))
  }

  if (rest === "/model-profiles" && request.method === "GET") {
    if (state.modelProfilesError) return fail(response, state.modelProfilesError)
    // The contract gates the catalogue on the capability that writes the
    // consent envelope, so a viewer is refused here exactly as they would be
    // on the write itself.
    if (!requireCapability(principal, "repository.policy.manage")) {
      return fail(response, "CAPABILITY_REQUIRED")
    }
    return succeed(response, state.modelProfiles ?? MODEL_PROFILES())
  }

  const imported = await handleImport(request, response, {
    state,
    principal,
    organizationId,
    rest,
  })
  if (imported) return undefined

  const repositoryMatch = /^\/repositories\/([^/]+)(\/[a-z-]+)?$/.exec(rest)
  if (!repositoryMatch) return fail(response, "RESOURCE_NOT_FOUND")

  const repositoryId = repositoryMatch[1]
  const action = repositoryMatch[2] ?? ""
  if (!UUID.test(repositoryId)) return fail(response, "REQUEST_INVALID")

  const repository = findRepository(state, principal, repositoryId)

  if (action === "" && request.method === "GET") {
    return repository
      ? succeed(response, repository)
      : fail(response, "RESOURCE_NOT_FOUND")
  }

  if (!repository) return fail(response, "RESOURCE_NOT_FOUND")

  if (action === "/overview" && request.method === "GET") {
    if (state.overviewError) return fail(response, state.overviewError)
    // Every repository has counters unless a scenario says otherwise, so the
    // twenty-one scenarios that predate them do not each need a line.
    const overview = (state.overviews ?? OVERVIEWS())[repositoryId]
    return overview ? succeed(response, overview) : fail(response, "RESOURCE_NOT_FOUND")
  }

  if (action === "/activate" && request.method === "POST") {
    return withCommand(request, response, state, principal, organizationId, {
      operation: "repository.activate",
      target: repositoryId,
      capability: "repository.entitlements.manage",
      apply: (body) => {
        if (body?.confirmationAccepted !== true) return { error: "REQUEST_INVALID" }
        if (!repository.accessible) return { error: "REPOSITORY_ACCESS_CHANGED" }
        if (state.limit === null) return { error: "ORGANIZATION_LIMIT_NOT_PROVISIONED" }

        const current = repository.entitlement?.version ?? null
        if ((body?.expectedVersion ?? null) !== current) {
          return { error: "VERSION_CONFLICT", currentVersion: current ?? undefined }
        }
        if (
          repository.entitlement?.state !== "ACTIVE" &&
          state.limit.mode === "FIXED" &&
          activeCount(state) >= state.limit.maxActiveRepositories
        ) {
          return { error: "REPOSITORY_LIMIT_REACHED" }
        }

        repository.entitlement = {
          generation: (repository.entitlement?.generation ?? 0) + 1,
          source: repository.entitlement?.source ?? "DESIGN_PARTNER",
          state: "ACTIVE",
          version: (current ?? 0) + 1,
        }
        repository.policy ??= { mode: "OFF", version: 1 }
        repository.productState = productStateOf(repository)
        return {
          code: "REPOSITORY_ENTITLEMENT_ACTIVE",
          payload: entitlementPayload(repository),
        }
      },
    })
  }

  if (action === "/disable" && request.method === "POST") {
    return withCommand(request, response, state, principal, organizationId, {
      operation: "repository.disable",
      target: repositoryId,
      capability: "repository.entitlements.manage",
      apply: (body) => {
        if (state.limit?.replacementMode === "OPERATOR_ONLY") {
          return { error: "REPOSITORY_REPLACEMENT_REQUIRES_OPERATOR" }
        }
        if (!repository.entitlement) return { error: "REPOSITORY_NOT_ENTITLED" }
        if (body?.expectedVersion !== repository.entitlement.version) {
          return {
            error: "VERSION_CONFLICT",
            currentVersion: repository.entitlement.version,
          }
        }

        repository.entitlement = {
          ...repository.entitlement,
          generation: repository.entitlement.generation + 1,
          state: "DISABLED",
          version: repository.entitlement.version + 1,
        }
        repository.productState = productStateOf(repository)
        return {
          code: "REPOSITORY_ENTITLEMENT_DISABLED",
          payload: entitlementPayload(repository),
        }
      },
    })
  }

  if (action === "/request-change" && request.method === "POST") {
    return withCommand(request, response, state, principal, organizationId, {
      operation: "repository.request-change",
      target: repositoryId,
      capability: "repository.entitlements.manage",
      apply: (body) => {
        if (!repository.entitlement) return { error: "REPOSITORY_NOT_ENTITLED" }
        if (body?.expectedVersion !== repository.entitlement.version) {
          return {
            error: "VERSION_CONFLICT",
            currentVersion: repository.entitlement.version,
          }
        }
        if (!UUID.test(String(body?.requestedRepositoryId ?? ""))) {
          return { error: "REQUEST_INVALID" }
        }

        repository.changeRequest = {
          id: randomUUID(),
          requestedRepositoryId: body.requestedRepositoryId,
          state: "REQUESTED",
          version: 1,
        }
        repository.productState = productStateOf(repository)
        return {
          code: "REPOSITORY_ENTITLEMENT_CHANGE_REQUESTED",
          payload: entitlementPayload(repository),
        }
      },
    })
  }

  if (action === "/processing-policy" && request.method === "PATCH") {
    return withCommand(request, response, state, principal, organizationId, {
      operation: "repository.policy",
      target: repositoryId,
      capability: "repository.policy.manage",
      apply: (body) => {
        if (repository.entitlement?.state !== "ACTIVE") {
          return { error: "REPOSITORY_NOT_ENTITLED" }
        }
        const current = repository.policy?.version ?? 1
        if (body?.expectedVersion !== current) {
          return { error: "VERSION_CONFLICT", currentVersion: current }
        }
        // AUTO_EXTRACT without a complete consent stays fail-closed.
        if (body?.mode === "AUTO_EXTRACT" && !body?.consent) {
          return { error: "REQUEST_INVALID" }
        }

        repository.policy = { mode: body.mode, version: current + 1 }
        repository.effectiveConsent = body.mode === "AUTO_EXTRACT" ? body.consent : null
        repository.productState = productStateOf(repository)
        return {
          code: "REPOSITORY_POLICY_UPDATED",
          payload: { mode: repository.policy.mode, version: repository.policy.version },
        }
      },
    })
  }

  return fail(response, "RESOURCE_NOT_FOUND")
}

const IMPORT_BUDGET = /^(0|[1-9][0-9]{0,11})\.[0-9]{6}$/

/**
 * The capability an import mutation needs.
 *
 * The contract publishes no capability name for the import operations and no
 * closed capability enum, so this is the double's approximation rather than a
 * contract fact: it is the published capability nearest to consenting to paid
 * processing for one repository, and it separates an owner from a viewer,
 * which is the boundary these tests exist to exercise. Per-run capability is
 * the projection's own `capabilities`, which is enforced separately below.
 */
const IMPORT_CAPABILITY = "repository.policy.manage"

/**
 * The projection as this caller sees it.
 *
 * `capabilities` is the backend's answer for the calling principal rather than
 * a property of the run, so a caller who may not act is told so instead of
 * being shown a control the backend would then refuse.
 */
const importFor = (run, principal) =>
  requireCapability(principal, IMPORT_CAPABILITY)
    ? run
    : {
        ...run,
        capabilities: {
          canApprove: false,
          canCancel: false,
          canPause: false,
          canResume: false,
        },
      }

/**
 * The run for one import identifier, with the repository that owns it.
 *
 * Answers the refusal itself and returns nothing when there is no such run,
 * so an import belonging to another tenant is indistinguishable from one that
 * never existed: `state` is already scoped to this caller's isolation.
 */
const resolveImport = (response, state, importId) => {
  if (!UUID.test(importId)) {
    fail(response, "REQUEST_INVALID")
    return undefined
  }
  const entry = Object.entries(state.imports).find(
    ([, run]) => run?.importId === importId,
  )
  if (!entry) {
    fail(response, "REPOSITORY_IMPORT_NOT_FOUND")
    return undefined
  }
  return { repositoryId: entry[0], run: entry[1] }
}

/**
 * The six historical-import operations.
 *
 * Returns `true` when it answered, so the caller can fall through to the
 * repository routes when it did not. Two behaviours are the point of the
 * double: a stale `expectedStatus` conflicts exactly as a stale version does,
 * and approving records consent without ever producing `AUTHORIZED`, because
 * Evirion operational authorization is not the customer's to grant.
 */
async function handleImport(request, response, scope) {
  const { state, principal, organizationId, rest } = scope

  const currentMatch = /^\/repositories\/([^/]+)\/imports\/current$/.exec(rest)
  if (currentMatch && request.method === "GET") {
    const repositoryId = currentMatch[1]
    if (!UUID.test(repositoryId)) {
      fail(response, "REQUEST_INVALID")
      return true
    }
    if (!findRepository(state, principal, repositoryId)) {
      fail(response, "RESOURCE_NOT_FOUND")
      return true
    }
    const current = state.imports[repositoryId]
    // Absent is refused the same way a foreign one is. The Console only reads
    // it as empty because its repository read already succeeded.
    if (current) {
      succeed(response, importFor(current, principal))
    } else {
      fail(response, "REPOSITORY_IMPORT_NOT_FOUND")
    }
    return true
  }

  const createMatch = /^\/repositories\/([^/]+)\/imports$/.exec(rest)
  if (createMatch && request.method === "POST") {
    const repositoryId = createMatch[1]
    if (!UUID.test(repositoryId)) {
      fail(response, "REQUEST_INVALID")
      return true
    }
    const repository = findRepository(state, principal, repositoryId)
    if (!repository) {
      fail(response, "RESOURCE_NOT_FOUND")
      return true
    }

    await withCommand(request, response, state, principal, organizationId, {
      operation: "import.create",
      target: repositoryId,
      capability: IMPORT_CAPABILITY,
      apply: (body) => {
        if (body?.confirmationAccepted !== true) return { error: "REQUEST_INVALID" }
        if (!body?.filters || typeof body.filters !== "object") {
          return { error: "REPOSITORY_IMPORT_FILTERS_INVALID" }
        }
        if (repository.entitlement?.state !== "ACTIVE") {
          return { error: "REPOSITORY_NOT_ENTITLED" }
        }
        if (state.imports[repositoryId]) {
          return { error: "REPOSITORY_IMPORT_ALREADY_ACTIVE" }
        }

        const created = {
          ...IMPORT_RUNS.planning(),
          importId: randomUUID(),
          repositoryId,
          filters: body.filters,
        }
        state.imports[repositoryId] = created
        return { code: "REPOSITORY_IMPORT_CREATED", payload: created }
      },
    })
    return true
  }

  const approveMatch = /^\/imports\/([^/]+)\/approve$/.exec(rest)
  if (approveMatch && request.method === "POST") {
    const found = resolveImport(response, state, approveMatch[1])
    if (!found) return true

    await withCommand(request, response, state, principal, organizationId, {
      operation: "import.approve",
      target: found.run.importId,
      capability: IMPORT_CAPABILITY,
      apply: (body) => {
        if (body?.confirmationAccepted !== true) return { error: "REQUEST_INVALID" }
        if (
          typeof body?.costBudgetUsd !== "string" ||
          !IMPORT_BUDGET.test(body.costBudgetUsd) ||
          body.costBudgetUsd === "0.000000"
        ) {
          return { error: "REQUEST_INVALID" }
        }
        // `core.backfill_runs` has no version column, so the status is the
        // optimistic token and a stale one conflicts the same way.
        if (body?.expectedStatus !== found.run.status) {
          return { error: "VERSION_CONFLICT" }
        }
        if (!found.run.capabilities.canApprove) {
          return { error: "REPOSITORY_IMPORT_NOT_APPROVABLE" }
        }

        // Consent is recorded and the run moves to the Evirion wait. It never
        // becomes AUTHORIZED here: no customer action can produce that.
        const approved = {
          ...found.run,
          capabilities: {
            canApprove: false,
            canCancel: true,
            canPause: true,
            canResume: false,
          },
          cost: { ...found.run.cost, budgetUsd: body.costBudgetUsd },
          missingPrerequisite: "OPERATIONAL_AUTHORIZATION",
          modelCallsApproved: true,
          paidAuthorizationStatus: "AWAITING_OPERATIONAL_AUTHORIZATION",
          recoveryAction: "AWAIT_EVIRION_AUTHORIZATION",
          status: "PROCESSING",
        }
        state.imports[found.repositoryId] = approved
        return { code: "REPOSITORY_IMPORT_APPROVED", payload: approved }
      },
    })
    return true
  }

  const stateMatch = /^\/imports\/([^/]+)\/state$/.exec(rest)
  if (stateMatch && request.method === "PATCH") {
    const found = resolveImport(response, state, stateMatch[1])
    if (!found) return true

    await withCommand(request, response, state, principal, organizationId, {
      operation: "import.state",
      target: found.run.importId,
      capability: IMPORT_CAPABILITY,
      apply: (body) => {
        if (body?.expectedStatus !== found.run.status) {
          return { error: "VERSION_CONFLICT" }
        }
        const transition = importTransition(found.run, body?.state)
        if (transition.error) return transition

        state.imports[found.repositoryId] = transition.payload
        return transition
      },
    })
    return true
  }

  const failuresMatch = /^\/imports\/([^/]+)\/failures$/.exec(rest)
  if (failuresMatch && request.method === "GET") {
    const found = resolveImport(response, state, failuresMatch[1])
    if (!found) return true

    succeed(response, {
      importId: found.run.importId,
      failures: state.importFailures[found.run.importId] ?? [],
    })
    return true
  }

  const retryMatch = /^\/imports\/([^/]+)\/failures\/([^/]+)\/retry$/.exec(rest)
  if (retryMatch && request.method === "POST") {
    if (!UUID.test(retryMatch[2])) {
      fail(response, "REQUEST_INVALID")
      return true
    }
    const found = resolveImport(response, state, retryMatch[1])
    if (!found) return true

    await withCommand(request, response, state, principal, organizationId, {
      operation: "import.retry",
      target: retryMatch[2],
      capability: IMPORT_CAPABILITY,
      apply: () => {
        const failures = state.importFailures[found.run.importId] ?? []
        const failure = failures.find(
          (entry) => entry.extractionJobId === retryMatch[2],
        )
        if (!failure) return { error: "RESOURCE_NOT_FOUND" }
        // Retryability is the projection's, never inferred from the failure.
        if (!failure.retryable) {
          return { error: "REPOSITORY_IMPORT_JOB_NOT_RETRYABLE" }
        }

        state.importFailures[found.run.importId] = failures.filter(
          (entry) => entry !== failure,
        )
        const retried = {
          ...found.run,
          counts: {
            ...found.run.counts,
            failed: Math.max(0, found.run.counts.failed - 1),
          },
        }
        state.imports[found.repositoryId] = retried
        return { code: "REPOSITORY_IMPORT_JOB_RETRIED", payload: retried }
      },
    })
    return true
  }

  return false
}

/** The three states a customer may drive an import into. */
const importTransition = (run, wanted) => {
  if (wanted === "PAUSED") {
    if (!run.capabilities.canPause) return { error: "REPOSITORY_IMPORT_NOT_PAUSABLE" }
    return {
      code: "REPOSITORY_IMPORT_PAUSED",
      payload: {
        ...run,
        capabilities: { ...run.capabilities, canPause: false, canResume: true },
        status: "PAUSED",
      },
    }
  }

  if (wanted === "RESUMED") {
    if (!run.capabilities.canResume) return { error: "REPOSITORY_IMPORT_NOT_RESUMABLE" }
    // Source dead-letter work still held forces the resume back to paused.
    // That is a completed command with its own response code, not a failure.
    const blocked = run.counts.failed > 0
    return {
      code: blocked ? "REPOSITORY_IMPORT_RESUME_BLOCKED" : "REPOSITORY_IMPORT_RESUMED",
      payload: {
        ...run,
        capabilities: {
          ...run.capabilities,
          canPause: !blocked,
          canResume: blocked,
        },
        recoveryAction: blocked ? "RETRY_JOB" : run.recoveryAction,
        status: blocked ? "PAUSED" : "PROCESSING",
      },
    }
  }

  if (wanted === "CANCELLED") {
    if (!run.capabilities.canCancel)
      return { error: "REPOSITORY_IMPORT_NOT_CANCELLABLE" }
    return {
      code: "REPOSITORY_IMPORT_CANCELLED",
      payload: {
        ...run,
        capabilities: {
          canApprove: false,
          canCancel: false,
          canPause: false,
          canResume: false,
        },
        recoveryAction: "NONE",
        status: "CANCELLED",
      },
    }
  }

  return { error: "REQUEST_INVALID" }
}

const productStateOf = (repository) => {
  if (repository.archived) return "ARCHIVED"
  if (!repository.accessible) return "INACCESSIBLE"
  if (!repository.entitlement) return "AVAILABLE_LOCKED"
  if (repository.entitlement.state === "DISABLED") return "ENTITLEMENT_DISABLED"
  if (repository.changeRequest) return "CHANGE_REQUESTED"
  switch (repository.policy?.mode) {
    case "AUTO_EXTRACT":
      return "ACTIVE_AUTO_EXTRACT"
    case "SOURCE_ONLY":
      return "ACTIVE_SOURCE_ONLY"
    default:
      return "ACTIVE_LIVE_OFF"
  }
}

async function withCommand(request, response, state, principal, organizationId, spec) {
  if (!requireCapability(principal, spec.capability)) {
    return fail(response, "CAPABILITY_REQUIRED")
  }

  const key = request.headers["idempotency-key"]
  if (typeof key !== "string" || !UUID.test(key)) {
    return fail(response, "REQUEST_INVALID")
  }

  const body = await readBody(request)
  if (body === Symbol.for("unparsable")) return fail(response, "REQUEST_INVALID")

  const previous = replay(
    state,
    principal,
    organizationId,
    spec.operation,
    spec.target,
    key,
    body,
  )
  if (previous.kind === "replayed") return succeed(response, previous.receipt)
  if (previous.kind === "reused") return fail(response, "IDEMPOTENCY_KEY_REUSED")

  const outcome = spec.apply(body)
  if (outcome.error) {
    const extra =
      outcome.currentVersion === undefined
        ? {}
        : { currentVersion: outcome.currentVersion }
    return fail(response, outcome.error, extra)
  }
  if (outcome.data) {
    // A GitHub control-plane response is a projection rather than a command
    // receipt, and it is still stored against the key: a replayed connect must
    // return the same setup intent, not mint a second one.
    return succeed(response, remember(state, previous.slot, body, outcome.data))
  }

  return succeed(
    response,
    remember(state, previous.slot, body, receiptFor(outcome.code, outcome.payload)),
  )
}

const material = readMaterial()
const server = createServer(
  { cert: material.certificate, key: material.key },
  (request, response) => {
    const url = new URL(request.url ?? "/", `https://127.0.0.1:${PORT}`)
    handle(request, response, url).catch(() => fail(response, "INTERNAL_ERROR"))
  },
)

server.listen(PORT, "127.0.0.1", () => {
  console.log(`console API double listening on https://127.0.0.1:${PORT}`)
})
