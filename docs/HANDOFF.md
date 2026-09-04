# Dashboard handoff

Updated: 2026-09-04

## Current state

- Active branch: `docs/amend-proc-002`, a documentation-only amendment closing
  issue
  [#17](https://github.com/Evirion/evirion-engineering-memory-dashboard/issues/17).
  Implemented and locally verified; not merged.
- `main` is at `e037a76`, which merged `EEM-9/05-memory-review-lifecycle` as PR
  [#15](https://github.com/Evirion/evirion-engineering-memory-dashboard/pull/15),
  after the documentation commit `892c6e7`, `EEM-9/03f` as PR
  [#13](https://github.com/Evirion/evirion-engineering-memory-dashboard/pull/13),
  `EEM-9/04c` as PR
  [#12](https://github.com/Evirion/evirion-engineering-memory-dashboard/pull/12),
  `EEM-9/04b` as PR
  [#11](https://github.com/Evirion/evirion-engineering-memory-dashboard/pull/11),
  `EEM-9/03e` as PR
  [#10](https://github.com/Evirion/evirion-engineering-memory-dashboard/pull/10)
  and `EEM-9/04-import-operations` as PR
  [#9](https://github.com/Evirion/evirion-engineering-memory-dashboard/pull/9).
- The backend pointer still verifies at commit
  `a6665b599472e295636382ece4d0071e1cb4492c` and package digest
  `6897d9661a038a14eee0fd8128e7a3e96d5b191ef41f197f621779cc2e0ec56f`, because it
  reads the pinned commit rather than Dashboard `main`.
- `console-contract-v1.0.2` is consumed and this amendment adds, removes and
  changes no contract bytes. All three contract gaps found while building the
  Console remain closed.
- **`EEM-9/06` is unblocked.** It no longer owns a call to action the backend
  cannot serve, and it is the next task in the accepted order.

## What changed here and why

- **`PROC-002` is amended, not served.** It required the Console to render a
  retry action whenever a backend response declared the capability
  `NONE | RETRY | RESUME | CONTACT_SUPPORT`. Nothing publishes that capability
  on the processing surface, and two of its four values name operations that do
  not exist.
- **The processing surface is read-only.** Failure detail shows the stable
  error and a correlation ID, and a support direction is static Console copy
  rather than a backend-declared capability. That distinction is the substance
  of the amendment.
- **Import recovery is untouched.** The eight-value `recoveryAction` served by
  `private.b06a_import_recovery_action` is real, and EEM-9/04 already renders
  it.
- **A named backend test that never existed is removed.** `PROC-002` cited
  `test_console_customer_operations_live.py::test_retry_uses_backend_capability_and_checkpoint`
  as primary evidence under owner `B06A`. Neither that test nor that file is in
  the backend repository. The row moves to `C06` with Console evidence.
- **Rationale is recorded**, in
  [ADR-0006](decisions/0006-no-customer-retry-of-a-live-extraction.md).

## Decisions a reviewer should check first

- **Every claim was verified before a word changed.** The two import-scoped
  retry operations, the absent response-schema binding on
  `listProcessingActivity`, the eight-value enum on the two import schemas, and
  the absence of the named backend test were each read from the pinned contract
  bytes and the backend repository rather than taken from the issue.
- **The ownership move from `B06A` to `C06` is deliberate.** After the
  amendment `PROC-002` asserts an absence on a Console surface, and no backend
  test can prove it. Naming a forward C06 test is not the defect being fixed:
  every C06 row names a test that subtask writes, whereas the removed row
  claimed evidence a merged backend subtask had already produced.
- **Two backend-source documents were deliberately left alone.** The
  controlling EEM-9 plan at lines 791 and 860 and the program design at line
  501 still carry the superseded assignment. This repository is not their
  source, and moving the controlling plan would require the paired
  stable-pointer change this amendment is not authorized to make. Both are
  named in ADR-0006 and in the pull request.
- **The recovery clause was not deleted.** A customer whose extraction failed
  still needs to know what happens next, so `J-010` became two journeys rather
  than one truncated one.

The `EEM-9/05` review points this section used to carry are in
[`eem-9-05-acceptance-trace.md`](plans/active/eem-9-05-acceptance-trace.md) and
in the changelog entry for that subtask.

## Security and release state

- The Auth and session contract is unchanged. This amendment changed no
  contract bytes, no lock, no trust policy, no Auth parity pin and no generated
  client.
- No runtime source, schema or test file changed. The change is documentation
  and the two registries generated from it.
- No provider was called, no paid operation was authorized, no worker ran, no
  hosted Supabase setting was read or changed, and nothing was deployed.
- No service-role key, DSN, GitHub token, provider key, raw model response or
  Source Envelope body exists in this process or in any committed file.
- `SEC-2026-012` remains open under the approved GitHub Free bootstrap waiver
  and remains readiness blocking.
- Technical Design Partner Ready remains blocked.

## Verification and next action

This is a documentation-only change, so it reruns the documentation, acceptance
and authority gates and does not justify unrelated runtime gates. The
standard-library test suite, `check_docs`, the acceptance-map, ASVS and
security-control generators, `check_authority` and `scan_tracked_secrets` all
pass. The acceptance map stays at 392 rows. The authority `packageSha256` moved
because packaged documents changed, and it was rebuilt and reverified rather
than assumed.

The Node gate, Playwright, Semgrep and Gitleaks were last run in full at
`EEM-9/05` and no input to any of them changed here.

One caution for a later local gate: start with ports 3000, 3443 and 3444 free,
and check them rather than trusting `pkill`. A stub left on 3444 is reused
silently because `reuseExistingServer` is on outside CI. It bit once during
`EEM-9/05`: three tests failed in a combined run and passed individually
moments later with no source change between them.

The next action is `EEM-9/06-processing-settings-metrics`, after this branch is
reviewed and merged. It inherits no contract gap and no unserveable
requirement.

Commit, push, pull request, and merge each require separate explicit
authorization.

## Contract gaps: all three closed

Every gap found while building the Console is closed and consumed. Backend issues
[#53](https://github.com/Evirion/evirion-engineering-memory/issues/53) repository
overview,
[#54](https://github.com/Evirion/evirion-engineering-memory/issues/54) model
profiles, and
[#58](https://github.com/Evirion/evirion-engineering-memory/issues/58) the
knowledge read and receipt contract. The first two arrived in
`console-contract-v1.0.1` and the third in `v1.0.2`.

Backend issue
[#60](https://github.com/Evirion/evirion-engineering-memory/issues/60) is open
and is process rather than contract: nothing requires anyone to check that a
candidate contract is consumable before its release is signed immutable, and the
`uri` blocker this subtask hit was caught only because the rehearsal was run by
hand.

## Two contract limits EEM-9/05 raised

Neither blocked the surface and neither is a gap that stopped work. Both are
additive requests, recorded in full in
[`eem-9-05-acceptance-trace.md`](plans/active/eem-9-05-acceptance-trace.md).

The first is the reauthentication one above: a distinct error code, plus either
widening `session-context.session.status` to the enum `session.json` already
publishes or adding a freshness field. Without one of them the Console cannot
tell "sign in" apart from "you are signed in, but this needs a fresher proof".

The second is that `error.json` bounds `currentVersion` below at one while both
knowledge tokens legitimately reach zero, so a conflict against `PENDING` or
`UNRESOLVED` cannot report what the state now is. That is the most common
starting state in a review queue, and raising it alongside the first would cost
nothing extra.

Accessibility open decision 1 is unresolved and is due before EEM-9/07. Open
decisions 2, 3, 4 and 5 remain open and are carried, not answered. Decision 4
lands hardest on this surface, which owns four list surfaces; every acceptance
row asserts an accessible name or per-item state so a later table or card
decision invalidates none of them. Decision 6 is closed.
