# EEM-9/03g acceptance trace

Every behaviour this subtask changed maps here to a named executable test or to
an explicit owner elsewhere. A link is not evidence; a row with neither a test
nor a named owner is a gap and is recorded as one.

EEM-9/03g has no Definition-of-Done section in the controlling
[EEM-9 plan](eem-9-design-partner-console-dashboard-and-certification.md),
because it did not exist when that plan was frozen. Its scope is fixed by
[`ROADMAP.md`](../../ROADMAP.md), "The next Dashboard contract consumption is one
subtask, not two", which names the consumption plus the stub and error-binding
changes required by the merged backend subtasks it carries.

## Status vocabulary

- **covered** — a named test in this repository asserts it now.
- **partial** — asserted here for the half the Console owns, with the rest
  named against its owner.
- **owned elsewhere** — primary evidence belongs to another subtask.
- **carried** — a dependency this subtask deliberately did not resolve.

## What the release changed

`console-contract-v1.0.3` is a revision of contract `1.0`, additive against
`v1.0.2`. `packageSha256` went from `1ba7e1f8` to `939a3bd1`. Seven new read
payload schemas, one new receipt schema, one new error code, live
`currentSequence` on sequence-token conflicts, and two reauthentication
operations arrived from three merged backend subtasks:

- EEM-8/10: `processing-page`, `pull-request-detail`, `validation-issues`,
  `github-settings-summary`, `organization-usage`, `organization-metrics`;
- EEM-4/05: `session-reauthentication-receipt`, `issueSessionReauthentication`,
  `completeSessionReauthentication`, and `REAUTHENTICATION_REQUIRED`;
- EEM-8/11: `currentSequence` on the error envelope and live emission of
  version-conflict detail the contract has always advertised.

The generator produces 39 consumable types against these bytes, up from 32 at
`v1.0.2`.

## Phase 0, trust boundary and byte identity

| # | Behaviour | Status | Evidence or owner |
|---|---|---|---|
| 0.1 | The published archive is byte-identical to a local rebuild from the same contract bytes at `cbdff787` | covered | Backend `check_console_contract.py package` output matched archive digest `cf856f2a`; `cmp` against the downloaded release asset before any lock update |
| 0.2 | Offline attestation binds subject digest, repository, workflow, tag ref, source commit, issuer, inclusion proof, release asset identity and verifier version | covered | `cosign verify-blob` with pinned trusted root against downloaded bundle; `verify_artifact_attestation.py` against recorded evidence |
| 0.3 | Certificate identity names the exact pinned tag, not a different one | covered | Identity `...@refs/tags/console-contract-v1.0.3` verified in the offline cosign invocation |
| 0.4 | The lock, the evidence and the policy agree on one digest | covered | `check_console_contract_lock.verify_lock_against_policy` and `verify_recorded_evidence`; `ConsoleContractLockTests` |

## Phase 1, consuming the release

| # | Behaviour | Status | Evidence or owner |
|---|---|---|---|
| 1.1 | The vendored tree is exactly the pinned archive | covered | `ConsoleContractLockTests.test_vendored_bytes_are_exactly_the_pinned_archive` |
| 1.2 | The consumed bytes are the published content set | covered | `ConsoleContractLockTests.test_console_contract_content_is_the_consumed_revision` pins `packageSha256` `939a3bd1` |
| 1.3 | The generated client reproduces byte for byte from the pinned asset | covered | `ConsoleContractLockTests.test_generated_client_is_reproducible_from_the_pinned_asset`; CI `git diff --exit-code -- generated` |
| 1.4 | The export surface moved additively to 39 types | covered | `generatedClientSurfaceSha256` is `9ed72426`. Seven exports added, none removed or renamed: `GithubSettingsSummary`, `OrganizationMetrics`, `OrganizationUsage`, `ProcessingPage`, `PullRequestDetail`, `SessionReauthenticationReceipt`, `ValidationIssues`, plus matching `is*` validators |
| 1.5 | A revision did not move the API version | covered | `ConsoleContractLockTests.test_the_revision_did_not_move_the_api_version` |
| 1.6 | The generated client records its own provenance | covered | `ConsoleContractLockTests.test_generated_client_records_its_provenance`; `tests/contract/console-contract-provenance.test.ts` |
| 1.7 | `REAUTHENTICATION_REQUIRED` has a reviewed treatment distinct from sign-in and not-permitted | covered | `TREATMENTS` in `src/lib/errors/console-errors.ts` maps it to `reauthentication-required`; `tsc` enforces exhaustiveness |
| 1.8 | Backend Auth parity still holds at the new source commit | covered | `scripts/check_backend_auth_parity.py` at `cbdff787`; `tests/contract/backend-auth-parity.test.ts` |
| 1.9 | Superseded evidence is retained | covered | `docs/contracts/console-contract-v1.0-evidence.json` and `console-contract-v1.0.2-evidence.json` stay tracked; `tests/test_bootstrap_contract.py` requires all three evidence files |
| 1.10 | `vendor/console-contract-v1.0.2` is retired | covered | Inventory lists only `vendor/console-contract-v1.0.3`; `check_console_contract_lock` verifies the new vendored root |

## Phase 2, stub parity with EEM-8/11

| # | Behaviour | Status | Evidence or owner |
|---|---|---|---|
| 2.1 | Entitlement and policy `VERSION_CONFLICT` responses carry no detail field | covered | `tools/console-stub/server.mjs` activate, disable, request-change and processing-policy handlers return `{ error: "VERSION_CONFLICT" }` only |
| 2.2 | Review and lifecycle conflicts emit `currentSequence`, including zero | covered | `conflict()` helper in `tools/console-stub/server.mjs`; `tests/contract/console-stub-fixtures.test.ts` "refuses review and lifecycle conflicts that name currentVersion" |
| 2.3 | Relation `VERSION_CONFLICT` emits `currentSequence` | covered | Supersession correction handler in `tools/console-stub/server.mjs` |
| 2.4 | A fixture contradicting the generated error schema would fail the gate | covered | `console-stub-fixtures.test.ts` negative cases against `isConsoleError` |

## Phase 3, deliberately not built here

| Item | Status | Owner |
|---|---|---|
| Step-up reauthentication UI and BFF routes | owned elsewhere | Issue #16 / follow-on EEM subtask |
| Processing, settings and metrics surfaces | owned elsewhere | `EEM-9/06` consumes the six new read schemas |
| Memory review changes | carried | `EEM-9/05` merged without these bytes; no regression expected |

## Deployment and release state

Implemented and locally verified. Not merged, not deployed, not observed, not
staging-certified, not paid-certified, not production-certified.

Final gate evidence, all from this tree: lint, format, `tsc --noEmit`, 723
Vitest tests, a production build, 233 Playwright tests, 100 Python tests, the
Console contract lock, the authority package, backend Auth parity at
`cbdff787`, and `pnpm verify` complete free gate.

No provider was called, no paid operation was authorized, no worker ran, no
hosted Supabase setting was read or changed, and nothing was deployed. Network
use was limited to downloading the two published release assets, fetching Rekor
metadata for the evidence UUID, and installing a pinned cosign binary; signature
verification itself ran offline.

`SEC-2026-012` remains open under its approved GitHub Free bootstrap waiver and
remains readiness blocking. Technical Design Partner Ready remains false.

## Unblocks

- **`EEM-9/06`** — the six read payload schemas it cannot be written without are
  now consumed.
- **Issue #16** — `REAUTHENTICATION_REQUIRED`, the receipt schema, and the two
  reauthentication operations are reachable in the generated client; the
  treatment is bound but the ceremony is not built here.
- **Follow-on memory conflict UX** — live `currentSequence` detail matches what
  `EEM-9/05` raised as an additive contract limit.
