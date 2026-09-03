# Dashboard roadmap

Updated: 2026-09-03

The accepted Console program is delivered as sequential numbered PRs in each
repository. Every branch starts from updated `main`; branches are not stacked.
The detailed scope, prerequisites, exclusions, and acceptance rows remain in
the [controlling EEM-9 plan](plans/active/eem-9-design-partner-console-dashboard-and-certification.md).

## Current delivery

1. `EEM-9/01-dashboard-repo-bootstrap` — Dashboard authority PR
   [#1](https://github.com/Evirion/evirion-engineering-memory-dashboard/pull/1)
   merged at `6a489ccb84ce3bd0b17e0d42b983f8d15d238cef`.
2. `EEM-9/01-dashboard-catalog-remediation` — PR
   [#2](https://github.com/Evirion/evirion-engineering-memory-dashboard/pull/2)
   merged at `773f3af`, restoring the accepted `/02`–`/10` catalog aliases.
3. `EEM-9/01b` is complete. It was one subtask delivered as three sequential
   pull requests: backend PR
   [#51](https://github.com/Evirion/evirion-engineering-memory/pull/51), which
   published the immutable signed `console-contract-v1.0` release; Dashboard PR
   [#3](https://github.com/Evirion/evirion-engineering-memory-dashboard/pull/3),
   merged at `a6665b5`, which consumed those bytes and corrected the EEM-9/01
   attestation text and release workflow; and backend PR
   [#52](https://github.com/Evirion/evirion-engineering-memory/pull/52), the
   successor pointer, which re-pinned this repository.
4. `EEM-9/02-auth-shell` is merged as PR
   [#4](https://github.com/Evirion/evirion-engineering-memory-dashboard/pull/4)
   at `5ff0c0c`.
5. `EEM-9/02b-response-envelope` is merged as PR
   [#5](https://github.com/Evirion/evirion-engineering-memory-dashboard/pull/5)
   at `8aa5418`. It corrected the response-envelope handling every later
   subtask depends on.
6. `EEM-9/03-repository-control` is merged as PR
   [#6](https://github.com/Evirion/evirion-engineering-memory-dashboard/pull/6)
   at `961001d`. Its Definition-of-Done trace is
   [`eem-9-03-acceptance-trace.md`](plans/active/eem-9-03-acceptance-trace.md).
   Two documentation follow-ups merged after it as PRs
   [#7](https://github.com/Evirion/evirion-engineering-memory-dashboard/pull/7)
   and
   [#8](https://github.com/Evirion/evirion-engineering-memory-dashboard/pull/8).
7. `EEM-9/04-import-operations` is merged as PR
   [#9](https://github.com/Evirion/evirion-engineering-memory-dashboard/pull/9)
   at `6467a74`. Its Definition-of-Done trace is
   [`eem-9-04-acceptance-trace.md`](plans/active/eem-9-04-acceptance-trace.md).
8. `EEM-9/03e-console-contract-revision` is merged as PR
   [#10](https://github.com/Evirion/evirion-engineering-memory-dashboard/pull/10)
   at `9e5ae45`. It consumes `console-contract-v1.0.1` and closes both contract
   gaps below. Its trace is
   [`eem-9-03e-acceptance-trace.md`](plans/active/eem-9-03e-acceptance-trace.md).

All EEM-4 subtasks are merged in the backend as PRs
[#26](https://github.com/Evirion/evirion-engineering-memory/pull/26)–[#29](https://github.com/Evirion/evirion-engineering-memory/pull/29),
so the EEM-9/02 prerequisite is satisfied. An earlier statement here that
EEM-4/01 remained blocked was stale.

All EEM-6 subtasks are merged in the backend, ending with PR
[#37](https://github.com/Evirion/evirion-engineering-memory/pull/37), so the
`EEM-9/03` prerequisite is satisfied. That commit is an ancestor of the source
commit the Console contract lock records, so the single lock already covers the
repository, entitlement and GitHub operations; no separate EEM-6 contract lock
exists.

## Accepted cross-repository order

1. All EEM-4 backend subtasks (`/01`–`/04`).
2. `EEM-9/02-auth-shell` while EEM-6 proceeds.
3. `EEM-9/03-repository-control` after EEM-6, while EEM-7 proceeds.
4. `EEM-9/04-import-operations` after EEM-7, while EEM-8 proceeds.
5. `EEM-9/05-memory-review-lifecycle` after EEM-8.
6. `EEM-9/06-processing-settings-metrics`.
7. Paired `EEM-9/07-free-integration`.
8. Separately approved `EEM-9/08-paid-certification`.
9. Paired `EEM-9/09-design-partner-ready`.
10. Separately scoped `EEM-9/10-first-design-partner-outcome`.

Backend EEM-3/13 is merged and locally reverified. Its EEM-3 global lock graph
is a continuing release invariant for every later backend mutation.

The two contract gaps found during `EEM-9/03` are closed. Backend issues
[#53](https://github.com/Evirion/evirion-engineering-memory/issues/53) and
[#54](https://github.com/Evirion/evirion-engineering-memory/issues/54) published
`repository-overview.json` and `organization-model-profiles.json` in
`console-contract-v1.0.1`, and `EEM-9/03e` consumes both. `EEM-9/06` no longer
inherits either gap.

## A third contract gap blocks EEM-9/05

Found on 2026-09-03 while sequencing the work after `EEM-9/04`. Step 5 of the
accepted order above is not startable, and its prerequisite reads as met.

All eleven knowledge operations in `console-contract-v1.0.1` answer the bare
`SuccessEnvelope`. No knowledge payload schema file exists, no knowledge
operation carries an `x-evirion-response-schema` binding, and `CommandReceipt`
fixes its response codes to the four entitlement ones. Nothing on the surface
`EEM-9/05` owns can be validated.

The backend roadmap credits `EEM-8/05` with unblocking `EEM-9/05`. That subtask
is merged and inside the release, but it published operations, parameters and
request bodies without a single schema file, so the digest it produced has
nothing behind it to validate a response against.

Unlike the historical-import receipt `EEM-9/04` generated, no bytes exist to
generate from, and `EEM-9/03` already rejected hand-writing the type. Closing it
needs a backend subtask, a release carrying it, and a second Dashboard
consumption. It is not yet raised as a backend issue, and raising it is the
next action.

`EEM-9/06` is unaffected and could be taken before `EEM-9/05` if the owner
prefers not to idle, which would depart from the accepted order and is therefore
an owner decision rather than an inference.

## EEM-9/04 is not blocked by `EEM-7/05`

Owner decision of 2026-09-03. The EEM-9 plan makes `EEM-9/04-import-operations`
wait until "all EEM-7 subtasks are merged". That sentence was written when EEM-7
held `/01`-`/04`, all of which are merged.

`EEM-7/05-model-profile-registry` was created afterwards, from a gap found while
building EEM-9/03. It concerns the model-profile catalogue that live
`AUTO_EXTRACT` consent needs, and historical import reads none of it: every
import operation and both import schemas are already published in
`console-contract-v1.0`, which this repository already vendors.

The prerequisite therefore means the EEM-7 subtasks that existed when the plan
was frozen. `EEM-9/04` may start now, and it needs no new contract bytes. This
is recorded rather than inferred, because a reader checking the plan literally
would find an unmerged EEM-7 subtask and stop.

## The next Dashboard contract consumption is one subtask, not two

Owner decision of 2026-09-03. Both backend gaps publish contract bytes this
repository must consume, and consuming them is the same ceremony either way:
vendor the archive, regenerate the client, update the lock and the attestation
evidence, and move the authority digest. Doing that twice buys nothing, so the
Dashboard consumes once, after both have merged and a release carries both
schemas.

The consequence is accepted deliberately: the repository overview counters are
already merged in the backend as PR
[#55](https://github.com/Evirion/evirion-engineering-memory/pull/55) and will
not appear in the Console until the model-profile registry lands with them.

That subtask carries three UI changes beyond the consumption itself:

- the repository counters, which `EEM-9/06` owns, on
  `/repositories/:repositoryId`, closing open decision 6;
- the `AUTO_EXTRACT` consent field, today free text because nothing enumerates
  valid profiles, becoming a choice from the catalogue, with the matching
  validation in the policy route;
- a recorded consent naming a profile no longer in the organization's allowlist
  rendered as an explicit state rather than as an ordinary row.

It is delivered as `EEM-9/03e-console-contract-revision`, and it carried a
fourth change nobody anticipated. The frozen trust policy admitted only a
two-component release tag, so it could not verify a revision at all. Amending it
to mirror backend ADR 0014 is the first commit on that branch and is recorded as
[ADR-0005](decisions/0005-console-contract-release-revisions.md). It could not
be a separate earlier pull request: the lock and the recorded evidence both pin
`policyDigest`, so a policy-only change would land a default branch whose own
gate fails.

### No successor pointer follows EEM-9/03e

Owner decision of 2026-09-03, taken on the authority digest this subtask
produces. It is recorded because the absence of a paired backend pull request
should read as a decision rather than as an omission.

The backend pointer reads the Dashboard commit it pins rather than Dashboard
`main`, so it keeps verifying as this repository moves, and it was reverified
after this subtask's changes. Fifteen commits have landed on Dashboard `main`
since the pointer was set at `a6665b5` by backend PR
[#52](https://github.com/Evirion/evirion-engineering-memory/pull/52), spanning
`EEM-9/02` through `EEM-9/04`, and none was followed by a successor pointer. The
pointer is re-pinned when the controlling EEM-9 authority moves, not on every
merge, and this subtask leaves the controlling plan untouched.

No digest is quoted here on purpose. Recording one would be stale the moment
this paragraph changed the authority package it names.

The consequence accepted with the decision: a reader arriving from the backend
pointer lands on the EEM-9/01b tree, so they see neither the amended trust
policy nor the `EEM-9/03e` catalog entry until a later subtask re-pins. That
costs discoverability and nothing else; every gate in both repositories passes
either way.

Technical Design Partner Ready and paid readiness remain false. In particular,
`SEC-2026-012`, staging evidence, external manual verification, paid
authorization, and production evidence remain separate future gates.
`SEC-2026-012` covers ruleset-based repository governance on GitHub Free; it is
unrelated to the EEM-9/01b immutability correction and stays open under its
approved waiver.
