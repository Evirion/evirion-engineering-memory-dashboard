# EEM-9/07 acceptance trace — `I01-C` (Console)

> **Status:** implemented and locally verified on branch
> `EEM-9/07-free-integration`, started from `main` at `0c327bb`. Not merged, no
> pull request open, nothing pushed. Step 7 staging apply, deployment, canary
> and authenticated DAST remain unauthorized.

The paired backend trace is `docs/plans/active/eem-9-07-acceptance-trace.md` in
`evirion-engineering-memory`, merged as `I01-B` through
[PR #73](https://github.com/Evirion/evirion-engineering-memory/pull/73) at
`aa5bd83`. No contract or migration byte moved there, so no contract
publication was needed between the two pull requests.

## Gate evidence

`pnpm verify` on the pinned Node 24.20.0 runtime, exit `0`, ending
`complete free gate passed`. Fourteen stages: stale-port clearance, lint,
format, typecheck, unit, build, end-to-end, dependency audit, Semgrep, Gitleaks,
supply chain, release surface, ASVS and baseline DAST.

| Stage | Result |
|---|---|
| Unit, contract and conformance | 839 passed |
| End-to-end and security | 336 passed |
| Baseline DAST | 60 rules pass, 7 warnings, 0 at High or above |
| Dependency audit, Semgrep, Gitleaks | clean |

The local runtime was Node 22.18. The toolchain pins 24.20.0, so a gate run on
22 would not have been evidence about the pinned runtime; 24.20.0 was fetched
and checksum-verified before the gate ran.

## Rows delivered

| Row | Evidence |
|---|---|
| `SEC-WEB-001` | `tests/security/tenant-capability-matrix.spec.ts` |
| `SEC-WEB-004` | `tests/security/xss-corpus.spec.ts` |
| `SEC-WEB-008` | `tests/security/release-surface.spec.ts` |
| `SEC-WEB-009` | `tests/security/abuse-bounds.spec.ts` |
| `NFR-SEC-003` | `tests/security/web-boundary.spec.ts` |
| `NFR-ACC-001` | `tests/e2e/accessibility.spec.ts` |
| `AUTH-009.A1`–`A5` | `tests/security/auth-hosted-parity-abuse.spec.ts` |
| `G-001.A1` | `tests/e2e/free-integration.spec.ts` |
| ASVS V10 business logic | `tests/security/business-logic.spec.ts` |
| Rollback rehearsal | `scripts/rehearse_console_rollback.sh`, `tests/contract/rollback-rehearsal.test.ts` |

## What the conformance tier found

The double was written from the contract and the backend implements the same
contract. Nothing had ever checked the two readings agree, and they did not.

**The double knew 32 of the 38 error codes a Console surface can receive.** Six
refusals could never be exercised by any test, however many ran against it:
`INVITATION_STATE_CONFLICT`, `MODEL_PROFILE_NOT_OFFERED`,
`PROVIDER_OUTCOME_UNKNOWN`, `RATE_LIMITED`, `REQUEST_TOO_LARGE` and
`UNSUPPORTED_SERVER_RESPONSE`. Two matter beyond coverage: `RATE_LIMITED` is the
only retryable refusal of the six and is what `SEC-WEB-009` rests on, and
`UNSUPPORTED_SERVER_RESPONSE` is the fail-closed contract for a state the
Console does not recognise. Status and retryability were read from
`supabase/functions/console-api/errors.ts`, which is what emits them.

**Two published codes reach no Console surface.** `BACKFILL_NOT_APPROVABLE` and
`NEW_MODEL_CALL_NOT_AUTHORIZED` exist nowhere in the Edge; they live in
`contracts/operator/v1/openapi.yaml`. `error.json` is shared between the Console
and operator contracts, so the generated Console validator accepts two codes the
Console can never legitimately receive. The double is right not to implement
them. This is recorded rather than worked around: narrowing the shared schema is
a contract change neither pull request owns.

**An unknown code used to become a 500.** That fallback is what hid the gap, so
it now throws: a code the table does not know is a bug in the double rather than
a refusal to send.

## The ASVS matrix could never have passed

All 212 rows read `planned`, and it was never neglect. The generator synthesised
a case name such as `asvs_v6_1_1` that existed in no suite, and the Python ones
could never be pytest nodes at all, so no row's evidence had ever pointed at
anything that runs. A status literal sat beside it, so nothing could change.

Evidence is now the file that proves a row, and status comes from
`docs/security/asvs-status.json`, where each row carries the command that
observed it and the date. A row absent from that file generates as `planned`, so
nothing becomes `pass` by omission.

**The claim is deliberately narrow.** `evidenceKind` is `suite-level`: a `pass`
means the named suite exists and passed, not that a separate assertion was
written for that single requirement. `tests/contract/asvs-evidence.test.ts`
holds this together — no row may name a case again, every Console-owned row must
resolve to a file present here, and anything not `planned` must have a command
and a date behind it.

## Deviations from the plan, and why

**The live-stack browser project was not built.** It needs real sessions, which
needs a seeded tenant, which the owner decided against because the alternatives
were a second backend pull request or a `service_role` key inside the Console.
Without authentication every route answers one thing — `401
AUTHENTICATION_REQUIRED` — because authorization precedes routing, validation
and method checking. A browser harness against that would test nothing the
conformance tier does not already prove, so it was not built.

**Accessibility uses no scanner.** The repository pins none, and adding one is a
supply-chain decision rather than a test decision. The row names five properties
and the gate proves five; a scanner would add breadth over ARIA rules rather
than make those five stronger.

## Corrections to my own assertions

Four times an assertion failed and the product was right. They are recorded
because each looked like a finding:

- comparing refusals raced a page still reading "Loading" and compared a
  per-request support reference, which reported an enumeration oracle that does
  not exist;
- a payload inside Next's inline script is escaped as `\u003cscript\u003e`, so
  the parser cannot see a closing tag — correct, not lucky;
- a refused form action answers `303` to sign-in rather than `4xx`, so expecting
  a `4xx` would have accused a working defence;
- onboarding carries no connect control, because connecting is a deliberate act
  on its own surface; onboarding instead states the guarantee in the product's
  own words, which is better `G-001` evidence than what was planned.

## Delivery state

- **Implemented:** the rows above, the conformance tier, the gate scripts, the
  digest-pinned ZAP baseline and the rollback rehearsal.
- **Locally verified:** `pnpm verify` exits `0` on the pinned runtime.
- **Merged:** nothing. Nothing pushed, tagged or signed.
- **Behind Step 7 authorization:** staging apply, deployment, source-only
  canary, authenticated DAST, the manual security charter and pentest entry.
- **Still blocking readiness:** `SEC-2026-012` under its bootstrap waiver, and
  Technical Design Partner Ready overall.
