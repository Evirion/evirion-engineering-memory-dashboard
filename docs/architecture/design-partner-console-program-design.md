
> Dashboard authority transfer source
> Backend source commit: `b23f6ba2b11f583b61200cec63500a782992f1f0`.
> Original source path: `docs/superpowers/specs/2026-08-25-design-partner-console-program-design.md`.
> Original source SHA-256: `5caa5e785ea625c210d9cd7cbc72e07b00e854c5ea90cbeb276d6792d653ce6d`.

# Design Partner Console program design

Status: Accepted

Accepted: 2026-08-25

Scope: portable source-controlled requirements and architecture authority for
EEM-4 and EEM-6–9 until EEM-9/01 moves Dashboard-owned authority to
`Evirion/evirion-engineering-memory-dashboard`.

This document plus the linked active EEM plans is sufficient to identify,
scope, order and plan a subtask from a fresh repository clone. EEM-9/01 itself
also requires the longer accepted Obsidian package to preserve every immutable
`.A<n>` acceptance row and source-disposition detail during migration; if that
package is unavailable, EEM-9/01 stops rather than reconstructing it. After
EEM-9/01, the migrated requirements/architecture/implementation-plan copies are
the version-controlled detailed authority. The OWASP note and operations
runbook remain mandatory for EEM-9/07–10 until separately migrated or replaced
by an explicit source-controlled pointer.

The
[EEM-9 execution plan](../plans/active/eem-9-design-partner-console-dashboard-and-certification.md)
is the self-contained entry point for the fixed Next.js/Supabase Auth stack,
UI-to-BFF-to-backend flow, OWASP acceptance matrix and task-specific reading
map. The accepted source package can be opened directly in Obsidian:

- [requirements](obsidian://open?vault=Obsidian%20Vault&file=10%20Evirion%2F01%20Products%2FEEM%20-%20Design%20Partner%20Console%20requirements.md);
- [architecture](obsidian://open?vault=Obsidian%20Vault&file=10%20Evirion%2FArchitecture%2FEEM%20-%20Design%20Partner%20Console%20architecture.md);
- [detailed implementation plan](obsidian://open?vault=Obsidian%20Vault&file=10%20Evirion%2FRoadmaps%2FEEM%20-%20Design%20Partner%20Console%20implementation%20plan.md);
- [OWASP audit and threat model](obsidian://open?vault=Obsidian%20Vault&file=10%20Evirion%2FArchitecture%2FEEM%20-%20OWASP-%D0%B0%D1%83%D0%B4%D0%B8%D1%82%20%D0%B8%20%D0%BC%D0%BE%D0%B4%D0%B5%D0%BB%D1%8C%20%D1%83%D0%B3%D1%80%D0%BE%D0%B7.md);
- [operations runbook](obsidian://open?vault=Obsidian%20Vault&file=10%20Evirion%2FArchitecture%2FEEM%20-%20%D0%9F%D0%BE%D0%BB%D0%BD%D1%8B%D0%B9%20runbook%20%D0%B7%D0%B0%D0%BF%D1%83%D1%81%D0%BA%D0%B0%20%D0%B8%20%D1%8D%D0%BA%D1%81%D0%BF%D0%BB%D1%83%D0%B0%D1%82%D0%B0%D1%86%D0%B8%D0%B8.md).

Vault-relative fallbacks:

- `10 Evirion/01 Products/EEM - Design Partner Console requirements.md`;
- `10 Evirion/Architecture/EEM - Design Partner Console architecture.md`;
- `10 Evirion/Roadmaps/EEM - Design Partner Console implementation plan.md`;
- `10 Evirion/Architecture/EEM - OWASP-аудит и модель угроз.md`;
- `10 Evirion/Architecture/EEM - Полный runbook запуска и эксплуатации.md`.

Use the EEM-9 plan's unique-vault discovery rule if URI opening fails.
Failure to open a mandatory source or a conflict between authorities is a stop
condition, not permission to reconstruct or guess the contract.

This acceptance does not authorize implementation, a remote migration,
deployment, destructive reset, worker start, provider call, paid regression,
paid backfill, customer-data use, or production release.

## 1. Decision

Use a contract-first two-repository architecture.

Backend repository `Evirion/evirion-engineering-memory` owns:

- PostgreSQL schema, migrations, functions, triggers, constraints, RLS, grants;
- organization membership/capabilities and platform-operator identity;
- GitHub installation/repository access and repository entitlements;
- webhook/backfill/source/knowledge workers;
- budget, paid authorization, dispatch, checkpoint, cost;
- review/lifecycle/correction persistence;
- versioned customer/operator OpenAPI and JSON Schema;
- backend verification and release evidence.

Dashboard repository `Evirion/evirion-engineering-memory-dashboard` owns:

- Next.js App Router and strict TypeScript UI;
- Supabase Auth integration behind a server-only `HttpOnly` BFF session broker;
- BFF routes/server actions;
- generated runtime-validated backend client pinned to release bytes, SHA-256
  and verified artifact attestation binding backend repository, protected
  signer workflow/ref/commit and issuer; tag/digest alone is not trusted;
- browser security, accessibility, UI tests and Console deployment.

The Dashboard owns no database, policy, entitlement, retry, lifecycle,
metrics, provider, or paid-call source of truth. Browser/BFF code may not use
`service_role`, worker/operator DSNs, GitHub App keys/tokens, provider keys,
`core` table access, raw Source Envelopes, or raw model responses.

## 2. Readiness boundary

Allowed before EEM-3 completion:

- requirements/architecture/planning;
- local documentation and contract fixtures;
- demonstrably free static validation.

Blocked until EEM-3 is merged and free staging-recertified:

- EEM-4/EEM-6–9 and EEM-9/10 product/schema/partner implementation;
- migration apply/deploy;
- Dashboard runtime integration with mutable backend behavior;
- any provider/paid operation.

Accepted order:

```text
EEM-3 complete and free staging-certified
  -> EEM-9/01 Dashboard authority + backend global-lock attestation
  -> EEM-4 customer access/tenant isolation
  -> EEM-9/02 Auth shell + EEM-6 entitlements/GitHub/free paths
  -> EEM-9/03 repository UI + EEM-7 paid/customer operations
  -> EEM-9/04 import UI + EEM-8 review/lifecycle/read API
  -> EEM-9/05 memory review
  -> EEM-9/06 processing/settings/metrics
  -> EEM-9/07 free integration
  -> EEM-9/08 separately approved paid certification
  -> EEM-9/09 Technical Design Partner Ready
  -> EEM-9/10 separately approved first design partner outcome
```

Each `+` phase means the Dashboard consumes the preceding completed backend
contract while the next backend milestone proceeds: EEM-9/03 consumes EEM-6
while EEM-7 runs; EEM-9/04 consumes EEM-7 while EEM-8 runs.

EEM-5 remains a separate source-runtime deployment/observation track. A fresh
post-EEM-6 source observation is required at EEM-9/07. EEM-7 shared-image
changes either require another deployment/observation or exact
non-invalidation evidence.

## 3. Principal and tenant contract

Roles:

- Owner;
- Admin;
- Reviewer, represented by the existing database `member` role;
- Viewer.

Supabase Auth proves identity. Current database membership/capabilities
authorize every action. User-editable metadata and stale JWT claims are not
authorization.

Alpha Auth is invite-only email OTP plus TOTP MFA. Supabase Admin invitation
links are excluded because they do not support PKCE; no Auth/invitation token
enters an application URL. Public signup, magic links, anonymous, password,
phone, social/OAuth, SSO and manual identity linking are disabled. The backend
pre-provisions a new invited Auth user without a password, with
`email_confirm = false` and no authorization metadata; an existing user is
reusable only when its exact email identity matches the frozen provider
contract, never by relinking. `shouldCreateUser = false` prevents unknown-user
signup, and the same-origin BFF verifies the OTP server-side.
The source-controlled email template contains `{{ .Token }}` and no
confirmation/token-hash link; synthetic local and separately authorized hosted
evidence verifies actual message content plus expiry/resend/redirect parity.
OTP delivery uses one automatic attempt per invitation generation because the
provider accepts no application idempotency key. A post-dispatch lost response
becomes `OUTCOME_UNKNOWN`; only an explicit cooldown-bound resend advances to a
new generation, and revoke/expire fences all older generations. Successful OTP
verification may reconcile only the same still-current unknown generation;
lost `verifyOtp` response records `VERIFY_OUTCOME_UNKNOWN`, never automatically
repeats verification and cannot register an application session or membership.
Access/refresh tokens remain only in host-scoped `__Host-` cookies with
`HttpOnly; Secure; SameSite=Lax; Path=/` and no `Domain`, managed by a
request-local server client; browser JavaScript never receives them.
Concurrent refresh/lost-response handling preserves exact session ownership.
Cookie chunking preserves host-only attributes, clears stale chunks on
rotation/logout and fails closed above the P01-frozen browser/proxy header
budget.
Canonical origins, TLS termination and trusted-proxy behavior are frozen by
P01. Local browser/E2E/DAST uses a pinned HTTPS origin with the same
`__Host-`/`Secure` contract as staging.
BFF performs an idempotent backend session bootstrap after OTP verification:
existing active membership registers the session; a matching live invitation
atomically registers it and activates membership. Exactly one eligible
invitation may auto-select; multiple rows require post-auth opaque selection;
mismatch/no-access registers nothing. Bootstrap is an internal BFF-only route
requiring the exact bearer
plus a one-time signed proof bound to token, principal/session, pre-auth,
selection, nonce/times, idempotency key and request digest; `service_role`,
Origin/CORS or a bare provider token cannot substitute. BFF and directly
callable backend requests both validate the exact token
online with `getUser(accessToken)` and require a live private application-
session row keyed by verified user plus `session_id`. Direct Auth tokens that
did not pass BFF login bootstrap and revoked/expired application sessions fail
closed; application denial precedes provider sign-out reconciliation because a
provider access JWT can remain valid until `exp`.
Fresh Auth evidence must also be non-anonymous, verified-email and match the
P01-frozen email-OTP/TOTP identity/provider/`amr` allowlist; configuration drift
or any unsupported existing identity denies.
Current/others/all application revocation maps to provider
`local`/`others`/`global`; selected non-current revocation is application-only
with terminal provider `NOT_APPLICABLE`. Post-dispatch provider response loss
records `OUTCOME_UNKNOWN` after application denial; reconciliation observes
provider state before any bounded safe-idempotent retry and otherwise escalates
without restoring access.
Database time owns absolute/inactivity expiry. Only an allowlisted versioned
API/RPC transaction that completes session and domain authorization may
perform a coalesced activity touch before commit; deny/Auth-outage, asset/prefetch/non-
activity polling and compatibility-view RLS branches are side-effect free.
Owner/Admin and Evirion operator privileged mutations require backend-enforced
`aal2`. First TOTP enrollment may begin from the freshly email-OTP-verified
AAL1 session but grants no privileged capability until challenge/verify plus
refreshed current/next AAL proves `aal2`; later factor changes require the
P01-frozen full reauthentication ceremony. Exact JWT/inactivity/absolute-session/device/reauthentication,
session-inventory/termination, factor-change, account/factor recovery,
pre-auth/session-bound CSRF/Auth-abuse and nonce-bearing pre-auth plus
authenticated zero-cache contracts are frozen by EEM-9/01 and implemented by
EEM-4/03 plus EEM-9/02.
The initial platform-operator roster is a non-public idempotent deployment-
owner bootstrap from an exact two-person-approved manifest and is disabled
after use. Later roster add/disable uses a distinct approved deployment-owner
command with final-active-operator guard; readiness requires two distinct
active operator identities and operator disable denies application sessions
before provider reconciliation.

Tenant rules:

- every tenant-owned row carries `organization_id`;
- cross-row tenant identity uses composite foreign keys/unique keys;
- customer routes use versioned `api.*`/Console API contracts;
- new direct `authenticated` access to `core`/`private` is forbidden;
- RLS is forced except a specifically attested documented exception;
- security-definer functions use fixed empty `search_path`, explicit principal
  checks, revoked `PUBLIC`, and minimum named grants;
- organization Alpha visibility is organization-wide; no silent per-repository
  ACL is introduced.

Invite states:

```text
REQUESTED -> AUTH_USER_CREATED -> SENT -> ACCEPTED
REQUESTED/AUTH_USER_CREATED/SENT -> REVOKED | EXPIRED | FAILED
```

Membership states:

```text
INVITED -> ACTIVE -> DISABLED
```

The final active Owner cannot be removed/demoted/disabled. External Auth/email
calls occur outside database locks through durable state/reconciliation.

## 4. Durable command contract

Every stateful customer/operator mutation uses:

- authenticated server-derived actor;
- backend-validated authoritative organization;
- `Idempotency-Key`;
- canonical request hash;
- append-only durable command receipt;
- same-transaction domain mutation, audit and outbox where applicable.

Same key/same hash replays the receipt. Same key/different hash returns
`IDEMPOTENCY_KEY_REUSED` with no mutation. Receipt uniqueness uses PostgreSQL
`UNIQUE NULLS NOT DISTINCT` for null organization/system bootstrap identities.

## 5. Repository access, entitlement, policy and consent

GitHub access, organization capacity, repository entitlement, automation
policy, customer consent and Evirion operational authorization are independent.

Entitlement:

```text
ABSENT -> ACTIVE(generation=1)
ACTIVE(n) -> DISABLED(n+1)
DISABLED(n) -> ACTIVE(n+1)
```

Limits:

```text
FIXED(max_active_repositories >= 1)
UNLIMITED(max_active_repositories = null)
```

Server-owned sources:

- `DESIGN_PARTNER`;
- `PLAN` reserved until billing authority exists;
- `MANUAL` operator exception with reason.

Customers cannot choose source, capacity, replacement mode, generation or
operator decision. Disable/re-enable increments generation and preserves
history.

Live policy:

- `OFF`: no automatic live source/paid work; historical `missing_only` import
  may still be prepared through its separate gates;
- `SOURCE_ONLY`: live source work only, no model authorization;
- `AUTO_EXTRACT`: source work may advance to the guarded paid boundary when
  entitlement, budget and live consent permit.

Consent:

```text
ABSENT -> ACTIVE
ACTIVE -> REVOKED | EXPIRED
```

Consent is immutable/history-preserving and bound to organization, repository
or import, entitlement generation, policy version/scope, model/call/budget
ceiling, retry policy, actor and expiry. Consent is not Evirion operational
authorization.

Every admitted job/source/backfill item stores entitlement generation.
Database capability fences reject pre-entitlement workers before reservation,
claim or persistence.

## 6. GitHub control plane

Setup intent:

```text
CREATED -> CONSUMED | EXPIRED | FAILED
```

Sync run:

```text
QUEUED -> RUNNING -> COMPLETED | FAILED
```

One effective installation is active per organization. One-time callback state
is tenant-bound and single-use. Customer installation-start and sync-start
commands use durable receipts; provider callback/lifecycle delivery additionally
uses setup intent/delivery identity. Incomplete sync cannot tombstone unseen
repositories. Installation lifecycle cannot create extraction work.

## 7. Paid operation, authorization and dispatch

Customer consent and Evirion operational authorization are separate.

EEM-7/01 installs closed operational-authorization storage with zero application
create grants, then logical authorization/dispatch. EEM-7/02 adds
platform-operator-authenticated operational-authorization management APIs/CLI.

Logical model-call authorization:

```text
AUTHORIZED -> DISPATCHED -> CHECKPOINTED
AUTHORIZED -> EXPIRED
DISPATCHED -> OUTCOME_UNKNOWN
OUTCOME_UNKNOWN -> DISPATCHED
  only through a new STARTED dispatch under the same authorization/key/
  request/model and remaining allowance with verified provider semantics;
  otherwise it remains an operator incident
```

Operational authorization:

```text
ACTIVE -> CONSUMED | REVOKED | EXPIRED
```

Dispatch:

```text
STARTED -> SUCCEEDED | FAILED | OUTCOME_UNKNOWN
```

One logical initial/validation-repair authorization binds:

- organization and repository;
- extraction job and execution;
- phase and attempt ordinal;
- canonical request digest;
- provider/model profile and provider-account scope;
- server-derived provider idempotency key where supported;
- maximum transport dispatches;
- entitlement generation and policy version;
- budget reservation;
- customer consent;
- operational authorization;
- readiness/runtime profile, retry policy and expiry.

Logical authorization commit linearizes with entitlement disable. Disable
blocks a new logical authorization but does not revoke a previously committed
bounded operation. Committed dispatch `STARTED`, immediately before HTTP,
linearizes with operational revoke. No database transaction spans provider I/O.

Unknown outcome may retry only under the same authorization/key/digest/model,
verified provider idempotency semantics, remaining allowance and active
operational authorization. Otherwise it is an operator incident. A successful
raw response is checkpointed before validation; checkpoint recovery never
repeats that provider phase.

Offboarding first increments entitlement generations/fences new work. EEM-7/01
forward-extends the saga to revoke active operational authorizations and reject
future authorization creation without rewriting authorization/dispatch/
checkpoint/cost history.

## 8. Review and lifecycle

Effective review:

```text
PENDING (derived)
APPROVED | EDITED | USER_REJECTED
```

Review appends support approve original, edit, reject and explicit
`REVERT_TO_ORIGINAL_AND_APPROVE`. Generic edited-to-approved is forbidden.
Every action carries expected review sequence and expected lifecycle version.

Effective lifecycle:

```text
UNRESOLVED (derived) -> ACTIVE
UNRESOLVED/ACTIVE -> SUPERSEDED
```

Correction:

```text
REQUESTED -> EXECUTING -> EXECUTED | REJECTED
EXECUTING -> FAILED -> EXECUTING
```

Supersession writes directed `NEW supersedes OLD` relation plus state events
atomically and does not auto-activate NEW. Two-object commands lock stable UUID
order. Correction request carries expected review sequence, lifecycle version
and nullable relation version; operator execute/reject carries request version
and rechecks stored target versions.

Review/lifecycle never rewrites original Source Envelope, model response,
ModelAttempt, ExtractionRun, AdmissionRecord, Knowledge Object or Evidence.

## 9. Customer-safe reads and metrics

Only accepted admissions produce Knowledge Objects. `REJECTED` is a valid model
decision with zero knowledge rows. `QUARANTINED` is invalid output and never
enters trusted memory.

Responses exclude raw source/model/checkpoint payloads, secrets, unrestricted
audit data and role-disallowed fields. Backend enforces field/action
capabilities; UI hiding is not security.

Cost states remain distinct:

- `RESERVED`;
- `MEASURED`;
- `UNRESOLVED`;
- `NOT_APPLICABLE`.

One server-derived `asOf` cutoff bounds each metric cohort and every related
review/lifecycle projection. Later review/lifecycle events cannot change that
frozen state. Cost settlement is attributed to the execution's first-terminal
period: a query at an earlier `asOf` excludes a later settlement, while a later
query updates that original period's cost numerator/completeness. Alias work is
deduplicated by effective semantic job identity.

## 10. Global lock order

Final EEM-3 code is attested by paired backend EEM-9/01 before EEM-4 stateful
work:

1a. principal application-session rows;
1b. platform-operator membership rows;
1c. organization-membership guard/rows;
2. GitHub installation/repository access;
3. organization limits/slot assignment;
4. entitlement/generation/policy;
5. semantic fingerprint advisory context where prepare participates;
6. backfill run;
7. backfill items in stable UUID order;
8. PR-admission advisory context;
9. source-recovery advisory context;
10. extraction/effective job rows in stable UUID order;
11. customer consent, operational/model authorization, execution/dispatch;
12. budget reservation/settlement;
13. per-organization relation-graph advisory lock;
14. Knowledge Objects in stable UUID order;
15. review/lifecycle/relation/correction context;
16. receipt/audit/outbox append.

Subranks 1a→1b→1c are strict, not interchangeable “rank 1.” No operation
acquires a lower rank after a higher one. Mutable facts are rechecked after the
last prerequisite lock. Every protected human API/RPC transaction begins at
the verified application session 1a; customer work continues through 1c and
operator work through 1b→1c before later domain ranks. Session/invitation uses
1a→1c; operator recovery uses 1a→1b→1c; offboarding's human fence begins
1a→1b→1c and runs any conditional global-session revoker in a separate
transaction beginning at 1a. Timeouts are watchdogs, not concurrency evidence.

## 11. Requirement ownership

Original aliases remain immutable:

- `B01` EEM-4/01: `NFR-COMP-001`;
- `B01A` EEM-4/02: `BR-021`, `NFR-AUD-001`, `NFR-REL-001`,
  `NFR-OBS-001`;
- `B02` EEM-4/03: `AUTH-001`–`AUTH-005`, `AUTH-007`, `SET-001`;
- EEM-4/04: secondary baseline tenant evidence; no primary row;
- `B03` EEM-6/01: `ENT-001`–`ENT-003`, `ENT-006`,
  `REPO-001`, `REPO-002`, `REPO-004`;
- `B03A` EEM-6/02: `AUTH-006`, `ENT-005`, `OPS-002`, `BR-017`;
- `B04` EEM-6/03: `GH-001`–`GH-004`;
- `B05` EEM-6/04: `BR-001`, `BR-003`, `BR-004`, `BR-018`;
- `B06` EEM-7/01: `ENT-004`, `BR-002`, `BR-006`, `BR-007`, `BR-022`;
- `B06B` EEM-7/02: `OPS-001`, `BR-005`;
- `B06A` EEM-7/03: `BF-001`–`BF-003`, `PROC-002`, `BR-019`;
- `B07` EEM-8/01: `REV-001`–`REV-005`, `BR-008`;
- `B08` EEM-8/02: `LIFE-001`–`LIFE-005`, `BR-013`–`BR-015`;
- `B09` EEM-8/03: `REPO-003`, `BF-004`, `MEM-*`, `KD-*`, `PR-001`,
  `PROC-001`, `PROC-003`, `SET-002`, `SET-003`, `MET-*`,
  `BR-009`–`BR-012`, `BR-020`, `BR-023`, `BR-024`,
  `NFR-SEC-004`, `NFR-PRIV-001`, `NFR-PERF-001`;
- `I01-B` backend EEM-9/07: `BR-016`, `NFR-SEC-002`,
  `NFR-PERF-002`, `NFR-OPS-001`;
- `I01-C` Dashboard EEM-9/07: `NFR-SEC-001`, `NFR-SEC-003`,
  `NFR-ACC-001`, `AUTH-009`;

`C02` EEM-9/02 is the primary owner for `AUTH-008`. Other `C01`–`C06`
acceptance evidence does not replace backend security ownership. Stable
`SEC-WEB-001`–`SEC-WEB-012` ownership is defined in the EEM-9 plan. EEM-6/05,
EEM-7/04 and EEM-8/04 are local gates with no primary requirement row. I02 owns
bounded paid certification, I03-A owns Technical Design Partner Ready evidence,
and I03-B owns the separate first-design-partner outcome; none replaces earlier
product requirements.

## 12. Release and approval gates

- Every PR starts from updated `main`; no stacking unless explicitly approved.
- Database changes are forward-only CLI-generated migrations.
- Focused RED/GREEN tests precede affected gates; the complete free gate runs
  once after bytes freeze.
- EEM-9/07 local gates precede any remote action. Staging apply/deploy/canary
  requires explicit project/artifact/migration/false-live-flags/rollback
  authorization and excludes destructive reset/provider work.
- EEM-9/08 paid staging requires fresh exact approval for environment,
  fixture, provider/model, phases, maximum dispatches/calls/budget, operational
  authorization, stop conditions and rollback owner.
- EEM-9/09 does not run a real partner workload or reuse EEM-9/08 approval.
- EEM-9/10 requires a fresh partner/data/legal scope for every workload;
  provider/model/budget approval, customer consent and operational
  authorization apply only to each provider-bearing paid workload.
- `SEC-2026-010` must be closed before external objects can enter active/trusted
  retrieval: they remain `UNRESOLVED` until eligible review and explicit
  activation.
- Production certification is a separate explicit state and approval.

## 13. Source disposition

Adopted:

- invite-only Next.js/Supabase Auth Console;
- repository onboarding, historical import, memory review and metrics goals;
- contract-first two-repository delivery.

Modified:

- direct database/browser access becomes BFF + guarded versioned API;
- unsupported Admin invite-link/PKCE flow becomes server-preprovisioned,
  invite-only email OTP with a server-only `HttpOnly` session broker;
- GitHub OAuth/token handling becomes existing GitHub App control plane;
- repository selection becomes capacity + entitlement + generation;
- paid actions require customer consent and separate Evirion operational
  authorization plus append-only dispatch;
- review/edit/supersession become append-only review/lifecycle state;
- a single “EEM-6 Console” becomes EEM-4 and EEM-6–9.

Rejected:

- nullable/manual/unlimited limits without explicit mode;
- UI-derived authorization/retry/lifecycle/metrics;
- direct provider calls from Dashboard;
- mutable contract consumption from backend `main`;
- generic update/delete of trusted provenance;
- schedule labels as readiness evidence.

## 14. Authoritative task plans

- [`eem-4-customer-access-and-tenant-isolation.md`](https://github.com/Evirion/evirion-engineering-memory/blob/b23f6ba2b11f583b61200cec63500a782992f1f0/docs/plans/active/eem-4-customer-access-and-tenant-isolation.md)
- [`eem-6-repository-entitlements-and-github-control.md`](https://github.com/Evirion/evirion-engineering-memory/blob/b23f6ba2b11f583b61200cec63500a782992f1f0/docs/plans/active/eem-6-repository-entitlements-and-github-control.md)
- [`eem-7-paid-call-authorization-and-customer-operations.md`](https://github.com/Evirion/evirion-engineering-memory/blob/b23f6ba2b11f583b61200cec63500a782992f1f0/docs/plans/active/eem-7-paid-call-authorization-and-customer-operations.md)
- [`eem-8-customer-safe-api-review-and-lifecycle.md`](https://github.com/Evirion/evirion-engineering-memory/blob/b23f6ba2b11f583b61200cec63500a782992f1f0/docs/plans/active/eem-8-customer-safe-api-review-and-lifecycle.md)
- [`eem-9-design-partner-console-dashboard-and-certification.md`](../plans/active/eem-9-design-partner-console-dashboard-and-certification.md)
