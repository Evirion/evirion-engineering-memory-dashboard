
> Dashboard authority transfer source
> Backend source commit: `b23f6ba2b11f583b61200cec63500a782992f1f0`.
> Original source path: `docs/plans/active/eem-9-design-partner-console-dashboard-and-certification.md`.
> Original source SHA-256: `44ac0c4ebe4030cbf24028a3092c35e6ca38d45b52c92d92cd25a2330d16ea97`.

# EEM-9 Design Partner Console dashboard and certification

Status: active; architecture package accepted 2026-08-25; Dashboard authority
transfer is in progress under EEM-9/01. Backend EEM-3/13 merged in PR #24 at
`b23f6ba2b11f583b61200cec63500a782992f1f0`; the reviewed tree matches the
merged tree and its PostgreSQL 17 lock attestation passes.

Primary product repository after EEM-9/01:
`Evirion/evirion-engineering-memory-dashboard`.

Backend/certification contributor:
`Evirion/evirion-engineering-memory`.

Portable accepted program authority:
[`2026-08-25-design-partner-console-program-design.md`](../../architecture/design-partner-console-program-design.md).

## Purpose

Deliver an invite-only Next.js Console/BFF that consumes versioned backend
contracts without becoming an authorization, entitlement, retry, lifecycle,
metrics, or paid-call source of truth. Coordinate cross-repository free and
separately approved paid certification.

EEM-9/01 moves the accepted requirements/architecture/plan and this
Dashboard-owned plan into the Dashboard repository. A paired backend
EEM-9/01 PR in the same subtask replaces the temporary copy with a pointer
pinned to the Dashboard commit/digest and publishes the final EEM-3 global-lock
attestation; backend EEM-4/EEM-6–8 plans remain here.

## Two-repository contract

```text
Browser
  -> Next.js BFF/server action
  -> versioned Console API
  -> PostgreSQL/GitHub control plane/workers
```

Backend owns:

- PostgreSQL schema, migrations, constraints, RLS and grants;
- GitHub, entitlement, worker/backfill, paid authorization, review/lifecycle;
- customer/operator OpenAPI and JSON Schemas;
- backend verification and authoritative state transitions.

Dashboard owns:

- Next.js App Router and strict TypeScript;
- Supabase Auth UX and the server-only session broker;
- BFF routes/server actions;
- generated runtime-validated client pinned to attestation-verified backend
  contract bytes/digest;
- accessibility/browser security, UI tests and Console deployment.

The browser never receives `service_role`, worker/operator DSNs, GitHub private
keys/tokens, provider keys, raw responses, Source Envelope bodies, or internal
operator credentials. The BFF does not query `core`, bypass the versioned API,
or convert UI state into domain authority.

## Mandatory execution authorities and verification links

This plan is the self-contained execution entry point. It repeats the critical
technology, interaction and security contracts below so an implementer does not
have to infer them. The accepted source package remains mandatory verification
evidence for its complete requirement rows, state machines and acceptance maps.

### Source-controlled authorities

Every EEM-9 subtask must read:

1. this plan;
2. the
   [portable two-repository program design](../../architecture/design-partner-console-program-design.md);
3. the backend active plan(s) assigned by the map below;
4. `AGENTS.md`, `docs/HANDOFF.md`, `docs/ROADMAP.md` and the exact copy-ready
   request in `docs/plans/active/README.md`.

| EEM-9 subtask | Mandatory backend plan |
|---|---|
| `/01` | [EEM-4](https://github.com/Evirion/evirion-engineering-memory/blob/b23f6ba2b11f583b61200cec63500a782992f1f0/docs/plans/active/eem-4-customer-access-and-tenant-isolation.md), [EEM-6](https://github.com/Evirion/evirion-engineering-memory/blob/b23f6ba2b11f583b61200cec63500a782992f1f0/docs/plans/active/eem-6-repository-entitlements-and-github-control.md), [EEM-7](https://github.com/Evirion/evirion-engineering-memory/blob/b23f6ba2b11f583b61200cec63500a782992f1f0/docs/plans/active/eem-7-paid-call-authorization-and-customer-operations.md) and [EEM-8](https://github.com/Evirion/evirion-engineering-memory/blob/b23f6ba2b11f583b61200cec63500a782992f1f0/docs/plans/active/eem-8-customer-safe-api-review-and-lifecycle.md), because it migrates the whole package |
| `/02` | [EEM-4](https://github.com/Evirion/evirion-engineering-memory/blob/b23f6ba2b11f583b61200cec63500a782992f1f0/docs/plans/active/eem-4-customer-access-and-tenant-isolation.md) |
| `/03` | [EEM-6](https://github.com/Evirion/evirion-engineering-memory/blob/b23f6ba2b11f583b61200cec63500a782992f1f0/docs/plans/active/eem-6-repository-entitlements-and-github-control.md) |
| `/04` | [EEM-6](https://github.com/Evirion/evirion-engineering-memory/blob/b23f6ba2b11f583b61200cec63500a782992f1f0/docs/plans/active/eem-6-repository-entitlements-and-github-control.md) for repository/policy context and [EEM-7](https://github.com/Evirion/evirion-engineering-memory/blob/b23f6ba2b11f583b61200cec63500a782992f1f0/docs/plans/active/eem-7-paid-call-authorization-and-customer-operations.md) for import/paid-state commands |
| `/05` | [EEM-8](https://github.com/Evirion/evirion-engineering-memory/blob/b23f6ba2b11f583b61200cec63500a782992f1f0/docs/plans/active/eem-8-customer-safe-api-review-and-lifecycle.md) |
| `/06` | [EEM-4](https://github.com/Evirion/evirion-engineering-memory/blob/b23f6ba2b11f583b61200cec63500a782992f1f0/docs/plans/active/eem-4-customer-access-and-tenant-isolation.md), [EEM-6](https://github.com/Evirion/evirion-engineering-memory/blob/b23f6ba2b11f583b61200cec63500a782992f1f0/docs/plans/active/eem-6-repository-entitlements-and-github-control.md), [EEM-7](https://github.com/Evirion/evirion-engineering-memory/blob/b23f6ba2b11f583b61200cec63500a782992f1f0/docs/plans/active/eem-7-paid-call-authorization-and-customer-operations.md) and [EEM-8](https://github.com/Evirion/evirion-engineering-memory/blob/b23f6ba2b11f583b61200cec63500a782992f1f0/docs/plans/active/eem-8-customer-safe-api-review-and-lifecycle.md) for members, GitHub/offboarding, processing/retry and read/metrics contracts |
| `/07`–`/10` | all four plans and their exact merged contract/evidence digests |

### Accepted Obsidian package

Before `EEM-9/01` migrates the accepted package into the Dashboard repository,
use these links. Each entry also records a vault-relative fallback that an agent
can resolve under the active `Obsidian Vault` without publishing a local user
path.

- [Open product requirements in Obsidian](obsidian://open?vault=Obsidian%20Vault&file=10%20Evirion%2F01%20Products%2FEEM%20-%20Design%20Partner%20Console%20requirements.md)
  Vault-relative fallback: `10 Evirion/01 Products/EEM - Design Partner Console requirements.md`
- [Open architecture in Obsidian](obsidian://open?vault=Obsidian%20Vault&file=10%20Evirion%2FArchitecture%2FEEM%20-%20Design%20Partner%20Console%20architecture.md)
  Vault-relative fallback: `10 Evirion/Architecture/EEM - Design Partner Console architecture.md`
- [Open detailed implementation plan in Obsidian](obsidian://open?vault=Obsidian%20Vault&file=10%20Evirion%2FRoadmaps%2FEEM%20-%20Design%20Partner%20Console%20implementation%20plan.md)
  Vault-relative fallback: `10 Evirion/Roadmaps/EEM - Design Partner Console implementation plan.md`
- [Open OWASP audit and threat model in Obsidian](obsidian://open?vault=Obsidian%20Vault&file=10%20Evirion%2FArchitecture%2FEEM%20-%20OWASP-%D0%B0%D1%83%D0%B4%D0%B8%D1%82%20%D0%B8%20%D0%BC%D0%BE%D0%B4%D0%B5%D0%BB%D1%8C%20%D1%83%D0%B3%D1%80%D0%BE%D0%B7.md)
  Vault-relative fallback: `10 Evirion/Architecture/EEM - OWASP-аудит и модель угроз.md`
- [Open launch and operations runbook in Obsidian](obsidian://open?vault=Obsidian%20Vault&file=10%20Evirion%2FArchitecture%2FEEM%20-%20%D0%9F%D0%BE%D0%BB%D0%BD%D1%8B%D0%B9%20runbook%20%D0%B7%D0%B0%D0%BF%D1%83%D1%81%D0%BA%D0%B0%20%D0%B8%20%D1%8D%D0%BA%D1%81%D0%BF%D0%BB%D1%83%D0%B0%D1%82%D0%B0%D1%86%D0%B8%D0%B8.md)
  Vault-relative fallback: `10 Evirion/Architecture/EEM - Полный runbook запуска и эксплуатации.md`

If the URI handler is unavailable, locate the vault without publishing a
machine-specific path: use a session-local `OBSIDIAN_VAULT_ROOT` when provided,
otherwise inspect Obsidian's configured vault registry or use the file-search/
Glob tool under `$HOME` for the exact filenames above. All five files must
resolve under one unique vault root; zero or multiple roots is a blocker. Never
copy the discovered absolute root into repository docs, commits, logs or
evidence.

`EEM-9/01` copies the first three notes, including immutable requirement and
acceptance identifiers, into source-controlled Dashboard docs and records their
digests. After that paired subtask merges, the Dashboard copies become the
portable detailed execution authority; those three Obsidian notes become a
human-readable parity check. The OWASP note and operations runbook are not part
of that transfer: they remain mandatory security/operations sources for
`EEM-9/07–10` until an explicit migration or source-controlled pointer replaces
them. Repository docs own implementation/deployment state at all times.

If a mandatory note cannot be opened from either location, or its accepted
contract conflicts with the portable program design or an active plan, stop
before editing and resolve the authority mismatch. Do not choose one silently.

### Task-specific reading map

| Subtask | Mandatory accepted-package sections |
|---|---|
| `EEM-9/01` | All sections of the requirements, architecture and implementation-plan notes; all OWASP and operations sections as retained gate sources. Requirements Sections 10 and 17–20 plus architecture Sections 1, 18, 20 and 28 are focus highlights, not a reduced acceptance map |
| `EEM-9/02` | Requirements Sections 8, 10, 11.1, J-001, J-008 (final-owner/invite invariants only; Members UI remains `/06`) and NFR-SEC-001–004; architecture Sections 6–9, 21–22; implementation tasks C01–C02 |
| `EEM-9/03` | Requirements GH-001–004, ENT-001–006, REPO-001/002/004 and J-002, J-003, J-009; architecture Sections 10.1–10.3, 11, 13 and 17; implementation task C03 |
| `EEM-9/04` | Requirements Section 11.5 and J-004, J-010; architecture Sections 10.3.1, 14, 16.4 and 17; implementation task C04 |
| `EEM-9/05` | Requirements Sections 11.6–11.9 and J-005–J-006; architecture Sections 10.4–10.8, 12, 14–16 and 19; implementation task C05 |
| `EEM-9/06` | Requirements REPO-003, Sections 11.10–11.14, 15.0 and J-007–J-011; architecture Sections 14, 16, 21 and 23–24; implementation task C06 |
| `EEM-9/07` | Requirements Section 16; architecture Sections 27 and 30; implementation task I01; OWASP note Sections “Открытые High blockers” and “Открытые Medium decisions”; runbook Sections 13, 28, 32 and 37–40 |
| `EEM-9/08` | Requirements BR-005–BR-007, Sections 11.5 and 11.13; architecture Sections 10.3.1 and 16.4; implementation task I02; runbook “Approve paid phase”, “Canary rule”, Sections 30–31 and 38 |
| `EEM-9/09` | Requirements Sections 15.1 and 16; architecture Sections 25–28; implementation task I03-A; OWASP “Открытые High blockers” and “Открытые Medium decisions”; runbook Sections 32, 38 and 40 |
| `EEM-9/10` | Requirements Section 15.2 plus J-001–J-011 as applicable to the approved partner scope; implementation task I03-B; OWASP “Открытые High blockers” and “Открытые Medium decisions”; runbook “Approve paid phase”, Sections 30–32, 38 and 40 |

At task start, record the exact sections read and map every owned requirement
and acceptance row to a test or explicit non-applicability reason. A link alone
is not evidence that the contract was reviewed.

## Fixed Console technology and authentication contract

### Technology baseline

- Dashboard repository: `evirion-engineering-memory-dashboard`.
- Framework: Next.js App Router with TypeScript strict mode and source under
  `src`; no experimental prerelease feature.
- Package management: Corepack plus pnpm, pinned Node and pnpm versions, and a
  committed frozen lockfile.
- Authentication: Supabase Auth behind a per-request server-only BFF session
  client. Access/refresh tokens are held only in host-scoped `__Host-` cookies
  with `HttpOnly; Secure; SameSite=Lax; Path=/` and no `Domain`; browser
  JavaScript never initializes a session-bearing Supabase client.
- Rendering: server-first protected pages; client components are limited to
  forms, filters and bounded polling.
- Contract consumption: generated TypeScript types and runtime validators from
  the exact signed backend contract digest. Handwritten duplicate API types are
  forbidden.
- Long-running state: bounded polling with backoff in Alpha. Supabase Realtime
  is not a prerequisite.
- Verification: Vitest/component tests, Playwright, accessibility checks,
  contract tests, lint/typecheck/build, dependency audit, SAST, secret scan and
  the staged DAST gate defined below.

`EEM-9/01` pins exact stable versions after checking supported releases. An
implementer must not guess dependency versions from this planning repository.

### Supabase Auth and membership flow

1. Alpha is invite-only and uses Supabase Auth email OTP plus TOTP MFA only.
   Magic links are excluded: Supabase Admin invitations do not support PKCE,
   and Alpha does not place any authentication or invitation token in a URL.
2. The Auth provider allowlist is email OTP plus TOTP MFA only.
   Anonymous sign-in, password signup/login, phone login, social/OAuth, SSO and
   manual identity linking remain disabled unless a later accepted threat-model
   amendment assigns their configuration, recovery and tests.
3. Public signup is disabled in both version-controlled local Auth config and
   hosted Supabase configuration. Passwordless sign-in sets
   `shouldCreateUser = false`; an unknown user cannot create an account.
   Local and expected-hosted email templates are source-controlled and
   canonical-digested: they contain `{{ .Token }}` and no `ConfirmationURL`,
   `TokenHash` or credential-bearing link. Synthetic mailbox evidence verifies
   the exact subject/body, OTP expiry/resend policy and redirect allowlist.
4. Owner/Admin creates a durable invitation through the backend customer API.
   A server-only backend control path idempotently pre-provisions the Auth user
   without a password, with `email_confirm = false`, and without authorization
   metadata, then sends an OTP with `shouldCreateUser = false`; successful
   provider user creation alone never activates membership or proves email
   ownership. An existing Auth user is reusable only when its exact email
   identity matches the frozen Alpha provider/identity contract; unsupported
   or linked identities fail final without relinking or membership mutation.
5. The invitee submits email plus OTP to a same-origin BFF route. The BFF calls
   `verifyOtp` server-side, then calls idempotent backend session bootstrap with
   the exact access token plus a short-lived one-time BFF-signed proof bound to
   token/request/session/pre-auth state. Existing active membership registers
   the verified session. Exactly one eligible invitation may auto-select;
   multiple eligible rows return post-auth bounded organization labels plus
   opaque IDs and require explicit signed selection. The selected matching live
   invitation atomically registers the session and activates membership. The
   BFF stores tokens only in host-
   scoped `__Host-` cookies with
   `HttpOnly; Secure; SameSite=Lax; Path=/` and no `Domain`, clears OTP form
   state, and redirects with `303` to a clean allowlisted URL. Transient post-
   OTP bootstrap failure can retry only through that BFF cookie; terminal
   denial clears it. Every other API denies an unregistered session. OTPs/
   tokens never enter application URLs, browser storage, logs, analytics or
   third-party requests.
   Successful OTP verification may reconcile only the same current invitation
   generation whose send effect is `OUTCOME_UNKNOWN`; acceptance atomically
   records `DELIVERED_BY_VERIFICATION`. A resend/revoke/expiry fence makes the
   old code ineligible even if the provider verifies it. Lost `verifyOtp`
   response records terminal `VERIFY_OUTCOME_UNKNOWN` for that pre-auth
   generation: no automatic verify retry occurs, any provider session remains
   unregistered/denied, and explicit cooldown-bound resend starts a new
   generation.
6. Every protected request creates a request-local server session client. It
   reads the exact access token only from the `HttpOnly` session cookie and
   validates it online with `getUser(accessToken)` before forwarding. The
   backend repeats online `getUser(accessToken)` validation for every directly
   callable Console API request, allowlists algorithm/issuer/audience, validates
   expiry and `session_id`, handles JWKS rotation, and fails closed without
   mutation when Auth is unavailable. Both require non-anonymous verified email
   identity and the P01-frozen email-OTP/TOTP `amr`/provider combinations;
   unsupported existing identities or configuration drift deny. It also
   requires the private application-
   session row registered by the BFF login bootstrap to remain `ACTIVE`; a
   provider-valid but unknown/revoked/expired `session_id` is denied.
   `session.user`, user/app metadata and navigation state are never
   authorization facts.
7. The backend resolves live `organization_memberships` and capabilities for
   every operation. Disabling a membership takes effect even while an old JWT
   remains cryptographically valid.
8. The selected organization is only a navigation preference. Every backend
   path contains an explicit organization target and re-derives tenant access
   from trusted relationships.
9. Owner/Admin and every Evirion operator session require TOTP MFA and backend-
   enforced `aal2` before privileged mutations. Factor enrollment, challenge,
   verification, unenrollment and lost-factor recovery are explicit audited
   flows; UI-only AAL checks are never sufficient. Factor enroll/unenroll/
   recovery forces token refresh and current/next AAL comparison; stale `aal2`
   moves the application session to `REAUTH_REQUIRED`.
   First TOTP enrollment is the sole exception to prior full reauthentication:
   it starts from the freshly email-OTP-verified AAL1 session and grants no
   privileged capability until enrollment challenge/verify plus refreshed
   current/next AAL proves `aal2`. Later add/replace/unenroll uses the
   P01-frozen full reauthentication ceremony.
10. `EEM-9/01` freezes the threat model and exact JWT lifetime, inactivity,
    absolute-session, concurrent-device and recent-reauthentication thresholds
    supported by the selected Supabase plan before Auth code starts. Refresh-
    token reuse detection remains enabled. Logout supports current-session and
    all-session revocation; membership disable/offboarding remains the immediate
    backend deny even before token expiry. Users can view their active sessions
    and, after recent reauthentication, terminate one, all others or all.
    Application-session denial commits before supported provider sign-out
    reconciliation; a provider access token can remain valid until `exp` but
    cannot regain customer API/RPC authorization.
    Mapping is `current→local`, `others→others`, `all→global`; a selected
    non-current session is application-only and records provider
    `NOT_APPLICABLE`.
    Post-dispatch sign-out response loss records `OUTCOME_UNKNOWN` while
    application denial remains committed. Reconciliation observes provider
    state before any bounded retry; without a provider-supported safe
    observation/idempotency contract it becomes a manual incident, never
    restored access.
    Database time owns inactivity/absolute expiry. Only an allowlisted
    versioned API/RPC transaction that completes both session and domain
    authorization may touch activity, after those checks and before commit.
    Asset/prefetch/non-activity polling, denied/Auth-outage requests and the
    interim compatibility-view RLS guard do not touch `last_seen_at`. Expiry is
    checked before a coalesced update; a terminal provider `session_id` cannot
    bootstrap again.
11. Alpha has no password reset. Email change, compromised-email recovery and
    lost-MFA recovery are not self-service bypasses: they use a separately
    authenticated AAL2 operator/support state machine with claimant proof,
    approval, notification/cooldown, final-owner guard, factor reset and
    payload-free audit. MFA/email changes require recent full
    reauthentication and revoke other sessions after success. Admin factor
    deletion revokes affected application sessions before its global provider
    effect; response loss records `RESET_OUTCOME_UNKNOWN` and requires observed
    factor/session state before retry. Recent reauth is a one-time
    application challenge bound to session/action, fresh email-OTP+TOTP,
    nonce/times and consumed version; provider `reauthenticate()` alone is not
    reusable evidence. P01 must freeze the supported same-session or
    replacement-session ceremony before Auth code. TOTP QR/raw seed is one-time
    no-store browser material excluded from RSC/router cache, prefetch,
    analytics, logs and error capture.
12. The BFF alone refreshes Supabase sessions and rotates `HttpOnly` cookies.
    No browser component receives an access/refresh token or uses a
    session-bearing Supabase client. This is the fixed ASVS V10.1.1 BFF
    boundary. Concurrent refresh and lost-response handling preserve exact
    session ownership and remain within the provider's bounded refresh-reuse
    contract; stale/replayed refresh material cannot replace another session's
    cookies. Deterministic chunking preserves `__Host-` attributes, rotation/
    logout clears stale chunks, and state above the P01-frozen browser/proxy
    cookie/header budget fails closed.
13. Authenticated routes and every nonce/pre-auth/Auth/MFA/recovery response are
    force-dynamic in Alpha and use no application, Next.js data, ISR, router or
    CDN cache. Auth/session fetches use `cache: "no-store"`;
    the response applies all refresh/cookie/cache headers supplied by the
    selected server Auth adapter; hosting minimum TTL is zero/disabled for
    these routes;
    no Supabase client or user/tenant state exists at module scope.
14. All state-changing BFF routes and Server Actions require a 256-bit
    HMAC-signed double-submit CSRF token. OTP request/verify/bootstrap selection
    bind it to a short-lived pre-auth transaction, canonical host/origin, HMAC
    email identity, nonce, attempt generation and expiry. Successful bootstrap
    consumes that state and rotates to a proof bound to live `session_id`.
    Exact production Origin/canonical Host, `Sec-Fetch-Site: same-origin`,
    `application/json` or an explicitly allowlisted form encoding, trusted-
    proxy normalization and deny-by-default CORS apply in both states. Rotate
    again at privilege/factor change and logout; reject stale proof after
    session termination. Durable command idempotency remains separate.
15. Direct Auth abuse controls freeze OTP expiry/resend cooldown, per-IP and
    per-email quotas, generic anti-enumeration responses, CAPTCHA/risk control
    or an approved equivalent, lockout recovery and alert thresholds. Local and
    hosted settings plus direct Auth endpoints are parity-tested.

The customer roles are `Owner`, `Admin`, `Reviewer` (the existing database role
`member`) and `Viewer`. Navigation may hide unavailable actions for usability,
but the backend capability check is always authoritative. Direct route/action
calls must remain denied.

## UI and backend interaction contract

### Required UI areas

| Owner | Minimum customer-visible areas and behavior |
|---|---|
| `EEM-9/02` | Sign-in, invite acceptance, protected shell, onboarding entry, organization switcher and capability-aware navigation |
| `EEM-9/03` | GitHub connection/sync, repository list/detail, access-versus-entitlement-versus-policy state, activation/change request and allowed policy controls |
| `EEM-9/04` | Historical import range, prepare/consent, operational-authorization waiting state, progress, terminal outcome and cost completeness |
| `EEM-9/05` | Memory queue, filters/pagination, knowledge/evidence detail, review history/actions, lifecycle, supersession and correction-request status |
| `EEM-9/06` | Processing list/detail, PR detail, repository counters, members, GitHub/usage settings, offboarding request/status and Alpha metrics |

`EEM-9/01` freezes exact App Router paths from requirements Section 10:
`/auth/*`, `/onboarding`, `/repositories`,
`/repositories/:repositoryId`, `/repositories/:repositoryId/import`,
`/repositories/:repositoryId/memory`, `/memory`,
`/memory/:knowledgeObjectId`,
`/repositories/:repositoryId/pull-requests/:prNumber`, `/processing`,
`/settings/members`, `/settings/github` and `/settings/usage`, plus
same-origin BFF `api` routes. Domain components do not call Supabase or the
backend directly.

Every page must implement loading, empty, available, forbidden/not-found,
conflict/stale, retryable, non-retryable and unknown-state behavior applicable
to its contract. Discriminated unions are handled exhaustively with a
compile-time `never` check and a runtime fail-closed unsupported-state response.
An unavailable aggregate is not rendered as zero. `REJECTED` and
`QUARANTINED` are not rendered as trusted Knowledge Objects.

### Browser → BFF → backend flow

1. The browser submits only allowlisted view/form data to a same-origin Next.js
   BFF route or server action. Mutation requests carry CSRF proof.
2. The BFF validates path, query and body with the generated runtime schema,
   creates the request-local server session client, reads the exact access
   token from the server-only `HttpOnly` cookie, and validates it online with
   `getUser(accessToken)` without trusting cached session/user metadata.
3. The BFF sends the token to the versioned backend Console API with the
   explicit organization path, a canonical `Idempotency-Key`, relevant
   `expected_*_version` values and a bounded correlation ID.
4. The backend independently validates the exact token online, derives actor
   identity, then begins the guarded transaction at the verified application-
   session rank 1a before platform-operator/membership/domain ranks. It resolves
   live membership, derives tenant ownership from trusted relations and checks
   the exact capability. Auth validation failure/unavailability is a no-side-
   effect bounded deny, not a stale-token fallback.
5. The backend writes the domain event/audit/receipt and returns only the
   customer-safe projection or bounded stable error.
6. The BFF maps that stable code to safe UI copy and status. It never forwards
   raw SQL, Supabase, GitHub, worker or provider errors.
7. The UI shows pending state while the request runs, but claims success only
   from the committed receipt/projection. It then revalidates the exact
   organization resource. Background work uses bounded polling and stops on a
   terminal state or when the page is no longer active.

The BFF may aggregate customer-safe API reads, but may not:

- use a Supabase service-role key or database DSN for customer operations;
- authorize from caller-supplied role, organization or capability data;
- read/write `core` directly or bypass RLS;
- hold GitHub installation or model-provider secrets;
- inspect raw Source Envelopes/model responses;
- call the model provider or mint worker claims/leases;
- turn a customer consent action into Evirion operational authorization.

All mutations preserve durable command idempotency. Duplicate same-key/same-
payload requests return the stored receipt; same-key/different-payload requests
return the stable conflict without a domain side effect. Optimistic version
conflicts reload the committed projection and require a deliberate resubmit.

## OWASP and security acceptance matrix

The target is OWASP ASVS v5 Level 2, using OWASP Web Top 10, API Security Top 10
and LLM/GenAI Top 10 as threat catalogs. This is a verification target, not a
certification claim. `EEM-9/09` cannot declare Technical Design Partner Ready while an
applicable Critical/High finding remains open, a required ASVS row remains
failed/not-tested/deferred-blocking, or independent retest evidence is missing.

| Stable row | Threat/control family | Required prevention | One primary owner/evidence | Secondary contributors |
|---|---|---|---|---|
| `SEC-WEB-001` | Broken access control, BOLA/IDOR and BFLA | Live membership, explicit organization path, trusted resource-tenant derivation, capability check, indistinguishable foreign/missing `404`, no caller-supplied authority | Dashboard `EEM-9/07`: `tests/security/tenant-capability-matrix.spec.ts` | Backend tenant suites and `/02–06` direct route/action tests |
| `SEC-WEB-002` | Authentication/session failure | Invite-only email OTP, disabled providers/signup, server-only `HttpOnly` session, idempotent application-session bootstrap/registry, online exact-token validation in BFF and backend, TOTP/AAL2, immediate application revocation, provider reconciliation and recovery/final-owner guards | Dashboard `EEM-9/02`: `tests/security/auth-session-recovery.spec.ts` | Backend `EEM-4/03`; hosted/local parity in `/07` |
| `SEC-WEB-003` | CSRF and replay | Pre-auth-transaction- then live-session-bound HMAC double-submit proof, exact Origin/Host/Fetch-Metadata/content type, trusted-proxy normalization; durable idempotency remains separate | Dashboard `EEM-9/02`: `tests/security/csrf-origin.spec.ts` | Every later mutation surface reuses the shared harness |
| `SEC-WEB-004` | Injection, XSS and unsafe rendering | Generated runtime validation, contextual React text rendering, no raw HTML/Markdown/`dangerouslySetInnerHTML`, strict URL allowlists and bounded inputs | Dashboard `EEM-9/07`: `tests/security/xss-corpus.spec.ts` | `/02–06` component/Playwright corpus and Semgrep |
| `SEC-WEB-005` | SSRF, open redirect and external-resource abuse | Backend-owned outbound calls, fixed destinations, clean same-origin redirects and validated HTTPS GitHub links | Dashboard `EEM-9/02`: `tests/security/redirect-url-boundary.spec.ts` | `/03–06` link negatives and `/07` DAST |
| `SEC-WEB-006` | Misconfiguration, cache leakage, CSP and clickjacking | Per-response CSPRNG nonce with `strict-dynamic`, no `unsafe-inline`/`unsafe-eval`, nonce/header binding, `frame-ancestors 'none'`, HSTS/referrer/permissions policies, force-dynamic/no-store and zero authenticated hosting TTL | Dashboard `EEM-9/02` C01: `tests/security/headers-cache-isolation.spec.ts` | C02 session/pre-auth cases and `/07` deployed cache/header evidence |
| `SEC-WEB-007` | Vulnerable dependencies and supply chain | Pinned Node/pnpm/lockfile and registry, full-SHA Actions, deny-by-default install scripts with reviewed build allowlist, lockfile/manifests consistency, dependency-diff review, SBOM/provenance and verified-digest tools | Dashboard `EEM-9/02` C01: `tests/contract/supply-chain-policy.test.ts` plus CI policy checks | `/07` exact-tree recertification |
| `SEC-WEB-008` | Sensitive data, diagnostics and secret exposure | Browser env allowlist; no privileged secret/raw payload; redacted logs; no production source maps, debug overlays/routes, diagnostics or internal API docs; protected upload only if source maps are required operationally | Dashboard `EEM-9/07`: `tests/security/release-surface.spec.ts` | `/02–06` fixture/DOM/log checks and Gitleaks |
| `SEC-WEB-009` | Unbounded resources, Auth abuse and enumeration | Body/query/page/range/poll bounds; endpoint/user/organization rate limits; OTP expiry/resend, IP/email quotas, CAPTCHA/risk equivalent, generic responses and alerts | Dashboard `EEM-9/07`: `tests/security/abuse-bounds.spec.ts` | Direct Auth tests in `/02`; feature bounds in `/03–06` |
| `SEC-WEB-010` | Unsafe business/paid workflow | Backend-authoritative entitlement/policy/consent, distinct Evirion authorization, final pre-provider gate, no customer paid-authorize control, checkpoint before validation | Backend `EEM-9/07`: `test_console_free_business_logic_live.py` | Dashboard `/04`/`/06` negatives; separately approved `/08` proof |
| `SEC-WEB-011` | Logging, monitoring, privacy and repudiation | Correlation IDs, payload-free security events, durable audit/receipts, no token/source/provider payload in logs, bounded retention and incident ownership | Backend `EEM-9/07`: `test_console_security_events_live.py` | Dashboard log assertions and `/09–10` operational evidence |
| `SEC-WEB-012` | DAST, manual test and release evidence | Non-pentest prerequisites first; authenticated manual Auth/session/CSRF/authorization/business-logic charter; baseline plus authorized authenticated DAST; independent full-platform pentest including Console/BFF/Auth and closure retest before readiness | `EEM-9/09`: accepted independent report, closure retest and security-owner decision | Dashboard/backend `/07` charter, DAST and full-scope pentest-entry package |

Security gates are cumulative:

- `EEM-9/01` creates a Console-specific ASVS v5 Level 2 evidence matrix for
  every applicable V1, V3, V4, V6–V10 and V12–V16 row, with one owner,
  test/evidence reference, environment, verifier and applicability rationale;
  the existing backend matrix explicitly excludes the future UI and is not a
  substitute;
- every feature subtask runs focused tenant, capability, CSRF, XSS/payload,
  idempotency and accessibility tests for its changed surface;
- CI runs strict lint/typecheck/build, dependency audit, Semgrep SAST and
  verified Gitleaks scanning;
- `EEM-9/07` runs the complete free integration/security suite plus
  digest-pinned authenticated OWASP ZAP DAST against an authorized isolated
  staging deployment. It first passes all non-pentest UI prerequisites, then
  executes the assigned manual Auth/session/authorization/CSRF/business-logic
  charter and produces the entry package for the existing independent full-
  platform scope, now including Console/BFF/Auth;
- `EEM-9/09` requires closure and independent retest of all applicable
  Critical/High findings, evidence-backed `pass` or `not-applicable` for every
  required ASVS row, rollback proof and
  incident/operations readiness. Do not label the system OWASP- or
  ASVS-certified unless a separate certification actually exists.

### Security blocker ownership

| Existing finding/gate | Planning owner | Required release evidence |
|---|---|---|
| `SEC-2026-002` independent penetration test | External security owner; tracked by `EEM-9/09` | Full registered platform report including Console/BFF/Auth plus closure retest for every applicable Critical/High; Console-only evidence cannot close it |
| `SEC-2026-003` incomplete ASVS L2 evidence | Application/security owners across `EEM-9/02–07`; final decision in `/09` | No required control remains failed, not-tested or deferred-blocking |
| `SEC-2026-004` managed backup/PITR/restore | Backend platform operations; readiness gate `/09` | Managed configuration evidence and isolated restore with measured RPO/RTO |
| `SEC-2026-005` provider DPA/no-training/retention/residency | Legal/security; prerequisite for `/10` external provider use | Executed DPA and account-level setting/residency evidence |
| `SEC-2026-006` workload identity/secrets/egress | Backend platform operations; `/07` staging and `/09` release disposition | Approved secret manager/workload identity and deny-by-default egress test for the target environment |
| `SEC-2026-009` Auth/MFA/session certification | EEM-4/03, `EEM-9/02`, integrated in `/07`, signed off in `/09` | ASVS V6–V10 evidence plus authenticated DAST and recovery/session tests |
| `SEC-2026-010` semantic-claim correctness before an external trusted write | Product/security policy implemented by EEM-8/01–03; hard prerequisite for `/10` | External-partner objects remain `UNRESOLVED` and excluded from active/trusted retrieval until eligible human review plus explicit activation; product/security closure and tests required |
| `SEC-2026-012` branch protection/security ownership | Both repository administrators; bootstrap `/01`, verify `/09` | Protected defaults, required checks/reviews and security CODEOWNERS evidence |

The current findings register remains authoritative for severity, status,
external owner and deadline. This table assigns future EEM work; it does not
close or downgrade any finding. Medium findings require owner, deadline,
compensating control and signed risk acceptance where the register permits it.

## Program ordering

1. EEM-3 completes and free staging recertifies semantic/runtime provenance.
2. EEM-9/01 creates the Dashboard repository authority.
3. EEM-4 freezes Auth/customer/tenant contracts.
4. EEM-9/02 implements the secure shell while EEM-6 may proceed.
5. EEM-6 freezes repository/GitHub/free-path contracts; EEM-9/03 follows.
6. EEM-7 freezes paid/customer-operation contracts; EEM-9/04 follows.
7. EEM-8 freezes review/lifecycle/read contracts; EEM-9/05 and EEM-9/06 follow.
8. EEM-9/07 performs paired free integration.
9. EEM-9/08 performs one separately approved paid certification.
10. EEM-9/09 evaluates Technical Design Partner Ready without real partner data.
11. EEM-9/10 runs the separately approved first-design-partner outcome.

EEM-5 or equivalent source-runtime deployment must be freshly observed after
EEM-6/04. If EEM-7 changes a shared image/startup/config digest, redeploy and
observe it again; otherwise record exact non-invalidation evidence.

## Contract publication

- Backend publishes immutable `contracts/console/v1` and
  `contracts/operator/v1` artifacts as a retained signed private Release asset
  tagged `console-contract-v<semver>`, with SHA-256 and build/source
  provenance. Mutable `main` bytes are not a release contract.
- Dashboard stores the expected release tag and digest in a contract lock and
  generates both types and runtime validators from exactly those asset bytes.
- “Signed” means an artifact attestation verified against a frozen trust policy:
  subject digest, `Evirion/evirion-engineering-memory`, protected signer
  workflow path/ref/commit and expected issuer identity. P01 verifies whether
  GitHub keyless artifact attestations are available; if not, implementation is
  blocked until security accepts an equivalent scheme and key custody/
  rotation/revocation policy. A SHA-256 or mutable tag alone is insufficient.
- Download uses a least-privilege short-lived GitHub App/OIDC credential;
  mutable/replaced asset, wrong repository/workflow/ref/issuer, stale
  attestation or unpinned verifier fails closed.
- CI fails on digest drift, undocumented endpoint use, breaking backend change,
  or generated-client drift.
- Browser/BFF responses use only documented customer-safe fields and stable
  error/recovery envelopes.

## Sequential delivery

Every subtask below inherits the mandatory reading map, fixed technology/Auth
contract, browser/BFF/backend flow and OWASP matrix above. Its PR description
must list the owned requirement/acceptance IDs, security rows, verification
commands and exact contract digest. Missing inherited evidence means the
subtask is not done even when its local feature bullets pass.

### EEM-9/01 — `EEM-9/01-dashboard-repo-bootstrap` (`P01`)

**Purpose:** establish Dashboard repository governance and move the accepted
package into version control before implementation.

**Prerequisites:** EEM-3 is merged and free staging-recertified; the accepted
Obsidian package is readable; access to the existing
`Evirion/evirion-engineering-memory-dashboard` repository is confirmed. The
expected initial tree is product-empty or near-empty; preserve its `LICENSE`,
governance and any other pre-existing non-product files.

**Scope:**

- clone/initialize the existing organization repository without replacing its
  history or pre-existing files, then open it as the primary Cursor workspace
  before any Dashboard-owned edit;
- make `.idea/` exclusion in `.gitignore` the first Dashboard edit and do not
  commit local IDE metadata;
- migrate accepted requirements, architecture, implementation plan, acceptance
  map, source-disposition matrix, this EEM-9 plan, its task-specific reading
  map and the `/01`–`/10` copy-ready Start/Plan catalog;
- create Dashboard `AGENTS.md`, current-state/roadmap/ADR indexes following the
  repository's own conventions;
- record the accepted 2026-08-25 decision and immutable requirement acceptance
  IDs;
- pin project/runtime/package/toolchain choices from current supported releases;
- freeze public keyless Sigstore/Fulcio plus Rekor contract-artifact
  attestation and verifier trust roots, signer repository/workflow/ref/commit/
  OIDC identity, subject digest, inclusion proof, short-lived download
  identity and replacement/revocation procedure before publishing any
  consumable artifact. Never sign or upload secret/customer/source payload;
  keep the GitHub Free governance-enforcement waiver `SEC-2026-012` explicit
  and blocking for readiness;
- freeze the Supabase Auth threat model, email-OTP invitation flow,
  server-only `HttpOnly` session boundary, MFA/AAL2 policy, JWT `15m`,
  visible-tab human-activity idle `30m`, warning `5m`, touch `1m`, absolute
  session `8h`, maximum three sessions with oldest replacement notice,
  one-time dangerous-operation reauthentication `10m`, OTP `10m`, resend
  cooldown `60s`, return to the authorized Knowledge route without mutation
  replay, recovery/revocation rules, Auth abuse limits, CSRF contract,
  canonical origin/trusted-proxy/TLS model, local HTTPS test harness and
  hosting cache policy before Auth code. Assets, prefetch, polling, untouched
  tabs and token refresh do not count as human activity;
- create the Console-specific ASVS v5 Level 2 evidence matrix and assign each
  applicable row to one owner/test/environment/verifier;
- in a paired backend PR, rerun and pin the merged EEM-3/13 recursive
  function/trigger/FK/advisory/recheck attestation and reject any digest or
  rank drift rather than rewriting the manifest to accept it; then replace
  this temporary plan at the same path with
  a durable bootstrap pointer pinned to the Dashboard commit/digest. The pointer
  retains the authority locator, Obsidian URI/fallback list, task→reading-map
  locator and copy-ready catalog locator; paired updates change backend
  `AGENTS.md`, docs indexes, handoff and roadmap to follow it. A
  machine-readable manifest records repository, commit, path and digest.

**Exclusions:** UI/runtime scaffold, Supabase project mutation, deployment,
provider call, and customer data.

**Merge order:**

1. Dashboard `EEM-9/01-dashboard-repo-bootstrap`;
2. backend `EEM-9/01-dashboard-repo-bootstrap` pointer/global-lock attestation.

**Definition of Done:**

- every requirement acceptance row has a stable ID and one primary B/C/I owner;
- migrated Dashboard links are repository-relative; retained OWASP/runbook
  references use verified Obsidian URIs plus vault-relative fallbacks and no
  local absolute user path;
- downloaded source plan is preserved only as historical input and every
  adopted/modified/rejected row has disposition;
- migrated requirements, architecture and implementation plan retain working
  links back to the accepted Obsidian package and record source digests;
- the Console-specific ASVS matrix resolves V10.1.1 through the server-only
  `HttpOnly` BFF token boundary and has no unowned applicable row;
- contract attestation tests reject mutable tag/asset replacement, wrong repo/
  workflow/ref/issuer, stale evidence and an unpinned verifier; SEC-2026-012
  release-workflow protection evidence is recorded;
- repository rules forbid secrets, service role, raw payloads, generated
  outputs, and AI co-author trailers;
- backend pointer records the exact Dashboard package digest and its checker
  verifies the fetched authoritative files match at handoff;
- a new chat starting in either repository can follow the stable backend
  pointer or Dashboard catalog to the same numbered task, reading map and exact
  authority digest; no deleted-path instruction remains;
- EEM-9/01 is incomplete until Dashboard authority and the paired backend
  pointer/global-lock-attestation PR are both merged;
- all EEM-4 subtasks, including EEM-4/01, remain blocked until both EEM-9/01
  PRs merge and the lock attestation is non-contradictory;
- no runtime or remote state changes.

### EEM-9/02 — `EEM-9/02-auth-shell` (`C01` + `C02`)

**Purpose:** build the secure Console shell and invite-only Auth/onboarding UX
against frozen EEM-4 contracts.

**Prerequisites:** both EEM-9/01 PRs are merged; all EEM-4 subtasks are merged;
the verified attested EEM-4 contract artifact/digest and frozen Auth/session
decisions exist.
Hosted Supabase Auth/config changes require a separate exact remote
authorization; local scaffold/tests do not authorize them.

**Scope:**

- Next.js App Router strict TypeScript scaffold with pnpm lockfile;
- request-local server-only Supabase Auth client and `HttpOnly` session
  broker; browser code has no session-bearing Supabase client;
- email-OTP invitation acceptance, server refresh, active-session inventory,
  current/other/all-session logout and bounded error/recovery;
- TOTP enrollment/challenge/verification/unenrollment, AAL2 step-up for
  Owner/Admin, and guarded lost-factor/account recovery UX;
- organization context shell and capability-driven navigation;
- generated client/runtime schemas pinned to EEM-4 digest;
- per-response nonce CSP/security headers, exact CSRF/origin/proxy strategy,
  no-store private responses, redacted logs, direct-Auth abuse/rate/error UX;
- unit/component/Playwright/accessibility/security/secret/dependency gates.

**Exclusions:** member/settings/offboarding pages owned by EEM-9/06,
repository/import/knowledge features, service-role/operator credentials, direct
database access, deployment, and paid/provider work.

**Definition of Done:**

- missing/invalid public config fails server startup; secret-like
  `NEXT_PUBLIC_*` variables fail build/CI;
- unauthenticated routes redirect safely without open redirects;
- invitation accepted/revoked/expired/failed and disabled membership/session
  states render backend recovery;
- local Supabase Auth configuration and the source-controlled expected hosted
  manifest disable public signup; unknown user passwordless sign-in cannot
  create an account; anonymous/manual-linking/password/phone/social/SSO
  providers remain disabled. The shared email-OTP endpoint delivers the pinned
  `{{ .Token }}` code template and never a magic/confirmation link. `/07`
  proves synthetic-message and live hosted parity after its separate remote
  authorization;
- owner-issued invitation pre-provisions but does not authorize the Auth user;
  server-side `verifyOtp` proves email ownership, persists tokens only in
  host-only `__Host-` cookies with `HttpOnly; Secure; SameSite=Lax; Path=/`
  and no `Domain`, and clean-redirects with `303`;
- local browser/E2E uses the P01-pinned HTTPS origin/proxy harness and proves
  the same `__Host-`/`Secure` attributes as staging; no test/development branch
  weakens the production cookie contract;
- existing-member and invited-member session bootstrap, transient post-OTP
  retry, terminal cookie cleanup and direct unregistered-session bypass have
  positive/negative idempotency tests;
- zero/one/many invitation choices, post-auth opaque selection and concurrent
  revoke/expire/accept prove no pre-auth organization disclosure or order-based
  auto-selection;
- current-generation delivery `OUTCOME_UNKNOWN` plus successful OTP
  verification reconciles exactly once; post-resend/revoke/expire verification
  and lost `verifyOtp` response create no application session/membership and
  never trigger an automatic verification retry;
- valid provider bearer without BFF proof, wrong/retired signing key, expired or
  replayed proof, token/body/idempotency substitution and direct invocation of
  the private bootstrap route create no session/membership/invitation mutation;
- BFF and backend independently perform online exact-token `getUser` validation;
  wrong issuer/audience/algorithm/project, unknown/rotated key, expired/revoked/
  globally logged-out session, direct backend bypass and Auth outage fail
  closed without a domain side effect;
- anonymous flag, unsupported `amr`, password/phone/OAuth/recovery/linked
  identity and provider-configuration drift deny at bootstrap and protected
  requests; code-only template parity remains independently tested;
- provider-valid but unregistered/revoked/expired application `session_id`
  fails every BFF/API/RPC path; selected one/current/other/all revocation denies
  application access before supported provider sign-out reconciliation;
- provider scope mapping and selected-non-current `NOT_APPLICABLE` behavior are
  visible in bounded UX/audit; sign-out/factor-delete response loss remains
  immediate application deny with `OUTCOME_UNKNOWN` observation-before-retry
  and no endless/blind retry;
- TOTP/AAL2, active-session inventory, recent reauthentication, factor-change
  other-session termination, claimant proof, recovery approval/cooldown/
  notification and final-owner/privileged-action matrices pass backend plus
  Playwright negative tests;
- stale post-factor-change `aal2`, forced refresh/current-next AAL,
  `REAUTH_REQUIRED` and Admin delete-factor global-effect response loss have
  executable tests;
- first TOTP enrollment from fresh email-OTP AAL1 is tested separately from
  later add/replace/unenroll reauthentication, and no privileged action is
  available before refreshed current/next AAL proves `aal2`;
- reauth replay/session/action/expiry/factor-change mismatch and TOTP seed
  absence after navigation/prefetch/error/log capture have negative tests; P01
  ceremony fixtures prove the chosen provider-supported flow end to end;
- concurrent refresh, stale refresh reuse and lost-response tests preserve
  exact user/session ownership without cross-session cookie replacement;
- database-clock expiry/touch tests prove denied/Auth-outage/prefetch/assets/
  non-activity polling cannot extend or reactivate a session; retention cleanup
  preserves pending effects and audit;
- chunked-cookie rotation/logout clears every old `__Host-` chunk and
  over-budget cookie/response-header state fails closed;
- unchunked/chunk collision, missing/gapped/duplicate/reordered/corrupt/mixed-
  generation/excess/stale chunks and aggregate inbound/outbound deletion-header
  overflow clear bounded slots with no Auth/bootstrap/domain effect;
- per-response CSP nonces are unique across warm instances and bound to the
  matching enforced header; `unsafe-inline`/`unsafe-eval` are absent;
- session-bound CSRF, exact Origin/Host/Fetch-Metadata/content-type and trusted-
  proxy tests cover cross-site forms, sibling subdomains, malformed/null
  Origin, forged forwarded headers, Server Actions and stale post-logout proof;
- pre-auth CSRF tests cover OTP request/verify/selection, login CSRF, session
  swapping, replay, parallel tabs, stale generation and direct form posts;
- force-dynamic/no-store behavior, zero hosting TTL and no module-scope client/
  state cover nonce-bearing pre-auth/Auth/MFA/recovery plus authenticated
  responses and pass warm-instance Admin/Viewer/cross-tenant cache-leakage
  tests, including redirects/errors/304/RSC prefetch;
- direct Auth endpoint tests prove OTP expiry/resend/IP/email bounds, generic
  anti-enumeration behavior and approved CAPTCHA/risk equivalent;
- CI pins Actions to full SHAs, registry/runtime/package manager/lockfile,
  denies install scripts except a reviewed build allowlist, verifies dependency
  diffs/SBOM/provenance and rejects manifest/lock drift;
- production `.map` files, debug overlays/routes, diagnostics and internal API
  documentation return `404/403` unless a protected source-map upload channel
  is explicitly approved;
- UI never treats hidden navigation as authorization;
- Owner / Admin / Reviewer (database role `member`) / Viewer capability matrix
  has Playwright positive/negative coverage;
- BFF forwards token/idempotency/correlation/version but never service role or
  caller-supplied organization authority;
- C01 bootstrap and C02 Auth/onboarding remain separately reviewable phase
  commits/gates inside one coherent PR; both acceptance groups must pass.

### EEM-9/03 — `EEM-9/03-repository-control` (`C03`)

**Purpose:** expose GitHub setup, repository entitlement, and policy UX after
EEM-6 contract freeze.

**Prerequisites:** EEM-9/02 and all EEM-6 subtasks are merged; the immutable
attested EEM-6 contract artifact/digest is verified and pinned, and its
compatibility gate passes.

**Scope:**

- GitHub setup-intent redirect/callback/status and sync progress;
- accessible/entitled repository lists, capacity/slot state;
- activate/disable/request-change;
- `OFF`/`SOURCE_ONLY`/`AUTO_EXTRACT`, budget and consent controls;
- operator-managed/locked states;
- stale generation/version and concurrent slot conflict recovery.

**Exclusions:** member/settings/offboarding UI owned by EEM-9/06, historical
import, provider/paid authorization, backend policy decisions, and GitHub
credentials in browser/BFF state.

**Definition of Done:**

- no GitHub token/private key/setup state secret reaches browser/log;
- cross-tenant repository, installation, setup-intent and direct-action
  substitution return the bounded foreign/missing response without existence
  disclosure;
- UI cannot select entitlement source, capacity, replacement mode, generation,
  or operator decision;
- one-slot and disable race responses refresh from backend rather than
  optimistic local authority;
- duplicate commands, stale versions and every documented access × entitlement
  × policy state have exhaustive component/API/Playwright mappings;
- policy copy clearly distinguishes source work, customer consent, operational
  authorization, and paid execution;
- C03 journey/requirements pass component, Playwright and a11y coverage.

### EEM-9/04 — `EEM-9/04-import-operations` (`C04`)

**Purpose:** implement guarded historical import, approval, progress, cost, and
retry UX from EEM-7 contracts.

**Prerequisites:** EEM-9/03 and all EEM-7 subtasks are merged; immutable
attested EEM-6 and EEM-7 contract artifacts/digests are verified and pinned.
Fake/free transport is used until the separately approved EEM-9/08 paid gate.

**Scope:**

- `missing_only` filters/high-water mark and create command;
- consent/approval with explicit cost/operation explanation;
- progress by processed/accepted/rejected/quarantined/failed;
- `NOT_REQUIRED`, consent wait, Evirion authorization wait, authorized,
  expired, and revoked states;
- import-run/item recovery only when the EEM-7 import projection declares it;
  browser response-loss replay reuses the exact command receipt. Generic
  processing-job `PROC-002` Retry UI remains EEM-9/06 ownership.

**Exclusions:** direct provider/queue/worker/authorization access, arbitrary
reextract, client-derived retryability/cost, review/lifecycle UI, and paid
certification.

**Definition of Done:**

- browser/BFF never calls provider, queue, internal worker, or authorization
  endpoints;
- organization/repository/run IDs are tenant-substitution tested through the
  BFF and backend boundary;
- response-loss replay and import-specific recovery reuse the exact
  idempotency key/body and cannot duplicate an import; C04 does not render the
  generic processing-job Retry CTA;
- UI never maps unresolved cost to zero or rejected/quarantined to knowledge;
- no approve control appears unless backend capability permits it;
- operational authorization wait cannot be bypassed by customer consent;
- input ranges, polling cadence, response bodies and retry counts remain
  bounded under adversarial and duplicate-click tests;
- C04 journeys pass with fake backend contracts and integrated free backend.

### EEM-9/05 — `EEM-9/05-memory-review-lifecycle` (`C05`)

**Purpose:** deliver accepted-memory detail, evidence, review, and lifecycle UX
from the frozen EEM-8 contract.

**Prerequisites:** EEM-9/04 and all EEM-8 subtasks are merged; the immutable
attested EEM-8 contract artifact/digest is verified and pinned.

**Scope:**

- accepted Knowledge Object list/detail/evidence and review queue;
- approve/edit/reject/revert-to-original, review history and optimistic
  conflicts;
- activate/supersede/correction request/status;
- exact expected review/lifecycle/relation/request versions.

**Exclusions:** processing/settings/metrics/member/offboarding surfaces,
backend lifecycle inference, raw payloads, direct database access, and
deployment/certification.

**Definition of Done:**

- original versus edited value/evidence is visually and semantically distinct;
- every action forwards its exact optimistic-version set without local
  synthesis;
- knowledge, evidence, review, relation and correction IDs are cross-tenant and
  cross-organization substitution tested through direct BFF calls;
- rejected/quarantined runs never render as Knowledge Objects;
- unauthorized/sensitive fields are absent from fixtures, DOM, telemetry,
  errors, cache, and source maps;
- loading/empty/error/conflict/locked/operator-managed states pass unit,
  Playwright and accessibility checks;
- every C05 requirement/acceptance row has named UI evidence.

### EEM-9/06 — `EEM-9/06-processing-settings-metrics` (`C06`)

**Purpose:** deliver processing, settings, usage/cost, metrics, members, GitHub
status, and offboarding request/status UX from the frozen EEM-4/EEM-6/EEM-7/
EEM-8 contracts.

**Prerequisites:** EEM-9/05 and all EEM-8 subtasks are merged; immutable
attested EEM-4, EEM-6, EEM-7 and EEM-8 contract artifacts/digests are verified
and pinned.

**Scope:**

- repository/PR/processing activity and the sole generic processing-job
  `PROC-002` Retry/Resume/Support CTA mapping;
- usage and distinct cost states;
- consistent-cutoff review/lifecycle/admission metrics;
- member/settings capability surfaces, GitHub freshness, and offboarding
  request/status;
- operator-managed/locked and support/recovery states.

**Exclusions:** memory review/lifecycle actions, customer execution of
offboarding, client-computed metrics/cost/retryability, service-role/operator
credentials, and paid certification.

**Definition of Done:**

- unresolved/unknown cost is never rendered as zero or invoice authority;
- post-cutoff review/lifecycle fixtures do not alter the rendered earlier
  `asOf`; later cost settlement updates the original terminal period only in a
  later-`asOf` response and preserves incomplete/unresolved semantics;
- member/offboarding actions render only backend capabilities and states;
- processing, PR, member, invitation, GitHub and offboarding identifiers pass
  direct-route/action tenant and capability substitution tests;
- no customer route can execute operator offboarding or paid authorization;
- sensitive/internal fields are absent from DOM/telemetry/cache/errors;
- C06 processing/settings/metrics/offboarding journeys pass unit, Playwright,
  accessibility and contract-lock checks.

### EEM-9/07 — paired `EEM-9/07-free-integration` (`I01-B` + `I01-C`)

**Purpose:** freeze both repositories and certify the complete free/security
path before any paid approval.

**Prerequisites:** EEM-4/EEM-6/EEM-7/EEM-8 and EEM-9/02–06 are merged; both
repositories are clean; exact contract/artifact/migration bytes and all owned
acceptance rows are known. Local gates require no remote approval. Staging
deploy/canary/authenticated DAST requires the separate authorization below.

Merge order:

1. backend branch `EEM-9/07-free-integration`;
2. publish exact final backend contract digest;
3. Dashboard branch `EEM-9/07-free-integration`;
4. complete both local exact-tree gates;
5. after separate remote authorization, deploy the approved free configuration
   and run staging integration/security checks.

**Scope:** local freeze/review first, then an explicitly authorized staging
apply/deploy/source-only canary naming project, exact artifacts/migrations,
false live/model flags, rollback owner, stop conditions, and evidence window.

The DAST procedure has two separately named commands:

1. `pnpm security:dast:baseline` verifies the digest-pinned ZAP image and scans
   the pinned loopback HTTPS production build's public/Auth boundary;
2. after the remote gate opens,
   `pnpm security:dast:authenticated -- --profile <signed-free-profile>` scans
   the allowlisted isolated staging routes with synthetic Owner/Admin/Reviewer/
   Viewer sessions supplied from external secret files.

The authenticated context excludes provider/worker/operator endpoints, uses
false live/model flags, enforces an approved method/route/mutation allowlist,
proves zero provider/model/paid-count delta, and stores raw ZAP artifacts only
in the approved protected evidence location. The repository receives a
redacted finding summary, tool/profile/artifact digests and explicit Medium
disposition—never cookies, tokens or captured customer payloads.

**Exclusions:** destructive reset, knowledge-worker/model claim, provider call,
paid E2E, production deployment/certification, and customer data.

**Definition of Done:**

- backend and Dashboard complete free gates pass on exact frozen bytes;
- invitation, membership disable, tenant/BFLA, GitHub setup, entitlement,
  source-only, import waiting, review/lifecycle/metrics, accessibility,
  CSP/CSRF, secret/redaction and rollback journeys pass;
- frozen install, lint, typecheck, tests, build, high/critical dependency audit,
  digest-pinned Semgrep, verified Gitleaks, SBOM/toolchain checks and
  authenticated staging OWASP ZAP DAST pass with no unaccepted Critical/High
  finding;
- local/hosted Supabase Auth parity, tenant-cache isolation, open redirect,
  SSRF/link allowlist, request-limit/rate-limit and browser-bundle secret
  negatives pass;
- Console ASVS rows have exact evidence/status and the non-pentest UI gate,
  authenticated manual security charter and independent-pentest entry package
  are complete; production source maps/debug/diagnostic surfaces are absent;
- current EEM-5-equivalent source runtime is freshly observed post-EEM-6;
- live/model gates remain false; knowledge worker remains stopped unless a
  separately approved free startup contract exists;
- provider request, model attempt, checkpoint, extraction run, and paid cost
  counts do not increase;
- product/migration changes invalidate I01 and require rerun.

### EEM-9/08 — `EEM-9/08-paid-certification` (`I02`)

**Purpose:** run the minimum approved paid staging evidence needed for Design
Partner readiness.

**Prerequisites:** EEM-9/07 exact-tree local and authorized free-staging
evidence is valid with no product/migration drift; the exact approval fields
below and EEM-7 operational authorization are freshly supplied.

Repository owner: `Evirion/evirion-engineering-memory`. The Dashboard repository
contributes read-only UX observations but does not execute the paid operation.

This subtask does not begin from plan acceptance. It requires fresh explicit
approval naming environment, organization/repository/PR, provider/model,
initial/repair phase, maximum dispatches, budget/call ceiling, customer-consent
ID, operational-authorization ID, stop conditions, and rollback owner.

**Scope:** one bounded staging logical operation using exact I01 bytes and the
EEM-7 authorization/dispatch/checkpoint/cost chain.

**Exclusions:** production, real partner workload, automatic retry after
failure/unknown outcome, a second call, paid backfill campaign, and approval
reuse.

**Definition of Done:**

- preflight proves exact I01 bytes/deployments, entitlement generation,
  customer consent, operational authorization, pricing/readiness, budget, and
  zero unresolved prior outcome;
- one bounded logical operation follows authorization -> dispatch ->
  checkpoint -> validation/admission -> cost settlement;
- provider/account idempotency and append-only dispatch evidence are captured
  without raw payload/model response/source text;
- no automatic retry follows unknown outcome or failed approval;
- actual cost/calls remain within approval and terminal disposition/provenance
  is consistent;
- failure does not authorize another run; new approval is required.

### EEM-9/09 — paired `EEM-9/09-design-partner-ready` (`I03-A`)

**Purpose:** make and document the Technical Design Partner Ready decision
without real partner data or a new paid workload.

**Prerequisites:** EEM-9/07 free evidence and EEM-9/08 bounded paid
certification remain valid on exact frozen bytes; all release/security evidence
is available, including the independent full-platform penetration-test report
covering Console/BFF/Auth and closure retest. This subtask does not inherit
authorization for
EEM-9/10.

Merge order:

1. backend readiness/evidence PR `EEM-9/09-design-partner-ready`;
2. Dashboard readiness/runbook PR `EEM-9/09-design-partner-ready`.

**Scope:** evidence-only release decision and partner-facing/operator handoff on
already frozen/deployed/certified bytes.

**Exclusions:** product/migration changes, provider retry, automatic partner
processing, production certification, and reusing I02 approval for real
partner work.

**Definition of Done:**

- I01 exact-tree free evidence and I02 paid evidence remain valid;
- one `ACTIVE` and one still-accessible `AVAILABLE_LOCKED` repository path
  smoke correctly with exact zero work for the locked repository;
- `ENTITLEMENT_DISABLED` is tested separately and cannot substitute for the
  required locked-repository path;
- invite/onboarding/repository/import/knowledge/review/lifecycle/metrics/
  offboarding and operator handoff are usable;
- at least two distinct active platform-operator identities have independent
  AAL2/session evidence, and the another-operator lost-factor recovery plus
  final-active-operator guard are rehearsed without exposing credentials;
- post-EEM-6 source runtime remains observed and EEM-7 shared-image
  invalidation is resolved;
- dashboards/alerts/runbooks/rollback/incident ownership and customer support
  boundaries are documented;
- all applicable Critical/High security findings have independent closure/retest
  evidence; no applicable Critical/High remains open;
- every required ASVS row is evidence-backed `pass` or `not-applicable`;
  `fail`, `not-tested` and `deferred-blocking` stop readiness;
- every real partner workload still requires a fresh exact partner/customer-
  data scope; each provider-bearing paid workload additionally requires its own
  customer consent, provider/model/budget approval and Evirion operational
  authorization. I02 evidence is not reusable;
- deployed, observed, free staging-certified, paid staging-certified and
  production-certified states are reported separately;
- production certification remains false unless independently approved and
  evidenced.

### EEM-9/10 — `EEM-9/10-first-design-partner-outcome` (`I03-B`)

**Purpose:** onboard the first approved external design partner and measure the
separate product outcome only after Technical Design Partner Ready.

**Prerequisites:** EEM-9/09 is merged; the approved non-production target
environment remains on its exact certified bytes; legal/security closes
`SEC-2026-005` before external provider use and product/security closes
`SEC-2026-010` before any external object can enter active/trusted retrieval.
The partner/data-processing agreement, organization, installation/repositories,
retention boundary, operators and support owners are named. Every workload has
a fresh exact partner/customer-data scope naming environment, repositories,
data range, allowed mode, stop conditions and rollback owner. A provider-
bearing `AUTO_EXTRACT` or import workload additionally names provider/model,
maximum calls/dispatches/budget, customer consent and Evirion operational
authorization.

**Scope:**

- operator-provisioned partner organization and invite-only role cohort;
- one approved real GitHub installation, exactly one `ACTIVE` repository and
  one still-accessible `AVAILABLE_LOCKED` repository;
- approved `OFF`, `SOURCE_ONLY` and bounded `AUTO_EXTRACT` observations;
- separately approved 100–300 historical PR import or explicitly reduced pilot;
- review of 50–100 admitted Knowledge Objects and at least three genuine
  supersession relationships;
- exact Alpha metrics/cost/latency capture and at least three structured partner
  interviews;
- evidence-only product outcome and operational handoff updates.

**Exclusions:** production use/certification, unapproved repositories/data,
automatic retry, approval reuse, budget/call expansion, hidden unfavorable
metrics, unsupported billing/retrieval claims and product/migration changes
inside the evidence branch.

**Definition of Done:**

- locked repository creates exactly zero job/envelope/provider usage and
  `ENTITLEMENT_DISABLED` remains a separately tested state;
- `OFF` and `SOURCE_ONLY` use the approved partner/data scope but create no
  paid/provider authorization; provider-bearing modes cannot inherit that
  non-paid approval;
- every paid action stays inside its own fresh customer consent plus Evirion
  operational authorization and dispatch/budget ceiling;
- external admitted objects remain `UNRESOLVED` and absent from active/trusted
  retrieval until eligible human review and explicit activation satisfy the
  tested `SEC-2026-010` policy;
- import/review/lifecycle/metric requirements in product Section 15.2 have
  complete payload-free evidence, including unavailable denominators;
- provider/legal, retention/privacy, incident/support and rollback commitments
  are handed off without exposing source/model/customer payloads;
- a defect returns to its owning backend/Dashboard subtask, invalidates affected
  gates, and requires new approvals; it is never fixed ad hoc in evidence;
- Technical Design Partner Ready, first partner outcome and production
  certification are reported as three distinct states.

## Complete EEM-9 Definition of Done

- authoritative Dashboard plan/specs live in the Dashboard repository after
  EEM-9/01 and the backend copy cannot diverge;
- all C and I requirement rows have one primary repository PR/test;
- generated client digest matches the exact backend contract at every
  integration/certification gate;
- browser/BFF never becomes a policy, persistence, provider, or privileged
  credential boundary;
- every page/action and OWASP matrix row has executable positive, negative and
  tenant-substitution evidence at its owning gate;
- invite-only Supabase Auth, live membership/capability authorization,
  server-only `HttpOnly` BFF sessions, customer-safe interaction and
  authenticated cache isolation are proven on exact deployed bytes;
- all `SEC-WEB-*` rows and the Console-specific ASVS matrix have one primary
  owner/evidence path and no blocking untested row at readiness;
- free and paid certification are separate, approval-scoped, reproducible, and
  payload-free;
- Technical Design Partner Ready and first-design-partner outcome are separate
  approval/evidence gates; neither implies production certification;
- both repository roadmaps/handoffs/changelogs and matching Obsidian notes are
  synchronized.

## New-chat startup

Copy one exact repository-specific EEM-9 request from
[`docs/plans/active/README.md`](README.md). A request naming only “EEM-9” is not
sufficient to select a repository or authorize edits. Dashboard code uses only
the immutable attestation-verified digest-pinned client through BFF/server
boundaries. EEM-9/07
requires separate remote authorization after local gates; EEM-9/08 and every
EEM-9/10 provider-bearing paid workload require fresh exact paid approval.
Every EEM-9/10 workload, including `OFF`/`SOURCE_ONLY`, separately requires an
approved partner/customer-data scope.
