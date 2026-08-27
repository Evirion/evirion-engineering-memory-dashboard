# Dashboard agent guide

This repository owns the Evirion Engineering Memory Design Partner Console UI,
server-only BFF, browser security, generated backend client, and Console
deployment evidence. The backend repository remains authoritative for
persistence, tenancy, policy, entitlements, workers, review/lifecycle state,
metrics, provider calls, and paid authorization.

## Reading order

1. Read this file.
2. Read [`docs/HANDOFF.md`](docs/HANDOFF.md) and
   [`docs/ROADMAP.md`](docs/ROADMAP.md).
3. Read [`docs/plans/active/README.md`](docs/plans/active/README.md) and copy
   exactly one numbered EEM-9 request.
4. Follow that task's reading map in the
   [EEM-9 plan](docs/plans/active/eem-9-design-partner-console-dashboard-and-certification.md).
5. Read the applicable product requirements, architecture, implementation
   plan, decision records, security matrix, and immutable backend contract lock.
6. Verify every material status or digest against Git and executable checks.

After the paired EEM-9/01 backend PR merges, its stable pointer is the
cross-repository entry point and must resolve to the exact Dashboard commit,
authority package digest, reading map, and numbered catalog. Mutable `main`
content is never a contract lock.

## Task and repository boundaries

- Work on exactly the numbered subtask requested by the user.
- Do not start an adjacent EEM task, remote phase, or paid phase.
- EEM-9/01 contains two sequential PRs: Dashboard authority first, backend
  pointer and lock attestation second. Do not stack or reverse them.
- EEM-9/02 and later consume only immutable, attestation-verified backend
  contract bytes.
- Preserve the Apache-2.0 `LICENSE` and all pre-existing non-product files.
- Never commit `.idea/`, local vault paths, local environment files,
  credentials, runtime outputs, or private evidence.

## Non-negotiable security rules

- Browser JavaScript never receives Supabase access/refresh tokens,
  `service_role`, a database DSN, GitHub App credentials, provider keys, raw
  Source Envelopes, raw model responses, or internal operator credentials.
- Auth sessions are request-local and server-only in host-scoped `__Host-`
  cookies with `HttpOnly; Secure; SameSite=Lax; Path=/` and no `Domain`.
- The BFF calls only versioned customer-safe backend APIs. It never reads or
  writes backend `core` tables and never becomes a policy source of truth.
- Live membership, explicit organization scope, trusted tenant derivation, and
  backend capability checks authorize every operation. UI visibility is not
  authorization.
- `REJECTED` and `QUARANTINED` are never shown as trusted Knowledge Objects.
- Unknown server states fail closed through an explicit unsupported-state
  response.
- State-changing requests require the frozen CSRF/origin/proxy/content-type
  boundary and durable backend idempotency.
- No provider request, paid operation, deployment, hosted Supabase mutation,
  or customer-data use runs without the exact separate authorization required
  by the active plan.

## Implementation rules

- Use Next.js App Router under `src` with strict TypeScript.
- Keep server and browser modules physically separated. No session-bearing
  Supabase client may enter a client component.
- Generate types and runtime validators from the exact signed backend contract;
  handwritten duplicate API types are forbidden.
- Handle discriminated unions and enums exhaustively with a `never` check.
- Imports stay at module top unless a documented circular dependency requires
  otherwise.
- Use server-first protected pages and bounded client components.
- Preserve force-dynamic and no-store behavior for Auth, session, recovery,
  nonce-bearing, and tenant responses.
- Meet WCAG 2.2 AA target behavior for every owned journey.

## Development cadence

- Before stateful or cross-repository implementation, record state
  transitions, read/mutation and no-side-effect rows, trust boundaries, lock
  order, and acceptance ownership.
- Use RED/GREEN TDD for behavior. Run the smallest focused test first.
- Run affected checks only for the touched subsystem. Freeze bytes before the
  complete free gate.
- Audit the complete task diff once. If independent review is required, run one
  bounded review wave against the same tree and one focused confirmation only
  when that wave finds accepted issues.
- A docs-only change reruns documentation, acceptance, and authority digest
  checks; it does not justify unrelated runtime gates.
- Do not weaken tenant isolation, provenance, idempotency, checkpoint-before-
  validation, paid approval, or immutable contract verification to pass a gate.

## Git and release rules

- Start each numbered subtask from updated `main` on
  `EEM-<task>/<two-digit-order>-<slug>`.
- Do not commit, push, create a PR, merge, publish, or sign unless the user
  explicitly authorizes that action.
- Never add Cursor/AI `Co-authored-by` trailers.
- GitHub Actions use full commit SHAs. Dependencies, tool versions, registries,
  lockfiles, verifier binaries, and contract digests are pinned.
- Public Sigstore/Fulcio and Rekor attest immutable authority/contract package
  bytes. Verification binds subject digest, repository, workflow, tag ref,
  source commit, issuer, inclusion proof, release asset identity, and verifier.
- GitHub Free repository-governance enforcement is temporarily waived only for
  bootstrap. `SEC-2026-012` remains open and blocks Technical Design Partner
  Ready.

## Documentation and status

- `docs/product/` owns accepted product requirements.
- `docs/architecture/` owns current Dashboard architecture.
- `docs/decisions/` owns durable rationale.
- `docs/plans/active/` owns numbered unfinished work.
- `docs/HANDOFF.md` owns current branch, next action, blockers, and approvals.
- `docs/ROADMAP.md` owns dependency order and delivery status.
- `docs/CHANGELOG.md` records behavior, security, operations, and release-state
  changes.
- Report implemented, locally verified, merged, deployed, observed,
  staging-certified, paid-certified, and production-certified separately.
- Do not invent rationale. If evidence proves a decision but not why, write
  `Reason not documented`.
