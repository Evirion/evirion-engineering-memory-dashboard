# EEM-9/02c acceptance trace

Every Definition-of-Done row from issue
[#16](https://github.com/Evirion/evirion-engineering-memory-dashboard/issues/16)
and the EEM-9/02c task prompt maps here to a named executable test or to an
explicit reason it is not this subtask's to satisfy.

## Status vocabulary

- **covered** — a named test in this repository asserts it now.
- **partial** — asserted here for the half the Console owns, with the rest
  named against its owner.
- **owned elsewhere** — primary evidence belongs to another subtask.
- **blocked** — the row cannot be satisfied yet, and why.

## Issue #16 trace

| Row | Status | Evidence |
|---|---|---|
| Gated control renders a precondition notice before commit | covered | `tests/e2e/reauthentication.spec.ts` on import approval and lifecycle activation; `tests/e2e/memory-review.spec.ts` retains the lifecycle copy assertion |
| Refusal renders actionable step-up, never sign-in or unknown | covered | `tests/e2e/reauthentication.spec.ts` import and knowledge return paths; `tests/e2e/reauthentication.spec.ts` invalidated-challenge recovery asserts no sign-in heading |
| Completed step-up returns to refused action with input intact on import and knowledge surfaces | covered | `tests/e2e/reauthentication.spec.ts` preserves `costBudgetUsd` through import approval and completes activation after a queue note on the knowledge surface |
| Lapsed window before attempt behaves like backend refusal | covered | `tests/e2e/reauthentication.spec.ts` client intercept on stale freshness and direct BFF POST both land on the in-place ceremony |
| `null` and absent `reauthenticationFreshUntil` both read as not fresh, pinned separately | covered | `tests/unit/auth/reauthentication-freshness.test.ts`; `tests/contract/console-stub-fixtures.test.ts`; `tests/e2e/reauthentication.spec.ts` absent-field journey |
| No token, nonce or challenge identifier in URL, DOM or browser-reachable state | covered | `tests/security/reauthentication-boundary.spec.ts` |
| Reviewer completes a queue longer than the freshness window without losing work | partial | Return-with-input is proven on both shipped surfaces; a multi-object queue timed past ten minutes is owned by `EEM-9/07` against a live backend |

## Additional prompt rows

| Row | Status | Evidence |
|---|---|---|
| Invalidated challenge between issue and consume is recoverable, not unknown | covered | Stub scenario `reauthInvalidateChallenge`; `tests/e2e/reauthentication.spec.ts` |
| Customer told other sessions will close before completing ceremony | covered | `tests/e2e/reauthentication.spec.ts` asserts `data-testid="reauth-revokes-other-sessions"` is offered before completion, not copy alone |
| Return path proven on both shipped surfaces with input preserved | covered | Import budget in `tests/e2e/reauthentication.spec.ts`; knowledge note preservation in `tests/unit/auth/reauthentication-state.test.ts` |
| Boundary test in the manner of `import-boundary.spec.ts` | covered | `tests/security/reauthentication-boundary.spec.ts` |
| Console stub extended with ceremony operations and outcomes | covered | `tools/console-stub/server.mjs` issue and completion handlers; scenario `reauthInvalidateChallenge` |
| Fixture contradicting generated schemas fails | covered | `tests/contract/console-stub-fixtures.test.ts` receipt validator case |

## Out of scope retained

| Item | Owner |
|---|---|
| Membership and invitation pages | `EEM-9/06` wires into the shared mechanism only |
| Backend ceremony, freshness projection, error code | Backend `EEM-4/05`, consumed by `EEM-9/03g` |
| Email OTP step | Excluded by ADR; TOTP-only |

## Verification recorded for this branch

- Focused slice `reauthentication`: lint, typecheck, unit and contract tests listed in `scripts/console_test_slices.json`, Playwright specs above.
- Affected slices `imports` and `memory-review` after shared-surface edits.
- Complete free gate after bytes frozen.

Deployment state: implemented and locally verified only. Not merged, not deployed,
not observed, not staging-certified, not paid-certified, not production-certified.
