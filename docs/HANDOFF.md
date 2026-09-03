# Dashboard handoff

Updated: 2026-09-03

## Current state

- Active task: `EEM-9/05-memory-review-lifecycle`, implemented and locally
  verified on its branch. `main` is at `892c6e7`, which is a documentation
  commit on top of `EEM-9/03f` merged as PR
  [#13](https://github.com/Evirion/evirion-engineering-memory-dashboard/pull/13),
  after `EEM-9/04c` as PR
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
- `console-contract-v1.0.2` is consumed and this subtask adds no contract bytes.
  All three contract gaps found while building the Console remain closed.
- **The memory surface exists.** Three frozen routes moved from declared to
  present, and `EEM-9/06` is the next task in the accepted order.

## What changed here and why

- **The knowledge surface is built.** The review queue at `/memory` and
  `/repositories/:repositoryId/memory`, the detail at
  `/memory/:knowledgeObjectId`, and four BFF routes under `/api/memory/`.
- **Review and lifecycle are two axes, not one status.** An object can be
  reviewed and unresolved, or active and later re-reviewed. Every surface and
  every outcome notice says which one moved and which did not.
- **The edit is a derivative.** The machine extraction and the reviewer's words
  sit side by side; the original is never overwritten, hidden or offered for
  discard, and `humanEdited` is read from the backend rather than inferred.
- **Two contract limits were found and recorded rather than worked around.** See
  the trace; both are additive backend requests and neither blocked the surface.

## Decisions a reviewer should check first

- **The reauthentication precondition is stated, not evaluated.** Three of the
  four mutations require recent reauthentication per their own operation
  description. `session-context.json` pins `session.status` to `"const":
  "ACTIVE"`, so the live projection is structurally unable to report the
  `REAUTH_REQUIRED` that `session.json` publishes, and no error code separates
  stale freshness from being signed out. Each confirm step says the action may
  ask you to sign in again and claims nothing more. Building the step-up flow
  here was declined: nonce, action-class binding and return-to-action are a new
  auth state machine on EEM-9/02's boundary.
- **The four receipt codes are read by this surface, not by the shared reader.**
  None is a published error code, so routing one through `readCommandResult`
  would report an unknown outcome for a command that committed. That is the
  defect EEM-9/04 shipped on its own receipt; a test pins both that the shared
  reader still fails closed on all four and that this subtask left it unchanged.
- **Supersession takes two steps deliberately.** `J-006` requires the direction
  to be displayed and confirmed, and the mutation carries four tokens. Selecting
  the replacement first is what lets the reviewer observe all four before
  submitting rather than have the Console fetch two behind their back.
- **A conflict against zero omits `currentVersion`.** The schema bounds it below
  at one while both tokens legitimately reach zero. Sending zero anyway fails
  the generated validator and turns a stated refusal into an unknown outcome,
  which is how the limit was found.
- **The `/memory` queue reads the repository inventory** to offer the repository
  predicate as named options. A failed read drops the predicate rather than the
  queue.

## Security and release state

- The Auth and session contract is unchanged, and this subtask changed no
  contract bytes, no lock and no Auth parity pin.
- No provider was called, no paid operation was authorized, no worker ran, no
  hosted Supabase setting was read or changed, and nothing was deployed.
- No service-role key, DSN, GitHub token, provider key, raw model response or
  Source Envelope body exists in this process or in any committed file, and
  `tests/security/memory-boundary.spec.ts` asserts none reaches the document.
- `SEC-2026-012` remains open under the approved GitHub Free bootstrap waiver
  and remains readiness blocking.
- Technical Design Partner Ready remains blocked.

## Verification and next action

Lint, `prettier --check`, `tsc --noEmit`, 722 Vitest tests, a production build
and 233 Playwright tests over the pinned origin
`https://console.evirion.test:3443` pass as one complete free gate on frozen
bytes. Counts are from the final tree.

The Python gate, Semgrep, Gitleaks, the authority package and the documentation
tree were last run in full at `EEM-9/03f` and no input to any of them changed
except the documents and registries this subtask updates, which the authority
package check covers.

One caution for a local gate: start with ports 3000, 3443 and 3444 free, and
check them rather than trusting `pkill`. A stub left on 3444 is reused silently
because `reuseExistingServer` is on outside CI. It bit once here: three tests
failed in a combined run and passed individually moments later with no source
change between them.

The next action is `EEM-9/06-processing-settings-metrics`, after this branch is
reviewed and merged. It inherits no contract gap.

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
