# Dashboard handoff

Updated: 2026-09-02

## Current state

- Active task: none. EEM-9/03 is merged as PR
  [#6](https://github.com/Evirion/evirion-engineering-memory-dashboard/pull/6)
  at `961001d`, and EEM-9/02b before it as PR
  [#5](https://github.com/Evirion/evirion-engineering-memory-dashboard/pull/5).
- Branch: `EEM-9/03c-link-recorded-gaps`, a documentation-only follow-up. The
  commit that pointed the recorded gaps at their backend issues was written
  after PR #6 was already merged, so it never reached `main`. It carries the
  correction plus this delivery-state update.
- The backend pointer verifies at commit
  `a6665b599472e295636382ece4d0071e1cb4492c` and package digest
  `6897d9661a038a14eee0fd8128e7a3e96d5b191ef41f197f621779cc2e0ec56f`. It reads
  the pinned commit rather than Dashboard `main`, so it keeps verifying as this
  repository moves.
- All EEM-6 subtasks are merged in the backend, ending with PR
  [#37](https://github.com/Evirion/evirion-engineering-memory/pull/37). That
  commit is an ancestor of `20cd3b60`, the source commit
  [`contracts/console-contract-lock.json`](contracts/console-contract-lock.json)
  records, so the single Console contract lock already carries the repository,
  entitlement and GitHub operations. No separate EEM-6 lock exists and none is
  needed.
- Both branches are committed and not pushed. No pull request exists.

## What changed here and why

- **EEM-9/02b corrected the response envelope** and is merged as PR
  [#5](https://github.com/Evirion/evirion-engineering-memory-dashboard/pull/5).
  The backend answers every
  route through one success responder emitting
  `{contractVersion, requestId, data}`, and the Console validated that whole
  document against a generated payload schema. Every real success would have
  been classified unsupported. The transport fixtures hid it by sending the
  bare payload.
- **EEM-9/03 adds the repository surface.** GitHub access, Evirion entitlement
  and live processing policy are rendered as three independent axes; capacity,
  replacement mode, generation and operator decisions are read from the backend
  and never chosen locally; and every command carries a canonical idempotency
  key and the backend's own expected version in the body the contract defines.
- **The four confusable terms stay apart.** Source work, customer consent,
  Evirion operational authorization and paid execution are separately named,
  explained and attributed on every policy surface.
- Full detail and the Definition-of-Done mapping are in
  [`plans/active/eem-9-03-acceptance-trace.md`](plans/active/eem-9-03-acceptance-trace.md).

## Decisions a reviewer should check first

- Two defects in merged code were fixed with explicit owner agreement, and both
  are load-bearing rather than cosmetic. `Referrer-Policy: no-referrer` made
  Chrome send `Origin: null` on form navigations, so no native form post in the
  Console could ever succeed. `form-action 'self'` blocked the GitHub App
  handoff, because Chrome applies the directive to the whole redirect chain.
  Neither change weakens what its control exists to prevent.
- The browser gate now runs against a Console API double. It exists because
  `CONSOLE_API_BASE_URL` pointed at a host that does not resolve, so no
  journey, conflict or tenant assertion was previously possible. Its fixtures
  are validated by the generated contract schemas, and a coverage assertion
  fails if a published product state has no fixture.
- `CONSOLE_GITHUB_APP_INSTALL_URL` is a new required server variable. It is
  deployment configuration rather than a credential; the App key and
  installation tokens stay in the backend control plane.

## Security and release state

- The Auth/session contract is unchanged.
- No App private key, client secret or installation token exists in this
  process. The one-time setup-intent state necessarily transits the browser,
  because that is what the handoff is; it is single use, never logged here, and
  the backend retains only its hash.
- `SEC-2026-012` remains open under the approved GitHub Free bootstrap waiver
  and remains readiness-blocking.
- Technical Design Partner Ready remains blocked.
- No real GitHub App was connected, no GitHub API was called, no hosted
  Supabase setting was read or changed, no worker ran, no provider was called
  and no paid operation was authorized. The backend repository was read with
  `git show` at the pinned commit and never modified.

## Verification and next action

Lint, format, `tsc --noEmit`, 423 Vitest tests, a production build, 83
Playwright tests over the pinned origin `https://console.evirion.test:3443`, 58
Python tests, Semgrep with no findings, digest-verified Gitleaks over the full
history, the authority package, the documentation tree and the Console contract
lock all pass. One bounded review wave ran: the security reviewer found nothing
at medium severity or above, and the correctness reviewer's three
contract-fidelity findings are fixed and pinned by test. Local Node is 22.18.0 against a baseline pin of
24.20.0, which affects installation rather than these gates; CI runs the pinned
runtime.

That gate describes the EEM-9/03 tree that merged. This follow-up changes only
documentation, so it reruns the documentation, authority and contract-lock
checks rather than the runtime ones.

The next action is EEM-9/04. Its prerequisites are met, with one caveat that is
naming rather than work: the EEM-9 plan requires "all EEM-7 subtasks are
merged", and the model-profile registry has been assigned `EEM-7/05`, which
would draw EEM-9/04 into waiting for a task unrelated to imports. Resolve that
before starting, either by numbering the registry outside EEM-7 or by recording
that the prerequisite means the subtasks that existed when the plan was frozen.

Commit, push, pull request, and merge each require separate explicit
authorization.

## Two contract gaps to resolve before EEM-9/06

Open decision 6, whether `/repositories/:repositoryId` shows repository
counters, cannot be answered by product alone. The contract publishes no
schema for them: there is no `repository-overview.json` among the eighteen
schemas and no `RepositoryOverview` among the eighteen generated types, so
neither EEM-9/03 nor EEM-9/06 can validate such a response. Answering yes
requires a backend contract change and a new frozen digest.

In the same conversation: no endpoint enumerates the model profiles an
`AUTO_EXTRACT` consent may name, and the format the contract admits cannot
express the identifier the worker builds, so the paid gate could never match.

Both are raised as backend issues
[#53](https://github.com/Evirion/evirion-engineering-memory/issues/53), assigned
`EEM-8/07-repository-overview-contract`, and
[#54](https://github.com/Evirion/evirion-engineering-memory/issues/54), assigned
`EEM-7/05-model-profile-registry`. They are tracked there rather than only here,
because the work belongs to the backend and a record in this repository would
not reach it.

Accessibility open decision 1 is unresolved and is due before EEM-9/07.
