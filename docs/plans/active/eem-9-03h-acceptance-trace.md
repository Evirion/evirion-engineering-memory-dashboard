# EEM-9/03h acceptance trace

Every behaviour this subtask changed maps here to a named executable test or to
an explicit owner elsewhere. A link is not evidence; a row with neither a test
nor a named owner is a gap and is recorded as one.

EEM-9/03h has no Definition-of-Done section in the controlling
[EEM-9 plan](eem-9-design-partner-console-dashboard-and-certification.md),
because it did not exist when that plan was frozen. Its scope is fixed by
[`ROADMAP.md`](../../ROADMAP.md), "The next Dashboard contract consumption is one
subtask, not two", which names the consumption required before
`EEM-9/06-processing-settings-metrics` can finish the member, invitation,
offboarding and PR-detail surfaces blocked on backend issue
[#71](https://github.com/Evirion/evirion-engineering-memory/issues/71).

## Status vocabulary

- **covered** — a named test in this repository asserts it now.
- **partial** — asserted here for the half the Console owns, with the rest
  named against its owner.
- **owned elsewhere** — primary evidence belongs to another subtask.
- **carried** — a dependency this subtask deliberately did not resolve.

## What the release changed

`console-contract-v1.0.4` is a revision of contract `1.0`, additive against
`v1.0.3`. `packageSha256` went from `939a3bd1` to `72ce0da1`. Five new payload
or receipt schemas, four membership and invitation mutation operations, one
offboarding request operation, a typed offboarding read wrapper, and two new
processing-row identifiers arrived from backend issue #71 / EEM-8 follow-on work:

- `organization-invitations`, `invitation-receipt`, `membership-receipt`,
  `offboarding-receipt`, `organization-offboarding-status`;
- `listOrganizationInvitations`, `createOrganizationInvitation`,
  `resendOrganizationInvitation`, `revokeOrganizationInvitation`,
  `updateOrganizationMembership`, `requestOrganizationOffboarding`;
- `pullRequestId` and `extractionRunId` on `processing-page` rows.

The generator produces 44 consumable types against these bytes, up from 39 at
`v1.0.3`.

## Phase 0, trust boundary and byte identity

| # | Behaviour | Status | Evidence or owner |
|---|---|---|---|
| 0.1 | The published archive is byte-identical to a local rebuild from the same contract bytes at `b4011580` | covered | Backend `check_console_contract.py package` output matched archive digest `3690f02c`; `cmp` against the downloaded release asset before any lock update |
| 0.2 | Offline attestation binds subject digest, repository, workflow, tag ref, source commit, issuer, inclusion proof, release asset identity and verifier version | covered | `cosign verify-blob` with pinned trusted root against downloaded bundle; `verify_artifact_attestation.py` against recorded evidence |
| 0.3 | Certificate identity names the exact pinned tag, not a different one | covered | Identity `...@refs/tags/console-contract-v1.0.4` verified in the offline cosign invocation |
| 0.4 | The lock, the evidence and the policy agree on one digest | covered | `check_console_contract_lock.verify_lock_against_policy` and `verify_recorded_evidence`; `ConsoleContractLockTests` |

## Phase 1, consuming the release

| # | Behaviour | Status | Evidence or owner |
|---|---|---|---|
| 1.1 | The vendored tree is exactly the pinned archive | covered | `ConsoleContractLockTests.test_vendored_bytes_are_exactly_the_pinned_archive` |
| 1.2 | The consumed bytes are the published content set | covered | `ConsoleContractLockTests.test_console_contract_content_is_the_consumed_revision` pins `packageSha256` `72ce0da1` |
| 1.3 | The generated client reproduces byte for byte from the pinned asset | covered | `ConsoleContractLockTests.test_generated_client_is_reproducible_from_the_pinned_asset`; CI `git diff --exit-code -- generated` |
| 1.4 | The export surface moved additively to 44 types | covered | `generatedClientSurfaceSha256` is `cfbb7934`. Five exports added, none removed or renamed: `InvitationReceipt`, `MembershipReceipt`, `OffboardingReceipt`, `OrganizationInvitations`, `OrganizationOffboardingStatus`, plus matching `is*` validators |
| 1.5 | A revision did not move the API version | covered | `ConsoleContractLockTests.test_the_revision_did_not_move_the_api_version` |
| 1.6 | The generated client records its own provenance | covered | `ConsoleContractLockTests.test_generated_client_records_its_provenance`; `tests/contract/console-contract-provenance.test.ts` |
| 1.7 | Backend Auth parity still holds at the new source commit | covered | `scripts/check_backend_auth_parity.py` at `b4011580`; `tests/contract/backend-auth-parity.test.ts` |
| 1.8 | Superseded evidence is retained | covered | `docs/contracts/console-contract-v1.0-evidence.json`, `console-contract-v1.0.2-evidence.json`, and `console-contract-v1.0.3-evidence.json` stay tracked; `tests/test_bootstrap_contract.py` requires all four evidence files |
| 1.9 | `vendor/console-contract-v1.0.3` is retired | covered | Inventory lists only `vendor/console-contract-v1.0.4`; `check_console_contract_lock` verifies the new vendored root |

## Phase 2, deliberately not built here

| Item | Status | Owner |
|---|---|---|
| Processing, settings and metrics product surfaces | owned elsewhere | `EEM-9/06` consumes the new schemas and operations |
| Console stub handlers for invitation, membership and offboarding mutations | owned elsewhere | `EEM-9/06` extends `tools/console-stub` with the new reads and mutations |
| PR detail page and validation issues UI | owned elsewhere | `EEM-9/06` |

## Deployment and release state

Implemented and locally verified. Not merged, not deployed, not observed, not
staging-certified, not paid-certified, not production-certified.

Final gate evidence, all from this tree: lint, format, `tsc --noEmit`, Vitest,
a production build, Playwright, Python contract tests, the Console contract
lock, the authority package, backend Auth parity at `b4011580`, and `pnpm verify`
complete free gate.

No provider was called, no paid operation was authorized, no worker ran, no
hosted Supabase setting was read or changed, and nothing was deployed. Network
use was limited to downloading the two published release assets, fetching Rekor
metadata for the evidence UUID, and installing a pinned cosign binary; signature
verification itself ran offline.

`SEC-2026-012` remains open under its approved GitHub Free bootstrap waiver and
remains readiness blocking. Technical Design Partner Ready remains false.

## Unblocks

- **`EEM-9/06`** — PR detail, members invite/resend/revoke, membership step-up,
  offboarding request, and typed invitation/offboarding reads can now bind to
  generated validators only.
