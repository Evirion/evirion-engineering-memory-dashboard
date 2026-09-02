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
3. EEM-9/01b is one subtask delivered as three sequential pull requests:
   1. backend PR
      [#51](https://github.com/Evirion/evirion-engineering-memory/pull/51),
      merged, which published the immutable signed `console-contract-v1.0`
      release;
   2. this Dashboard pull request, which pins and consumes those published
      bytes and corrects the EEM-9/01 attestation text and release workflow
      that consumption proved unexecutable;
   3. the backend successor pointer, which re-pins this repository's merged
      commit, corrected artifacts, and new authority package digest.

EEM-9/01b is complete only after all three merge and the EEM-3 global-lock
attestation remains non-contradictory. EEM-4/01 and EEM-9/02 remain blocked
until then.

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

Technical Design Partner Ready and paid readiness remain false. In particular,
`SEC-2026-012`, staging evidence, external manual verification, paid
authorization, and production evidence remain separate future gates.
`SEC-2026-012` covers ruleset-based repository governance on GitHub Free; it is
unrelated to the EEM-9/01b immutability correction and stays open under its
approved waiver.
