# Dashboard roadmap

Updated: 2026-08-27

The accepted Console program is delivered as sequential numbered PRs. Each row
starts from updated `main`; branches are not stacked.

1. `EEM-9/01` — repository bootstrap, authority transfer, acceptance/security
   ownership, governance, and immutable cross-repository verification.
   Dashboard PR merges before its paired backend pointer PR. Status: Dashboard
   half locally verified and awaiting explicit publication authorization.
2. `EEM-4/01` — principal, tenant, and capability context. Starts only after
   both EEM-9/01 PRs merge. Status: planned.
3. `EEM-9/02` — strict Next.js/TypeScript shell and security headers. Status:
   planned.
4. `EEM-4/02–/05` — session, membership, invitation, and tenant-boundary
   delivery. Status: planned.
5. `EEM-9/03–/10` — remaining Console slices and certification in the order
   fixed by the [active plan](plans/active/eem-9-design-partner-console-dashboard-and-certification.md).

Backend EEM-3/13 is merged and locally reverified. Its EEM-3 global lock graph
is a continuing release invariant for every later backend mutation.

Technical Design Partner Ready and paid readiness remain false. In particular,
`SEC-2026-012`, staging evidence, external manual verification, paid
authorization, and production evidence remain separate future gates.
