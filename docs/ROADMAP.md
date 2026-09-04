# Dashboard roadmap

Updated: 2026-09-04

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
   at `9e5ae45`. It consumes `console-contract-v1.0.1` and closes the first two
   contract gaps below. Its trace is
   [`eem-9-03e-acceptance-trace.md`](plans/active/eem-9-03e-acceptance-trace.md).
9. `EEM-9/04b-record-merged-state` is merged as PR
   [#11](https://github.com/Evirion/evirion-engineering-memory-dashboard/pull/11)
   and `EEM-9/04c-uri-format` as PR
   [#12](https://github.com/Evirion/evirion-engineering-memory-dashboard/pull/12)
   at `3f8cd88`. The second registers the `uri` format as an https-only check,
   without which the next release could not be consumed.
10. `EEM-9/03f-console-contract-revision` is merged as PR
    [#13](https://github.com/Evirion/evirion-engineering-memory-dashboard/pull/13)
    at `875b446`. It consumes `console-contract-v1.0.2`, which carries the
    knowledge read and receipt contract, and closes the third gap below.
11. `EEM-9/05-memory-review-lifecycle` is merged as PR
    [#15](https://github.com/Evirion/evirion-engineering-memory-dashboard/pull/15)
    at `e037a76`. It delivers the review queue, knowledge detail and evidence,
    the four review decisions, the append-only history, activation,
    supersession and correction requests across the three frozen memory routes.
    Its trace is
    [`eem-9-05-acceptance-trace.md`](plans/active/eem-9-05-acceptance-trace.md).
    It consumes no new contract bytes.
12. `docs/amend-proc-002` is merged as PR
    [#18](https://github.com/Evirion/evirion-engineering-memory-dashboard/pull/18)
    at `913de6b`.
13. `EEM-9/03g-console-contract-revision` is implemented and locally verified on
    branch `EEM-9/03g-console-contract-revision`. It consumes
    `console-contract-v1.0.3`, retires `vendor/console-contract-v1.0.2`, binds
    `REAUTHENTICATION_REQUIRED`, and corrects the Console stub for EEM-8/11
    conflict detail. Its trace is
    [`eem-9-03g-acceptance-trace.md`](plans/active/eem-9-03g-acceptance-trace.md).
    It unblocks `EEM-9/06` and issue #16; it does not build the step-up flow.

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
5. `EEM-9/05-memory-review-lifecycle` after EEM-8. Merged.
6. `EEM-9/03g-console-contract-revision` — consume `console-contract-v1.0.3`
   (implemented, not merged).
7. `EEM-9/06-processing-settings-metrics` after `EEM-9/03g` merges.
8. Paired `EEM-9/07-free-integration`.
9. Separately approved `EEM-9/08-paid-certification`.
10. Paired `EEM-9/09-design-partner-ready`.
11. Separately scoped `EEM-9/10-first-design-partner-outcome`.

Backend EEM-3/13 is merged and locally reverified. Its EEM-3 global lock graph
is a continuing release invariant for every later backend mutation.

The two contract gaps found during `EEM-9/03` are closed. Backend issues
[#53](https://github.com/Evirion/evirion-engineering-memory/issues/53) and
[#54](https://github.com/Evirion/evirion-engineering-memory/issues/54) published
`repository-overview.json` and `organization-model-profiles.json` in
`console-contract-v1.0.1`, and `EEM-9/03e` consumes both. `EEM-9/06` no longer
inherits either gap.

## PROC-002 is amended rather than served

Owner decision of 2026-09-04, recorded in
[ADR-0006](decisions/0006-no-customer-retry-of-a-live-extraction.md) and
closing issue
[#17](https://github.com/Evirion/evirion-engineering-memory-dashboard/issues/17).

`PROC-002` required the Console to render a retry action whenever a backend
response declared the capability `NONE | RETRY | RESUME | CONTACT_SUPPORT`. No
operation retries or resumes a live extraction job. The contract publishes
exactly two retry or resume operations, `setRepositoryImportState` and
`retryRepositoryImportJob`, and both are scoped to historical imports;
`listProcessingActivity` projects no action at all. Two of the four values
therefore named operations that do not exist.

Building the capability is paid-path work nobody has scheduled, and the
requirement's own points 4 and 5 price it: durable idempotency receipts,
current entitlement, policy and approval checks, and checkpoint reuse before
any new provider authorization. So the requirement is amended. The processing
surface stays read-only, failure detail shows the stable error, and a support
direction is static Console copy rather than a backend-declared capability.

The eight-value `recoveryAction` on the historical-import surface is
unaffected. Import recovery is real, it is served, and `EEM-9/04` renders it.

`PROC-002` also named a backend test that was never written, under owner
`B06A`. That row now names Console evidence under `C06`, because after the
amendment the requirement asserts an absence on a Console surface.

`EEM-9/06` is unblocked and inherits no unserveable requirement. Two
backend-source documents still carry the superseded assignment and are named in
the ADR; amending them belongs to the backend.

## Two contract limits raised by EEM-9/05 — addressed in v1.0.3

Neither blocked the surface at the time, and both were additive requests rather
than gaps that stopped work. Both are recorded in
[`eem-9-05-acceptance-trace.md`](plans/active/eem-9-05-acceptance-trace.md).

`console-contract-v1.0.3` publishes `REAUTHENTICATION_REQUIRED`, the
reauthentication receipt and operations, and live `currentSequence` on
sequence-token conflicts. `EEM-9/03g` consumes those bytes and binds the error
code; issue #16 owns the step-up ceremony.

Resource-version conflicts on entitlements and policy still carry no detail
field; invitation and entitlement-generation conflicts may still carry
`currentVersion` per the published examples.

## The third contract gap is closed

Found on 2026-09-03 while sequencing the work after `EEM-9/04`, and closed the
same day. Step 5 of the accepted order was startable again, and is now built.

All eleven knowledge operations answered the bare `SuccessEnvelope`: no payload
schema file, no `x-evirion-response-schema` binding, and a `CommandReceipt` whose
response codes were fixed to the four entitlement ones. Nothing on the surface
`EEM-9/05` owns could be validated. The backend roadmap credited `EEM-8/05` with
unblocking it, and that subtask was merged and inside the release, but it had
published operations, parameters and request bodies without a single schema file.

Raised as backend issue
[#58](https://github.com/Evirion/evirion-engineering-memory/issues/58), closed by
`EEM-8/08` in backend PR
[#59](https://github.com/Evirion/evirion-engineering-memory/pull/59), published
as `console-contract-v1.0.2` and consumed here by `EEM-9/03f`.

## The release pipeline cannot yet prove a contract is consumable

Backend issue
[#60](https://github.com/Evirion/evirion-engineering-memory/issues/60), open.

`EEM-8/08` passed every backend gate and still produced bytes the Dashboard
generator refused, because two knowledge fields use `format: uri` and an
unreviewed format fails closed. It was caught only because the generator was run
by hand against merged backend `main` before the tag existed. Nothing required
that, and after a tag the release is immutable.

`uri` was the instance; the same failure follows from `allOf`, `$defs`, an open
object, a three-branch `oneOf` or a filename that maps to a reserved TypeScript
global. It is fixed for now in `EEM-9/04c`, and the missing gate is what #60
tracks. It should be closed before the next contract release, which the last
three subtasks suggest will arrive sooner than planned.

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
