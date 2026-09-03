# Dashboard handoff

Updated: 2026-09-03

## Current state

- Active task: `EEM-9/03e-console-contract-revision`, implemented and locally
  verified on branch `EEM-9/03e-console-contract-revision`, six commits, not
  pushed. No pull request exists.
- `main` is at `6467a74`, which is EEM-9/04 merged as PR
  [#9](https://github.com/Evirion/evirion-engineering-memory-dashboard/pull/9).
  This branch starts from it. The previous handoff described EEM-9/04 as
  unpushed with no pull request; that was true when written and is now stale.
- The backend pointer still verifies at commit
  `a6665b599472e295636382ece4d0071e1cb4492c` and package digest
  `6897d9661a038a14eee0fd8128e7a3e96d5b191ef41f197f621779cc2e0ec56f`, because it
  reads the pinned commit rather than Dashboard `main`.
- This branch consumes `console-contract-v1.0.1`. Both contract gaps that
  blocked EEM-9/06 are now closed in this repository.

## What changed here and why

- **The frozen trust policy could not verify the release.** It pinned a
  two-component tag grammar, and `console-contract-v1.0.1` carries a revision.
  The `console-contract-v1` entry now mirrors backend ADR 0014 exactly, widened
  by the optional revision component and nothing else. This is the first commit
  and is deliberately readable on its own.
- **The release is consumed.** Archive `a116ae5c`, `packageSha256` `29ff7b73`,
  source commit `2458f333`. `contractVersion` stays `1.0`, so no pinned envelope
  guard moved and no Console read broke.
- **The counters answer open decision 6.** Seventeen, not the sixteen `REPO-003`
  names; the extra is `withdrawn`, which issue #53 resolved deliberately.
- **The consent field is a catalogue choice.** Free text is gone, and validation
  is the published set in addition to the contract pattern.
- Full detail and the mapping of every changed behaviour to a test is in
  [`plans/active/eem-9-03e-acceptance-trace.md`](plans/active/eem-9-03e-acceptance-trace.md).

## Decisions a reviewer should check first

- **The trust-boundary amendment is the load-bearing change.** Read the first
  commit alone. The question to ask is whether the widened grammar admits
  anything beyond a revision; a test asserts it does not, and a second compares
  the pattern against the backend literal it mirrors so the two cannot drift.
- **`policyDigest` moved, so the recorded evidence had to move with it.** It was
  re-observed rather than edited: `console-contract-v1.0` was downloaded again
  and re-verified against the amended policy before its digest changed.
- **The surface digest moved and the gate calls that a breaking change.** It is
  not one. The digest is over sorted export names, so any new schema moves it;
  four exports were added and none removed or renamed.
- **"Never render an unavailable aggregate as zero" is structural here.** Every
  counter is required by the schema, so an uncomputable one fails validation and
  the whole block reports unavailable. That is why a rendered zero is always a
  real zero.
- **A withdrawn profile is scoped to one repository.** The contract's
  `namedByActiveConsent` is organization-wide; filtering on it alone reported one
  repository's withdrawal on every other repository's page. Found by the
  self-audit and fixed in the last commit.

## Security and release state

- The Auth and session contract is unchanged. The Auth parity lock follows the
  contract source commit and was re-pinned to `2458f333`; both files it records
  are byte-identical at the old and new commits, so no derived value moved.
- No provider was called, no paid operation was authorized, no worker ran, no
  hosted Supabase setting was read or changed, and nothing was deployed.
- No service-role key, DSN, GitHub token, provider key, raw model response or
  Source Envelope body exists in this process or in any committed file.
- One recorded deviation: the release assets were downloaded with the operator's
  own `gh` credential rather than the short-lived minimum-scope credential the
  policy names. The credential gates read access only; the pinned digest and the
  signature verification establish trust, and both were checked.
- `SEC-2026-012` remains open under the approved GitHub Free bootstrap waiver
  and remains readiness blocking.
- Technical Design Partner Ready remains blocked.

## Verification and next action

Lint, format, `tsc --noEmit`, 613 Vitest tests, a production build, 126
Playwright tests over the pinned origin `https://console.evirion.test:3443`, 98
Python tests, Semgrep with no findings, digest-verified Gitleaks over 45 commits
with no leaks, the authority package, the documentation tree, backend Auth
parity and the Console contract lock all pass, and the generated client
reproduces byte for byte from the pinned contract.

Both published releases verify offline with the pinned `cosign-linux-amd64`
against the pinned trusted root, in a network-isolated `linux/amd64` container.
A control run without the trusted root fails at TUF refresh, which is what
proves the pinned root was used rather than a fetched one.

One caution for a local gate: start with ports 3000, 3443 and 3444 free, and
check them rather than trusting `pkill`. A stub left on 3444 is reused silently
because `reuseExistingServer` is on outside CI.

The next action is to review this branch and decide whether to open its pull
request. **It also needs an owner decision that EEM-9/04 did not:** consuming
this release moved the Dashboard authority `packageSha256`, so whether a paired
backend successor pointer follows is a decision taken on that value.

`EEM-9/05-memory-review-lifecycle` follows, and its prerequisite is that all
EEM-8 subtasks are merged.

Commit, push, pull request, and merge each require separate explicit
authorization.

## Contract gaps: both now closed

Open decision 6 and the missing model-profile catalogue were both contract
blocked. Backend issues
[#53](https://github.com/Evirion/evirion-engineering-memory/issues/53) and
[#54](https://github.com/Evirion/evirion-engineering-memory/issues/54) are
closed, their schemas are published in `console-contract-v1.0.1`, and this
branch consumes them. `EEM-9/06` no longer inherits either gap.

Accessibility open decision 1 is unresolved and is due before EEM-9/07. Open
decisions 2, 3, 4 and 5 remain open and are carried, not answered, by this
subtask.
