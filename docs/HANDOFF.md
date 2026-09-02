# Dashboard handoff

Updated: 2026-09-02

## Current state

- Active task: EEM-9/02b, correcting the Console response envelope before
  EEM-9/03 consumes it.
- Branch: `EEM-9/02b-response-envelope`, based on Dashboard `main` at `5ff0c0c`,
  which merged PR
  [#4](https://github.com/Evirion/evirion-engineering-memory-dashboard/pull/4).
- EEM-9/02 is merged. Its Definition-of-Done trace is
  [`plans/active/eem-9-02-acceptance-trace.md`](plans/active/eem-9-02-acceptance-trace.md).
- The backend pointer verifies at commit
  `a6665b599472e295636382ece4d0071e1cb4492c` and package digest
  `6897d9661a038a14eee0fd8128e7a3e96d5b191ef41f197f621779cc2e0ec56f`. It reads
  the pinned commit rather than Dashboard `main`, so it keeps verifying after
  the EEM-9/02 merge moved the authority digest.
- Prerequisite check for EEM-9/03: all EEM-6 subtasks are merged in the backend,
  ending with PR
  [#37](https://github.com/Evirion/evirion-engineering-memory/pull/37). That
  commit is an ancestor of `20cd3b60`, the source commit recorded by
  [`contracts/console-contract-lock.json`](contracts/console-contract-lock.json),
  so the single Console contract lock already covers the repository,
  entitlement and GitHub operations. No separate EEM-6 contract lock exists and
  none is needed.
- This work is committed on its branch and not pushed. No pull request exists.

## What changed here and why

- **The Console never unwrapped the response envelope.** The backend answers
  every route, internal ones included, through one success responder that emits
  `{contractVersion, requestId, data}`. The Console passed that whole document
  to a generated payload validator, and those validators reject unknown keys, so
  every real success would have become an `unsupported` failure and every
  protected page would have rendered its fail-closed unavailable state.
- **The fixtures hid it.** `transportReturning(200, sessionContext)` sent the
  bare payload, so the test proved the validator agreed with itself. The
  fixtures were corrected to the bytes the backend sends rather than the
  expectations being relaxed, because only that closes the class of defect.
- **The check is symmetric, not just an unwrap.** The generated `isConsoleError`
  already pins `contractVersion` and requires a UUID `requestId`. The success
  path now applies the same three checks before handing `data` onward, so a
  backend version bump cannot pass one way and fail the other.
- `ConsoleResult` carries `requestId` on success, which EEM-9/06 needs for the
  `PROC-002` support path.
- `src/server/queries/invitation-choices.ts` had the same assumption and now
  reuses the adapter's guard rather than carrying a second envelope handler.

## Decisions a reviewer should check first

- The generator and the contract were deliberately not touched. The asymmetry is
  the contract's own: `Error` models a complete response body while all
  eighteen payload schemas model the `data` member. Changing that is a contract
  release and a new frozen digest, not an implementation fix.
- Operation-to-validator binding is an adapter convention. The contract binds no
  operation to a payload schema: all 41 success responses reference the bare
  `SuccessEnvelope`, whose `data` property carries no type or `$ref`, and there
  is no `allOf` anywhere.

## Security and release state

- The Auth/session contract is unchanged and remains frozen at the values
  `src/lib/auth/session-policy.ts` mirrors.
- No token, cookie, CSRF or origin behavior changed. The envelope check runs
  after transport and before any payload reaches a page, so a malformed document
  still fails closed rather than rendering partially.
- `SEC-2026-012` remains open under the approved GitHub Free bootstrap waiver
  and remains readiness-blocking.
- Technical Design Partner Ready remains blocked.
- No hosted Supabase setting was read or changed, no worker ran, no provider was
  called and no paid operation was authorized. The backend repository was read
  with `git show` at the pinned commit and never modified.

## Verification and next action

Lint, format, `tsc --noEmit`, 253 Vitest tests, a production build, and 45
Playwright tests over the pinned origin `https://console.evirion.test:3443` all
pass. Local Node is 22.18.0 against a baseline pin of 24.20.0, which affects
installation rather than these gates; CI runs the pinned runtime.

The next action is review, then merge, then start `EEM-9/03-repository-control`
from updated `main`. EEM-9/03 must not be stacked on this branch.

Commit, push, pull request, and merge each require separate explicit
authorization. Accessibility open decision 1 is unresolved and is due before
EEM-9/07.

## Open decision 6 is a contract gap, not only a product question

Whether `/repositories/:repositoryId` shows repository counters cannot be
answered by product alone. There is no `repository-overview.json` among the
eighteen contract schemas and no `RepositoryOverview` among the eighteen
generated types, so the counters have no validated shape for either EEM-9/03 or
their owner EEM-9/06. Rendering them requires adding a schema to the contract,
which is a backend change and a new frozen digest. It is recorded here so it is
resolved before EEM-9/06 starts rather than rediscovered there.
