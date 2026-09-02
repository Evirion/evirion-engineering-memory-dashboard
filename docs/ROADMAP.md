# Dashboard roadmap

Updated: 2026-09-02

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
6. `EEM-9/03-repository-control` is implemented and locally verified on its
   branch, based on updated `main` after `EEM-9/02b` merged. It was developed
   stacked on that branch with explicit owner authorization, because it cannot
   read a repository without the correction, and has since been rebased. It is
   not pushed, has no pull request and is not merged. Its Definition-of-Done
   trace is
   [`eem-9-03-acceptance-trace.md`](plans/active/eem-9-03-acceptance-trace.md).

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

Two contract gaps found during `EEM-9/03` block work that `EEM-9/06` owns. The
contract publishes no repository-overview schema, so the counters open decision
6 asks about cannot be validated by either subtask, and no endpoint enumerates
the model profiles an `AUTO_EXTRACT` consent may name. Both need a backend
contract change and a new frozen digest, and both should be resolved before
`EEM-9/06` starts.

Technical Design Partner Ready and paid readiness remain false. In particular,
`SEC-2026-012`, staging evidence, external manual verification, paid
authorization, and production evidence remain separate future gates.
`SEC-2026-012` covers ruleset-based repository governance on GitHub Free; it is
unrelated to the EEM-9/01b immutability correction and stays open under its
approved waiver.
