# EEM-9/02 acceptance trace

Every Definition-of-Done row from the EEM-9/02 section of the controlling
[EEM-9 plan](eem-9-design-partner-console-dashboard-and-certification.md) maps
here to a named executable test or to an explicit reason it is not this
subtask's to satisfy. A link is not evidence; a row with no test and no owner
elsewhere is a gap, and none is recorded that way.

Rows are numbered in the order the plan states them.

## Status vocabulary

- **covered** — a named test in this repository asserts it now.
- **partial** — asserted here for the half the Console owns, with the rest
  named against its owner.
- **owned elsewhere** — the plan assigns primary evidence to another subtask.
  Recorded so the row is not silently claimed.

## Trace

| # | Definition-of-Done row | Status | Evidence or owner |
|---|---|---|---|
| 1 | Missing or invalid public config fails startup; secret-like `NEXT_PUBLIC_*` fails build/CI | covered | `tests/unit/env.test.ts` |
| 2 | Unauthenticated routes redirect safely without open redirects | covered | `tests/security/redirect-url-boundary.spec.ts`; `tests/unit/auth/request-origin.test.ts` |
| 3 | Invitation accepted/revoked/expired/failed and disabled membership render backend recovery | partial | `src/app/auth/invite/page.tsx` renders each contract state and fails closed on an unknown one; `tests/e2e/auth.spec.ts`. Live backend states are exercised by EEM-9/07 |
| 4 | Local and expected-hosted Auth config disable public signup; providers stay disabled; the OTP endpoint delivers the pinned code template | partial | `tests/contract/backend-auth-parity.test.ts` and `scripts/check_backend_auth_parity.py` pin and verify the configuration. The synthetic-mailbox and live hosted parity halves are `EEM-9/07` under its separate remote authorization, exactly as the row states |
| 5 | `verifyOtp` server-side, tokens only in `__Host-` cookies, clean `303` | covered | `src/app/api/auth/verify-otp/route.ts`; `tests/security/auth-session-recovery.spec.ts`; `tests/unit/auth/session-broker.test.ts` |
| 6 | Local browser/E2E uses the pinned HTTPS origin and proves the same `__Host-`/`Secure` attributes as staging | covered | `playwright.config.ts` and `tools/local-tls/`; `tests/security/auth-session-recovery.spec.ts` asserts the attributes. `ignoreHTTPSErrors` is never set |
| 7 | Existing-member and invited-member bootstrap, transient post-OTP retry, terminal cleanup, unregistered-session bypass | partial | `tests/unit/auth/pre-auth-transaction.test.ts` covers the state machine including re-enterable `BOOTSTRAP_PENDING` and terminal cleanup. The backend bootstrap transaction is `EEM-4/03`; the wired round trip is `EEM-9/07` |
| 8 | Zero/one/many invitations, opaque post-auth selection, no pre-auth disclosure, no order-based auto-selection | covered | `src/server/queries/invitation-choices.ts` and `src/app/api/auth/select-invitation/route.ts`; `tests/e2e/auth.spec.ts` |
| 9 | Current-generation delivery `OUTCOME_UNKNOWN` reconciles exactly once; no automatic verification retry | covered | `tests/unit/auth/pre-auth-transaction.test.ts` |
| 10 | A provider bearer without BFF proof, a wrong or retired key, an expired or replayed proof, and direct bootstrap invocation create no mutation | owned elsewhere | Backend `EEM-4/03` owns proof consumption and rejection. The Console side is `src/lib/auth/bootstrap-proof.ts`, whose claim set is fixed here; end-to-end refusal is `EEM-9/07` |
| 11 | BFF and backend independently perform online exact-token `getUser`; wrong issuer/audience/algorithm, rotation and Auth outage fail closed | partial | `src/lib/auth/auth-provider.ts` uses `getUser(accessToken)` only and maps an outage to `unknown` with no domain effect; `tools/security/semgrep.yml` forbids `getSession`. Backend-side validation is `EEM-4/03` |
| 12 | Anonymous flag, unsupported `amr`, password/phone/OAuth/recovery/linked identity and configuration drift deny | covered | `tests/unit/auth/identity-admission.test.ts`; `tests/contract/backend-auth-parity.test.ts` |
| 13 | Provider-valid but unregistered/revoked/expired `session_id` fails every path; revocation denies before provider reconciliation | partial | `src/app/api/auth/sessions/revoke/route.ts` commits application denial first; `tests/unit/auth/session-revocation.test.ts`. The registry itself is backend `EEM-4/03` |
| 14 | Provider scope mapping and selected-non-current `NOT_APPLICABLE` visible in bounded UX and audit; response loss observes before retry | covered | `src/lib/auth/session-revocation.ts`; `tests/unit/auth/session-revocation.test.ts`; `src/app/(console)/settings/sessions/page.tsx` states it |
| 15 | TOTP/AAL2, session inventory, recent reauthentication, factor-change termination, recovery and final-owner matrices | partial | Enrolment, challenge and verification are wired through `src/app/api/auth/mfa/*` onto the provider MFA surface; `tests/unit/auth/identity-admission.test.ts` covers AAL evidence. Recovery is deliberately operator-led with no self-service form. Backend enforcement is `EEM-4/03`; the live matrix is `EEM-9/07` |
| 16 | Stale post-factor-change `aal2`, forced refresh, current/next AAL and `REAUTH_REQUIRED` | covered | `tests/unit/auth/identity-admission.test.ts` |
| 17 | First TOTP enrolment from fresh AAL1 tested separately from later reauthentication; no privileged action before `aal2` | partial | `satisfiesPrivilegedAal` requires both current and next AAL, tested in `tests/unit/auth/identity-admission.test.ts`; `/auth/mfa/enroll` states the constraint. The privileged-action matrix is backend `EEM-4/03` |
| 18 | Reauth replay/session/action/expiry mismatch and TOTP seed absence after navigation | partial | The seed is never rendered, so it cannot survive navigation; `tests/security/auth-session-recovery.spec.ts` asserts no Auth response is cacheable. Displaying the one-time QR and seed safely, and the application reauth challenge, land with the live MFA flow in `EEM-9/07` |
| 19 | Concurrent refresh, stale refresh reuse and lost response preserve exact session ownership | covered | `tests/unit/auth/session-broker.test.ts` proves one principal's chunks cannot reconstruct another's session; `tests/unit/auth/session-cookies.test.ts` covers mixed generations |
| 20 | Database-clock expiry and touch prove denied, outage, prefetch, asset and non-activity polling cannot extend a session | owned elsewhere | Database time owns expiry. Backend `EEM-4/03` holds the touch and expiry transaction; the Console never extends a session and holds no clock authority |
| 21 | Chunked-cookie rotation and logout clear every old `__Host-` chunk; over-budget state fails closed | covered | `tests/unit/auth/session-cookies.test.ts`; `tests/unit/auth/session-broker.test.ts` |
| 22 | Unchunked collision, gap, duplicate, reorder, corruption, mixed generation, excess and stale chunks and aggregate overflow clear slots with no effect | covered | `tests/unit/auth/session-cookies.test.ts` |
| 23 | Per-response CSP nonces unique across warm instances and bound to the enforced header; no `unsafe-inline`/`unsafe-eval` | covered | `tests/security/headers-cache-isolation.spec.ts` |
| 24 | Session-bound CSRF, exact Origin/Host/Fetch-Metadata/content-type and trusted proxy across cross-site, sibling subdomain, malformed Origin and forged forwarding | covered | The proxy mints a session-bound proof and every post-authentication form carries it, asserted by `tests/contract/form-actions.test.ts`; `tests/security/csrf-origin.spec.ts`; `tests/unit/auth/request-origin.test.ts`; `tests/unit/auth/csrf.test.ts` |
| 25 | Pre-auth CSRF covers OTP request/verify/selection, login CSRF, session swapping, replay, parallel tabs, stale generation and direct form posts | covered | `tests/unit/auth/csrf.test.ts`; `tests/security/csrf-origin.spec.ts` |
| 26 | Force-dynamic/no-store, zero hosting TTL and no module-scope state across nonce-bearing and authenticated responses | covered | `tests/security/headers-cache-isolation.spec.ts`; `tests/security/auth-session-recovery.spec.ts`. Warm-instance cross-tenant leakage with two live tenants is `EEM-9/07` |
| 27 | Direct Auth endpoint tests prove OTP expiry/resend/IP/email bounds, generic anti-enumeration and CAPTCHA equivalent | owned elsewhere | `AUTH-009` primary evidence is `I01-C` (`EEM-9/07`). The Console half is here: the frozen expiry and cooldown are asserted by `tests/contract/backend-auth-parity.test.ts`, and identical known/unknown responses by `tests/e2e/auth.spec.ts` |
| 28 | CI pins Actions to full SHAs, registry, runtime, package manager and lockfile; denies install scripts; rejects manifest/lock drift | covered | `tests/contract/supply-chain-policy.test.ts`; `.github/workflows/ci.yml` |
| 29 | Production `.map`, debug overlays, diagnostics and internal API documentation return `404/403` | covered | `tests/security/release-surface.spec.ts`; the CI build asserts no emitted browser source map |
| 30 | The UI never treats hidden navigation as authorization | covered | `src/lib/auth/capabilities.ts` and `src/components/layout/console-navigation.tsx`; `tests/security/redirect-url-boundary.spec.ts` proves a hidden route still refuses |
| 31 | Owner / Admin / Reviewer (`member`) / Viewer capability matrix has positive and negative coverage | partial | The four-role vocabulary and its `reviewer`→`member` mapping are asserted in `tests/unit/auth/capabilities.test.ts`. The live per-role matrix needs authenticated fixtures and is `EEM-9/07` `SEC-WEB-001` |
| 32 | The BFF forwards token, idempotency, correlation and version but never service role or caller-supplied organization authority | covered | `tests/unit/auth/console-api.test.ts`; `tools/security/semgrep.yml` forbids a service-role key or DSN anywhere in `src` |
| 33 | C01 and C02 remain separately reviewable phase commits inside one PR, and both acceptance groups pass | covered | Four commits on `EEM-9/02-auth-shell`; both gate groups pass, recorded in `docs/CHANGELOG.md` |

## Requirement ownership from the task reading map

| Requirement | Status | Evidence or owner |
|---|---|---|
| `J-001` accept invite and sign in | covered | `tests/e2e/auth.spec.ts` |
| `AUTH-008` server-only BFF session and Auth UX | covered | `tests/security/auth-session-recovery.spec.ts` plus the cookie and broker unit suites, which assert the states that must hold before a response exists |
| `SEC-WEB-002` authentication and session failure | covered | `tests/security/auth-session-recovery.spec.ts` |
| `SEC-WEB-003` CSRF and replay | covered | `tests/security/csrf-origin.spec.ts` |
| `SEC-WEB-005` SSRF, open redirect and external resources | covered | `tests/security/redirect-url-boundary.spec.ts` |
| `SEC-WEB-006` misconfiguration, cache, CSP, clickjacking | covered | `tests/security/headers-cache-isolation.spec.ts` |
| `SEC-WEB-007` dependencies and supply chain | covered | `tests/contract/supply-chain-policy.test.ts` |
| `AUTH-001` to `AUTH-007`, `AUTH-009` | owned elsewhere | Backend `EEM-4/03` and `EEM-9/07`. The Console contributes the surfaces and refusal paths traced above |
| `J-008` final-owner and invite invariants | owned elsewhere | Backend `EEM-4/03` enforces the final-owner guard. The Members UI is explicitly excluded from this subtask and belongs to `EEM-9/06` |
| `NFR-SEC-001` browser secret boundary | partial | `tests/contract/no-browser-secrets.test.ts` and `tests/security/release-surface.spec.ts`. Primary owner is `I01-C` against a deployed environment |
| `NFR-SEC-002` defence in depth | owned elsewhere | Database grants, forced RLS and tenant foreign keys are backend `I01-B` |
| `NFR-SEC-003` web security | partial | The Console half is covered by the C01 and C02 suites above. Primary owner is `I01-C`, including authenticated DAST |
| `NFR-SEC-004` field-level capability projection | owned elsewhere | Endpoint projections are backend `B09`; the Console renders only what the projection returns |

## Open decision 1 blocks every accessibility gate in this subtask

`AGENTS.md` already fixes WCAG 2.2 AA as target behavior for every owned
journey, so the target is not open. What is open is the axe ruleset, the tag
selection and the pass threshold, which is what an executable gate needs, and
no owner decision exists.

This subtask therefore ships journey-level accessibility assertions that do not
depend on a ruleset choice — every form control has an accessible name and the
sign-in journey is keyboard reachable, both in `tests/e2e/auth.spec.ts` — and
records that the configured axe gate cannot be written until the product owner
answers. `NFR-ACC-001` names `I01-C` as primary owner, so the decision is due
before `EEM-9/07`, not before this merge. Nothing here selects a level.

## Independent review

One bounded review wave ran against this tree: a correctness reviewer and a
security reviewer in parallel. The security reviewer found no issue at medium
severity or above, and confirmed the token boundary, the mutation-guard
ordering, the cookie contract and the canonical-redirect fix.

It did surface a functional defect the self-audit missed: five forms posted to
route handlers that were never written, so those controls rendered and returned
`404`. Nothing in lint, typecheck, the build or the route guard could see it,
because the guard checks that routes are declared rather than that referenced
routes exist. The remediation wave implemented `/api/auth/organization`,
`/api/auth/select-invitation`, `/api/auth/mfa/enroll` and
`/api/auth/mfa/challenge`, replaced the recovery form with the operator-led
surface the backend contract actually supports, minted the session-bound CSRF
proof the post-authentication forms needed, and added
`tests/contract/form-actions.test.ts` so the class of defect cannot recur.

## What this subtask does not claim

Implemented and locally verified only. Nothing is merged, deployed, observed,
staging-certified, paid-certified or production-certified. No hosted Supabase
Auth setting was read or changed, no real email was sent, no worker ran, no
provider was called and no paid operation was authorized.
