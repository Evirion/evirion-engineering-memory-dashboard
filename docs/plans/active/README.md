# Active Dashboard task catalog

Use exactly one numbered request. Start from updated `main`, read
[`AGENTS.md`](../../../AGENTS.md), complete the task-specific reading map in the
[EEM-9 plan](eem-9-design-partner-console-dashboard-and-certification.md), and
do not start an adjacent task.

## Current authority state

EEM-9/01 is active. Its Dashboard authority PR must merge before the paired
backend stable-pointer/lock-attestation PR. Until both merge, the backend
repository remains the temporary cross-repository task entry point and
EEM-9/02 plus EEM-4/01 remain blocked.

## Copy-ready requests

### EEM-9/01 — Dashboard repository bootstrap

`Start EEM-9/01-dashboard-repo-bootstrap. Work only on the Dashboard
authority/catalog half until it is merged, then prepare only the paired backend
stable-pointer and EEM-3 lock-attestation half from updated backend main.
Preserve repository history and LICENSE. Do not add a UI/runtime scaffold,
mutate Supabase/Auth, deploy, call a provider, run paid work, or use customer
data. Do not commit, push, create a PR, merge, release, or sign without the
separate authorization required for that action.`

### EEM-9/02 — Strict shell and browser security baseline

`Start EEM-9/02-strict-shell-and-browser-security. Require merged EEM-9/01 and
its exact backend stable pointer. Implement only the strict Next.js/TypeScript
shell, lint/test harness, security headers, cache policy, server/client
boundaries, local HTTPS harness, and free CI.`

### EEM-9/03 — Read-only dashboard

`Start EEM-9/03-read-only-dashboard. Require the prerequisite EEM-4 principal
and tenant contracts. Implement only the visible org/repository/PR status,
backfill progress, trial meters, and safe-empty read paths.`

### EEM-9/04 — Knowledge pages

`Start EEM-9/04-knowledge-pages. Implement only trusted Knowledge browse,
evidence navigation, filtering, provenance, and safe REJECTED/QUARANTINED
presentation.`

### EEM-9/05 — Durable backfill and retry commands

`Start EEM-9/05-durable-backfill-and-retry. Implement only durable request,
cancel, safe-retry, conflict, idempotency, and polling/recovery journeys against
the customer-safe backend API.`

### EEM-9/06 — Entitlement and settings controls

`Start EEM-9/06-entitlement-and-settings-controls. Implement only
repository-entitlement and bounded processing-setting views/commands with live
backend authorization and no provider call from the Console.`

### EEM-9/07 — Review queue and corrections

`Start EEM-9/07-review-queue-and-corrections. Read the retained OWASP and
operations sources. Implement only review queue, assignment, comments,
conflict-safe decisions, and append-only correction proposals.`

### EEM-9/08 — Lifecycle and relation operations

`Start EEM-9/08-lifecycle-and-relations. Read the retained OWASP and operations
sources. Implement only supersession, restore, archive, stale-state conflict,
and bounded relation operations.`

### EEM-9/09 — Recovery, responsive layout, and accessibility

`Start EEM-9/09-recovery-responsive-accessibility. Read the retained OWASP and
operations sources. Complete only session recovery, offline/reconnect, bounded
polling, responsive behavior, and WCAG 2.2 AA target evidence.`

### EEM-9/10 — Certification and design-partner handoff

`Start EEM-9/10-certification-and-handoff. Read the retained OWASP and
operations sources. Run only the approved free certification matrix, record
real staging/manual evidence, reconcile open security findings, and prepare
design-partner handoff. Paid or production certification requires its own
explicit approval.`

The detailed scope, exclusions, aliases, acceptance rows, and merge ordering in
the full EEM-9 plan remain controlling.
