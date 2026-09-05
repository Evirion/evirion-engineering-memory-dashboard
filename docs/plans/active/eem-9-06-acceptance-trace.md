# EEM-9/06 acceptance trace

Every Definition-of-Done row from the EEM-9/06 section of the controlling
[EEM-9 plan](eem-9-design-partner-console-dashboard-and-certification.md) maps
here to a named executable test or to an explicit reason it is not this
subtask's to satisfy.

Rows are numbered in the order the plan states them.

## Status vocabulary

- **covered** — a named test in this repository asserts it now.
- **partial** — asserted here for the half the Console owns, with the rest
  named against its owner.
- **owned elsewhere** — the plan assigns primary evidence to another subtask.
- **blocked** — the row cannot be satisfied by anyone yet, and why.

## Trace

| # | Definition-of-Done row | Status | Evidence or owner |
|---|---|---|---|
| 1 | Processing Activity is read-only; no customer retry, resume or replay on a live extraction job | covered | `tests/e2e/processing-settings.spec.ts::processing_detail_offers_no_recovery_action`; `tests/unit/processing/presentation.test.ts`; `tests/component/processing/processing-activity-table.test.tsx`; `tests/contract/console-stub-fixtures.test.ts` |
| 2 | Rejected admission, quarantine and infrastructure failure are visually and semantically distinct on processing | covered | `tests/unit/processing/presentation.test.ts`; `tests/e2e/processing-settings.spec.ts::journey_investigate_processing_outcome`; `tests/component/processing/processing-activity-table.test.tsx` |
| 3 | Customer consent wait and Evirion operational authorization wait are distinct and offer no processing action | covered | `tests/unit/processing/presentation.test.ts`; `tests/component/processing/processing-activity-table.test.tsx`; `tests/e2e/processing-settings.spec.ts::processing_detail_offers_no_recovery_action` |
| 4 | Cost is amount plus completeness; reserved and unresolved never render as a measured zero; absent cost is absence | covered | `tests/unit/processing/presentation.test.ts`; `tests/component/processing/processing-activity-table.test.tsx`; `tests/component/settings/usage-metrics-panel.test.tsx`; `tests/e2e/processing-settings.spec.ts`; `tests/security/processing-boundary.spec.ts` |
| 5 | GitHub settings separate accessible repositories from entitled active repositories | covered | `tests/e2e/processing-settings.spec.ts`; fixture `GITHUB_SETTINGS_SUMMARY` validated in `tests/contract/console-stub-fixtures.test.ts` |
| 6 | Usage and Alpha metrics use separate windows and are labelled not an invoice | covered | `tests/component/settings/usage-metrics-panel.test.tsx`; `tests/e2e/processing-settings.spec.ts::goal_operational_transparency_uses_safe_projections`; `tests/unit/settings/presentation.test.ts` |
| 7 | Metrics rates with zero denominator or null rate render unavailable, not 0% | covered | `tests/unit/settings/presentation.test.ts` |
| 8 | Processing and settings identifiers are cross-tenant substitution tested | covered | `tests/security/processing-boundary.spec.ts`: foreign repository filter equals absent, malformed repository id, foreign pull request equals absent, a pull request number the route never addresses, direct backend GET for another organization, and secret absence. Membership identifier substitution is refused by the backend and named against `EEM-9/07`'s live role matrix |
| 9 | Unauthorized and sensitive fields are absent from fixtures, DOM and direct reads | partial | `tests/security/processing-boundary.spec.ts`; `tests/contract/no-browser-secrets.test.ts` owns the bundle half |
| 10 | Every C06 requirement and acceptance row has named UI evidence | covered | See requirement table below |

## Requirement ownership from the task reading map

| Requirement | Coverage identifier | Status | Evidence or owner |
|---|---|---|---|
| `PROC-001` | processing list read | covered | `/processing`, `fetchProcessingActivity`, stub `/processing-activity`, `PROCESSING_PAGE` |
| `PROC-002` | `processing_detail_offers_no_recovery_action` | covered | Static support copy only; amended under ADR-0006 |
| `PROC-003` | PR detail + validation issues | covered | `tests/e2e/processing-settings.spec.ts::PROC-003 pull request detail` reaches the frozen route from a processing row and renders the quarantine issues; the same block asserts no recovery control on the detail |
| `SET-001` | members invite/resend/revoke | covered | `tests/e2e/processing-settings.spec.ts::journey_manage_members_with_owner_guard` commits an invite, a resend and a revoke, refuses a stale version, and refuses an address the surface can judge before any backend call |
| `SET-002` | GitHub settings summary | covered | `/settings/github`, `fetchGithubSettingsSummary` |
| `SET-003` | usage + metrics | covered | `/settings/usage`, `UsageMetricsPanel` |
| `OPS-001` | offboarding request | covered | `tests/e2e/processing-settings.spec.ts::journey_request_and_observe_offboarding` refuses an unconfirmed request and commits a confirmed one against `OffboardingReceipt` |
| `OPS-002` | offboarding observe only | covered | Same block: status renders, the request form disappears once one exists, and no execute or reject control is ever offered |
| `MET-001`–`MET-003` | metrics panel | covered | `tests/unit/settings/presentation.test.ts`, `tests/component/settings/usage-metrics-panel.test.tsx` |
| `REPO-003` | repository counters | owned elsewhere | `repository-counters.tsx`, `tests/e2e/repositories.spec.ts` |
| `PR-001` | pull request detail | covered | `tests/e2e/processing-settings.spec.ts::PROC-003 pull request detail`. The frozen route addresses a pull request by number and the contract publishes no lookup by number, so the identifier is resolved from processing activity across a bounded cursor traversal; exhausting the bound reports a dependency failure rather than asserting the pull request does not exist |
| `G-006` | `goal_operational_transparency_uses_safe_projections` | covered | `tests/e2e/processing-settings.spec.ts` |
| `J-007` | `journey_investigate_processing_outcome` | covered | `tests/e2e/processing-settings.spec.ts` |
| `J-008` | manage members with owner guard | covered | `tests/e2e/processing-settings.spec.ts::journey_manage_members_with_owner_guard` commits a role change and proves no role control is offered for the owner row. The final-owner invariant itself is backend `EEM-4/03`. `disable` and `transfer_owner` are published by the contract and deliberately not built here: neither has a Console journey in the reading map, and the BFF refuses any action other than `change_role` |
| `J-009` | GitHub reconnect | owned elsewhere | EEM-9/03 connect/sync |
| `J-010` | recover failed work | partial | Processing half: no action. Import half: EEM-9/04 |
| `J-011` | request and observe offboarding | covered | `tests/e2e/processing-settings.spec.ts::journey_request_and_observe_offboarding` |
| `NFR-SEC-004` | role matrix | partial | Viewer cost absence, viewer usage refusal, and a member who may read members but not manage them keeping the inventory, all in `tests/security/processing-boundary.spec.ts`. Full live matrix is EEM-9/07 |

## Contract gaps closed

Backend issue #71 bytes consumed as `console-contract-v1.0.4` on branch
`EEM-9/03h-console-contract-revision`. This subtask wires:

- `listOrganizationInvitations` and invitation receipts
- membership and offboarding typed receipts
- `OrganizationOffboardingStatus` read wrapper
- `pullRequestId` and `extractionRunId` on processing rows

## Step-up mechanism

`EEM-9/02c` shared step-up is wired for membership mutations through
`GatedForm gate=membership_change` and `MUTATION_PATHS_FOR_GATE.membership_change`.

## Outcomes are reported, and an uninterpretable one is not a success

Each of the seven invitation, membership and offboarding response codes travels
back as itself and is named by `MembershipOutcomeNotice`, which states what
changed and, where two things could be confused, what did not. None of them is
a published error code, so routing them through the shared reader would report
a committed command as an unknown outcome.

`UNSUPPORTED_SERVER_RESPONSE` is deliberately absent from that map. The
receipts admit it, so a backend can send it, and it falls through to the shared
reader and lands on unknown outcome rather than on anything that changed.
Reporting every success as a generic `applied` would have hidden it.

## Reading members and reading invitations are two capabilities

The pending invitation inventory is a `organization.members.manage` read. It is
not requested for a caller who lacks that capability, because one capability
refusal would otherwise take the member inventory down with it. Covered by
`tests/security/processing-boundary.spec.ts`, "a member who may not manage still
sees the member inventory".

## Verification

Focused slice `processing-settings`, affected slice `processing-settings`, and
the complete free gate were run on branch `EEM-9/06-processing-settings-metrics`
after bytes were frozen.

## Deployment state

Implemented and locally verified only. Not merged, not deployed, not observed,
not staging-certified, not paid-certified, not production-certified.
