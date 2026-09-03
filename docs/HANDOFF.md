# Dashboard handoff

Updated: 2026-09-03

## Current state

- Active task: `EEM-9/04-import-operations`, implemented and locally verified on
  branch `EEM-9/04-import-operations`, six commits, not pushed. No pull request
  exists.
- `main` is at `f70b67f`, which is EEM-9/03 plus two documentation follow-ups
  merged as PRs
  [#7](https://github.com/Evirion/evirion-engineering-memory-dashboard/pull/7)
  and
  [#8](https://github.com/Evirion/evirion-engineering-memory-dashboard/pull/8).
  This branch starts from it.
- The backend pointer verifies at commit
  `a6665b599472e295636382ece4d0071e1cb4492c` and package digest
  `6897d9661a038a14eee0fd8128e7a3e96d5b191ef41f197f621779cc2e0ec56f`. It reads
  the pinned commit rather than Dashboard `main`, so it keeps verifying as this
  repository moves, and it still verified after this branch moved the authority
  digest.
- No new contract bytes were consumed. All six import operations and both import
  schemas were already published in `console-contract-v1.0`.

## What changed here and why

- **EEM-9/04 adds the historical-import surface** at
  `/repositories/:repositoryId/import`, which EEM-9/01 froze and which is now
  present in the reviewed route inventory.
- **The generator had to learn one type first.** Four import operations answer
  with `RepositoryImportReceipt`, which the contract declares inline in
  `openapi.yaml` and in no schema file, so the generator emitted nothing for it
  and `isCommandReceipt` could not stand in. Every import mutation would have
  been classified as an unsupported server response. The bytes are signed and
  digest verified, so the type is generated rather than hand-written.
- **The two waits are the point of the subtask.** Waiting for the customer's
  approval is the only one of six authorization states with a control; waiting
  for Evirion carries none and says so. Approving records consent and never
  produces `AUTHORIZED`, and the API double implements that transition so the
  claim is asserted against behaviour rather than against copy.
- **Progress is nine counters, not five.** The contract publishes no `processed`
  and no `total`, so the page states completed and failed work against what
  discovery found and names it as a derivation.
- Full detail and the Definition-of-Done mapping are in
  [`plans/active/eem-9-04-acceptance-trace.md`](plans/active/eem-9-04-acceptance-trace.md).

## Decisions a reviewer should check first

- **The generator now reads `openapi.yaml` as well as `schemas/*.json`**, using
  a standard-library subset reader rather than a YAML dependency, because the
  Python gate is dependency free by design. The projection rule takes a fully
  declared envelope's `data`, which keeps the new type parallel to every other
  generated one and needs no second transport path. It matches exactly one
  component today and a test pins that. `generatedClientSurfaceSha256` moved to
  `b5a6facb4862323122e4483ee883fad00c1e271003fe5fff18cbff3a5b6c6797`.
- **The contract names no capability for the import operations.** The run
  projection's own per-caller `capabilities` decides approve, pause, resume and
  cancel. Preparing and retrying have no such projection and fall back to
  `repository.policy.manage`, the nearest published capability. That fallback is
  recorded as an assumption; it is a convenience, and the browser suite proves
  the backend refuses a read-only principal that posts anyway.
- **Polling is the Console's first product client component.** Meta refresh
  cannot back off, cap itself or stop on a hidden tab, and architecture
  Section 21.1 permits a client component for polling. It refreshes the server
  route and reads nothing itself, so the caller token stays server-side.

## Security and release state

- The Auth and session contract is unchanged.
- No provider was called, no paid operation was authorized, no worker ran, no
  hosted Supabase setting was read or changed, and nothing was deployed.
- No service-role key, DSN, GitHub token, provider key, raw model response or
  Source Envelope body exists in this process, and a browser test asserts none
  reaches the document on the surface that talks about money.
- `SEC-2026-012` remains open under the approved GitHub Free bootstrap waiver
  and remains readiness blocking.
- Technical Design Partner Ready remains blocked.

## Verification and next action

Lint, format, `tsc --noEmit`, 554 Vitest tests, a production build, 121
Playwright tests over the pinned origin `https://console.evirion.test:3443`, 94
Python tests, Semgrep with no findings, digest-verified Gitleaks over 37 commits
with no leaks, the authority package, the documentation tree and the Console
contract lock all pass, and the generated client reproduces byte for byte from
the pinned contract. Local Node is 22.18.0 against a baseline pin of 24.20.0,
which affects installation rather than these gates; CI runs the pinned runtime.

One caution for a local gate: `playwright.config.ts` sets
`reuseExistingServer: !process.env.CI`, so a stub left listening on port 3444 by
an earlier run is reused silently and serves that older process's fixtures.
Every browser test then fails at scenario load with a `500`. Kill
`tools/console-stub/server.mjs` and `tools/local-tls/serve.mjs` first.

The next action is to review this branch and decide whether to open its pull
request. `EEM-9/05-memory-review-lifecycle` follows, and its prerequisite is
that EEM-9/04 and all EEM-8 subtasks are merged.

Commit, push, pull request, and merge each require separate explicit
authorization.

## Two contract gaps to resolve before EEM-9/06

Open decision 6, whether `/repositories/:repositoryId` shows repository
counters, is contract blocked: there is no `repository-overview.json` among the
published schemas, so neither EEM-9/03 nor EEM-9/06 can validate such a
response. Separately, no endpoint enumerates the model profiles an
`AUTO_EXTRACT` consent may name, and the format the contract admits cannot
express the identifier the worker builds, so the paid gate could never match.

Both are raised as backend issues
[#53](https://github.com/Evirion/evirion-engineering-memory/issues/53), assigned
`EEM-8/07-repository-overview-contract`, and
[#54](https://github.com/Evirion/evirion-engineering-memory/issues/54), assigned
`EEM-7/05-model-profile-registry`. The Dashboard consumes both in one later
subtask rather than two, which `docs/ROADMAP.md` records.

Neither blocks EEM-9/04: historical import reads no model profile and no
repository overview.

Accessibility open decision 1 is unresolved and is due before EEM-9/07.
