# Active Dashboard task catalog

Use exactly one numbered request. Start from updated `main`, read
[`AGENTS.md`](../../../AGENTS.md), complete the task-specific reading map in the
[EEM-9 plan](eem-9-design-partner-console-dashboard-and-certification.md), and
do not start an adjacent task.

## Current authority state

Dashboard PR
[#1](https://github.com/Evirion/evirion-engineering-memory-dashboard/pull/1)
merged the EEM-9/01 authority package. Its first catalog did not preserve the
controlling plan's `/02`–`/10` aliases, so the paired backend pointer is paused
until the Dashboard catalog-remediation PR merges and the corrected authority
digest is pinned. EEM-9/02 and EEM-4/01 remain blocked.

## Copy-ready requests

### EEM-9/01 — Dashboard repository bootstrap

`Start EEM-9/01-dashboard-repo-bootstrap. First read the backend
AGENTS/HANDOFF/ROADMAP/EEM-9 authorities, then open
Evirion/evirion-engineering-memory-dashboard as the primary Cursor workspace.
Merge its authority/catalog PR first, then prepare the paired backend
stable-pointer/global-lock-attestation/index-update PR. Work only on that
subtask.`

### EEM-9/02 — Auth shell

`Start EEM-9/02-auth-shell in evirion-engineering-memory-dashboard using the
accepted email-OTP plus server-only HttpOnly BFF session contract. Keep a
read-only sibling checkout of evirion-engineering-memory at the source commit
recorded by the attestation-verified EEM-4 contract lock. Work only on this
subtask; do not change hosted Supabase Auth or deploy remotely without separate
exact authorization.`

After local `/02` gates pass, use only this planning request:
`Plan the hosted Supabase Auth configuration phase for EEM-9/07 and verify
prerequisites only. This is not authorization to change Auth, deploy, send real
email, or access customer data.`

At the `/07` remote gate, after replacing every field and approving the exact
Auth delta:
`Authorize the hosted Supabase Auth configuration phase for
project/environment=<...>, local/expected-hosted Auth manifest digest=<...>,
backend/Dashboard commits and artifact attestations=<...>, exact
signup/provider/email-template/OTP/MFA/session/redirect/CAPTCHA/rate-limit
delta=<...>, synthetic canary identities/mailbox=<...>, evidence window=<...>,
rollback owner/procedure=<...>, stop conditions=<...>. No customer data,
provider/model call, paid work, destructive reset, retry, or scope expansion is
authorized.`

### EEM-9/03 — Repository control

`Start EEM-9/03-repository-control in
evirion-engineering-memory-dashboard with a read-only sibling
evirion-engineering-memory checkout at the source commit recorded by the
attestation-verified EEM-6 contract lock. Work only on this subtask.`

### EEM-9/04 — Import operations

`Start EEM-9/04-import-operations in
evirion-engineering-memory-dashboard with a read-only sibling
evirion-engineering-memory checkout verifying both attestation-verified EEM-6
repository/policy and EEM-7 import/paid-state contract locks. Work only on this
subtask and do not run a paid operation.`

### EEM-9/05 — Memory review and lifecycle

`Start EEM-9/05-memory-review-lifecycle in
evirion-engineering-memory-dashboard with a read-only sibling
evirion-engineering-memory checkout at the source commit recorded by the
attestation-verified EEM-8 contract lock. Work only on that subtask.`

### EEM-9/06 — Processing, settings, and metrics

`Start EEM-9/06-processing-settings-metrics in
evirion-engineering-memory-dashboard with a read-only sibling
evirion-engineering-memory checkout verifying the attestation-verified EEM-4
member, EEM-6 GitHub/offboarding, EEM-7 processing/retry, and EEM-8 read/metrics
contract locks. Work only on that subtask.`

### EEM-9/07 — Free integration

`Start EEM-9/07-free-integration with evirion-engineering-memory as the primary
workspace and a sibling Dashboard checkout. Follow backend commit/contract
publication first, Dashboard client update second, then local gates. Do not
apply or deploy remotely without separate exact authorization.`

After local `/07` gates pass, use this planning-only request:
`Plan the EEM-9/07 remote free apply/deploy/canary phase and verify prerequisites
only. This is not remote authorization.`

After replacing every angle-bracket field and explicitly approving the exact
free remote action:
`Authorize the EEM-9/07 remote free phase for project/environment=<...>, backend
commit/artifact/digest/attestation=<...>, Dashboard
commit/artifact/digest/attestation=<...>, migrations=<...>,
canary/profile=<...>, evidence window=<...>, rollback owner/procedure=<...>,
stop conditions=<...>. Live/model/provider/paid flags must remain false. No
destructive reset or scope expansion is authorized.`

### EEM-9/08 — Paid certification

`Plan EEM-9/08-paid-certification in evirion-engineering-memory and verify
prerequisites only. This message is not approval for any provider call or paid
run.`

After replacing every angle-bracket field and explicitly approving that exact
run:
`Start EEM-9/08-paid-certification in evirion-engineering-memory. I explicitly
authorize environment=<...>, organization/repository/PR=<...>,
provider/model/profile=<...>, phases=<...>, maximum dispatches/calls=<...>,
maximum budget=<...>, customer-consent ID=<...>, operational-authorization
ID=<...>, stop conditions=<...>, rollback owner=<...>. No retry or scope
expansion is authorized.`

### EEM-9/09 — Design Partner Ready

`Start EEM-9/09-design-partner-ready with evirion-engineering-memory as the
primary evidence workspace and a sibling Dashboard checkout. Perform only the
Technical Design Partner Ready review after the independent full-platform
pentest including Console/BFF/Auth and closure retest are available; publish
backend evidence first and Dashboard status second. Do not use real partner
data or run another paid workload.`

### EEM-9/10 — First design partner outcome

`Plan EEM-9/10-first-design-partner-outcome in evirion-engineering-memory and
verify prerequisites only; the Dashboard is observation-only. This message
does not authorize partner data access, GitHub binding, provider calls,
imports, paid work, or deployment.`

After replacing every angle-bracket field and explicitly approving the exact
non-production partner scope:
`Start EEM-9/10-first-design-partner-outcome in
evirion-engineering-memory; the Dashboard is observation-only. I authorize
partner/environment/organization=<...>, installation/repositories/data
range=<...>, OFF/SOURCE_ONLY modes=<...>, stop conditions=<...>,
rollback/support owners=<...>. SEC-2026-010 must already be closed.
Provider-bearing work remains prohibited unless SEC-2026-005 is closed and it
is separately authorized with provider/model, calls/dispatches, budget,
customer-consent ID, and operational-authorization ID.`

For a later provider-bearing workload inside the already approved partner
scope, first use:
`Plan one provider-bearing EEM-9/10 workload and verify prerequisites only for
partner-scope ID=<...>, environment/organization/repository/data range=<...>,
mode/phases=<...>. This is not provider, paid, import, retry, or deployment
authorization.`

Only after replacing every field and explicitly approving that one workload:
`Authorize one provider-bearing EEM-9/10 workload for partner-scope ID=<...>,
environment/organization/repository/data range=<...>, mode/phases=<...>,
provider/model/profile=<...>, maximum dispatches/calls=<...>, maximum
budget=<...>, customer-consent ID=<...>, operational-authorization ID=<...>,
stop conditions=<...>, rollback/support owners=<...>. SEC-2026-005 and
SEC-2026-010 must already be closed. No retry, second workload, or scope
expansion is authorized.`

The detailed scope, exclusions, aliases, acceptance rows, and merge ordering in
the full EEM-9 plan remain controlling.
