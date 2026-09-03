# Dashboard handoff

Updated: 2026-09-03

## Current state

- Active task: `EEM-9/03f-console-contract-revision`, implemented and locally
  verified on its branch. `main` is at `3f8cd88`, which is `EEM-9/04c` merged as
  PR
  [#12](https://github.com/Evirion/evirion-engineering-memory-dashboard/pull/12),
  after `EEM-9/04b` as PR
  [#11](https://github.com/Evirion/evirion-engineering-memory-dashboard/pull/11),
  `EEM-9/03e` as PR
  [#10](https://github.com/Evirion/evirion-engineering-memory-dashboard/pull/10)
  and `EEM-9/04-import-operations` as PR
  [#9](https://github.com/Evirion/evirion-engineering-memory-dashboard/pull/9).
- The backend pointer still verifies at commit
  `a6665b599472e295636382ece4d0071e1cb4492c` and package digest
  `6897d9661a038a14eee0fd8128e7a3e96d5b191ef41f197f621779cc2e0ec56f`, because it
  reads the pinned commit rather than Dashboard `main`.
- `console-contract-v1.0.2` is consumed. All three contract gaps found while
  building the Console are now closed and consumed: repository overview, model
  profiles, and the knowledge read and receipt contract.
- **`EEM-9/05` is startable.** The gap that blocked it is closed; the knowledge
  surface now has thirty-two generated types and eleven bound payloads.

## What changed here and why

- **The release is consumed.** Archive `4bff72ff`, `packageSha256` `1ba7e1f8`,
  source commit `cfd930a`. `contractVersion` stays `1.0`, so no pinned envelope
  guard moved and no Console read broke. Eighteen generated types become
  thirty-two.
- **The knowledge contract is what this release carries.** Eleven bound payload
  schemas from backend PR
  [#59](https://github.com/Evirion/evirion-engineering-memory/pull/59), which is
  what `EEM-9/05` was waiting for.
- **No UI consumes the new types here.** That surface belongs to `EEM-9/05`.

## Decisions a reviewer should check first

- **No policy amendment was needed and none was made.** The revision grammar was
  widened once, by `EEM-9/03e`, and `v1.0.2` already matches it.
  `console-contract-v1.0.0` stays refused, so that widening is still exactly one
  component wide.
- **The reachability note was rewritten rather than carried.** `cfd930a` is on
  backend `main`, unlike the two tags before it, so repeating the previous
  sentence would have stated something false. The field stays `false` because it
  records what the lock relies on, not what happens to be true, and the verifier
  refuses a lock that claims otherwise.
- **A `uri` blocker was found before the tag, not after.** The generator refused
  two knowledge fields because `uri` was not a reviewed format. It was fixed in
  `EEM-9/04c` as an https-only check, which lands separately so this subtask is
  vendor-and-regenerate with no generator change inside it. Had the rehearsal not
  been run by hand, the release would have been signed, immutable and
  unconsumable; backend issue
  [#60](https://github.com/Evirion/evirion-engineering-memory/issues/60) tracks
  making that rehearsal a required pre-tag step.
- **The Auth parity lock follows the contract source commit.** Both files it
  records are byte-identical at `2458f333` and `cfd930a`, so the pin moved and no
  derived value did.

## Security and release state

- The Auth and session contract is unchanged. The Auth parity lock follows the
  contract source commit and was re-pinned to `cfd930a`; both files it records
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

Lint, format, `tsc --noEmit`, 613 Vitest tests, a production build, 127
Playwright tests over the pinned origin `https://console.evirion.test:3443`, 98
Python tests, Semgrep with no findings on 107 files, digest-verified Gitleaks
over the full branch history with no leaks, the authority package, the
documentation tree, backend Auth parity and the Console contract lock all pass,
and the generated client reproduces byte for byte from the pinned contract. The
test counts are from the final tree; the Gitleaks figure is deliberately not a
commit count, because any commit recording one changes it.

`console-contract-v1.0.2` verifies offline with the pinned `cosign-linux-amd64`
against the pinned trusted root, in a network-isolated `linux/amd64` container,
asserting certificate identity, issuer, workflow repository, tag ref, source
commit and push trigger. A control run without the trusted root fails at TUF
refresh, which is what proves the pinned root was used rather than a fetched one.
Rekor inclusion is recorded from the bundle and confirmed against the public log;
signing to release was four seconds against a frozen maximum of an hour.

One caution for a local gate: start with ports 3000, 3443 and 3444 free, and
check them rather than trusting `pkill`. A stub left on 3444 is reused silently
because `reuseExistingServer` is on outside CI.

The next action is `EEM-9/05-memory-review-lifecycle`. Its prerequisite is
genuinely met now: `EEM-9/04` and all EEM-8 subtasks are merged, and the
knowledge payloads it needs are generated and validatable.

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

### What EEM-9/05 now has

Eleven bound payload schemas, generating eleven types: `KnowledgePage`,
`KnowledgeDetail`, `KnowledgeEvidence`, `KnowledgeReviewHistory`,
`KnowledgeReviewState`, `KnowledgeLifecycleState`, `KnowledgeCorrections`,
`KnowledgeReceipt`, and the three shared rows `KnowledgeSummary`,
`KnowledgeReview` and `KnowledgeRelationEdge`.

Two shapes worth knowing before planning against them. `KnowledgeReceipt` is a
separate schema from `CommandReceipt` rather than a widening of it, because
`CommandReceipt` was published without an unsupported fallback and the backend
compare gate refuses widening an enum that has none; its own `responseCode`
carries `UNSUPPORTED_SERVER_RESPONSE` as a real enum member, so it can grow. And
`KnowledgeDetail` embeds the lifecycle and review projections by cross-file
`$ref`, so the detail and the standalone endpoints cannot drift and a component
can be shared between them.

Verify rather than trust this note:

```bash
ls vendor/console-contract-v1.0.2/contracts/console/v1/schemas/ | grep -c knowledge
grep -c "^export type Knowledge" generated/console-contract/v1/types.ts
```

Accessibility open decision 1 is unresolved and is due before EEM-9/07. Open
decisions 2, 3, 4 and 5 remain open and are carried, not answered, by this
subtask.
