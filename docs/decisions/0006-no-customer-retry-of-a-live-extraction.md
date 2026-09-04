# ADR-0006: No customer retry of a live extraction

Status: accepted
Date: 2026-09-04
Owners: `docs/amend-proc-002`

Closes
[#17](https://github.com/Evirion/evirion-engineering-memory-dashboard/issues/17),
transferred from the backend because the gap was found there and the repair
belongs here.

## What PROC-002 required

`PROC-002` was named "Retry capability" and read:

> Retry action видна только если backend response explicitly declares retry
> capability.

Journey `J-010` named the vocabulary that requirement depended on:

> 2. Backend projection supplies stable error and explicit capability:
> `NONE | RETRY | RESUME | CONTACT_SUPPORT`.
> 3. UI exposes only that action.
> 4. Retry/resume uses durable idempotency receipt and current
> entitlement/policy/approval checks.
> 5. Checkpoint reuse occurs before any new provider authorization.

The split is deliberate and is the part worth keeping: the backend supplies the
capability and the client never derives it from a status.

## What the backend serves

Nothing on the processing surface, verified against the pinned
`console-contract-v1.0.3` bytes this repository vendors.

- The contract publishes exactly two retry or resume operations, and both are
  scoped to historical imports: `setRepositoryImportState` at line 1232 of
  [`openapi.yaml`](../../vendor/console-contract-v1.0.3/contracts/console/v1/openapi.yaml)
  and `retryRepositoryImportJob` at line 1323. No operation retries or resumes
  a live extraction job.
- `recoveryAction` exists only on
  [`repository-import.json`](../../vendor/console-contract-v1.0.3/contracts/console/v1/schemas/repository-import.json)
  and
  [`repository-import-failures.json`](../../vendor/console-contract-v1.0.3/contracts/console/v1/schemas/repository-import-failures.json).
  Its vocabulary is eight values, not four: `AWAIT_DISCOVERY`,
  `APPROVE_IMPORT`, `GRANT_CUSTOMER_CONSENT`, `AWAIT_EVIRION_AUTHORIZATION`,
  `PAUSE_IMPORT_TO_RETRY`, `RETRY_JOB`, `CONTACT_SUPPORT`, `NONE`. The backend
  computes it in `private.b06a_import_recovery_action`, at line 302 of
  `supabase/migrations/20260831114310_console_customer_import_operations.sql`.
- `listProcessingActivity`, at line 1916, binds no response schema and projects
  no action. A processing row carries a processing state and a paid
  authorization status, and nothing that names an action.

So two of the four values named operations that do not exist. Publishing them
would either invent a field or require the client to derive one from a status,
which the requirement forbade then and still forbids.

The backend reached the same conclusion independently while writing the
successor schemas. `processing-page.json`, published in `console-contract-v1.0.3`, publishes twenty-one row fields and no action among them. Its own
description states that the row declares no recovery action, that the backend
projects none for a processing job, and that a client must not infer one from a
status that looks retryable. It does publish `lastErrorCode`, which is the
stable error this amendment keeps.

`PROC-002` also named
`test_console_customer_operations_live.py::test_retry_uses_backend_capability_and_checkpoint`
as its primary backend evidence, owned by `B06A`. Neither that test nor that
file exists anywhere in the backend repository, and neither ever did. That is
what makes this a wrong entry in an accepted document rather than an omission.

## Decision

`PROC-002` is amended rather than served, and is renamed to what it now
requires: no customer retry of a live extraction.

- The processing surface is read-only.
- Failure detail shows the stable payload-free error code as user-safe copy,
  with a correlation ID for support.
- The interface may direct the customer to support **as static Console copy**.
  That is the substance of the amendment. The Console stops claiming the
  backend told it which action is available, and stops offering the customer
  one they do not have.
- The eight-value `recoveryAction` on the historical-import surface is
  unaffected and unchanged. Import recovery is real, it is served, and EEM-9/04
  already renders it.

The recovery clause is not deleted. A customer whose extraction failed still
needs to know what happens next, and the honest answer is that Evirion operates
the pipeline and retries are operational.

## Why serving it was rejected for Alpha

Requirement points 4 and 5 already name the cost. A customer-triggered retry of
a live extraction needs a durable idempotency receipt, current entitlement,
policy and approval checks evaluated at the moment of retry, and checkpoint
reuse before any new provider authorization. That is paid-path work, and no
subtask schedules it. Owner decision of 2026-09-04.

Why the merged backend subtask that owns `B06A` shipped the import half and not
the processing half: `Reason not documented`. The migration comment at line 296
records only that the backend computes the import recovery action so that
`PROC-002` and `BF-002` cannot be satisfied by UI classification.

## What would have to be true to revisit it

All of the following, as one scheduled paid-path subtask rather than a
projection change:

1. The backend publishes an operation that retries or resumes a live extraction
   job, and a projected field that declares when it is available, so the client
   still never derives the capability.
2. That operation carries a durable idempotency receipt, so a lost response
   replays rather than dispatching twice.
3. It rechecks live entitlement, policy and approval at the moment of retry
   rather than trusting the state the row was rendered from.
4. It reuses the existing checkpoint before any new provider authorization, so
   a retried job makes no second provider call for work already done.
5. The named backend evidence is actually written, and the acceptance row moves
   back to the backend owner that produced it.

Until then the vocabulary stays out of the requirement, because naming an
action the platform cannot perform is what produced this defect.

## Consequences

- EEM-9/06 is unblocked. It inherits a read-only processing surface and no
  longer owns a call to action it could not render.
- `PROC-002` moves from `B06A` to `C06` in the traceability table, because an
  absence on a Console surface can only be proved by a Console test. Its
  primary evidence becomes
  `tests/e2e/processing-settings.spec.ts::processing_detail_offers_no_recovery_action`,
  which EEM-9/06 writes before implementing the surface, like every other C06
  row.
- `J-010` becomes two journeys sharing one failure detail, because only the
  import half has a customer action.
- EEM-9/04 is unaffected. Its surface, its tests and its acceptance trace
  already assert that no generic processing call to action exists on the import
  page, and that assertion is now permanent rather than a deferral to /06.
- Two packaged backend-source documents still carry the superseded assignment
  and are deliberately not edited here, because this repository is not their
  source: the controlling EEM-9 plan at lines 791 and 860, and the program
  design at line 501, which lists `PROC-002` under `B06A`. Amending them
  belongs to the backend, and moving the controlling plan would require the
  paired stable-pointer change this amendment is not authorized to make.

## Alternatives rejected

- **Publish a `recoveryAction` on the processing surface.** It would have to be
  derived from the processing status, since no operation backs it, so it would
  name actions that cannot be performed and would move retryability
  classification into a projection. The backend's own successor schema refuses
  this in the same words.
- **Build the generic retry now.** That is the paid-path work priced above, and
  nobody has scheduled it. Doing it inside a documentation amendment would also
  reverse the order the plan fixes.
- **Delete the recovery clause.** The customer still needs to know what happens
  next. Removing the sentence would answer the contract question and drop the
  product one.
- **Leave `PROC-002` and let EEM-9/06 stop on it.** That is exactly what
  [#17](https://github.com/Evirion/evirion-engineering-memory-dashboard/issues/17)
  predicted. `EEM-9/05` stopped the same way on backend issue
  [#58](https://github.com/Evirion/evirion-engineering-memory/issues/58), and
  closing that gap cost a backend subtask and a contract release. This one
  cannot be closed by a release at all, so discovering it inside `EEM-9/06`
  would stop that subtask with no unblocking path.
