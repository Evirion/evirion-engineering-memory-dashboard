# Memory review surfaces, required-field marking, and cost disclosure

Opened 2026-09-16 from an owner walkthrough of the deployed Console. Five
defects were reported against the Memory tab, the Knowledge Object page, and the
pull request detail page. One of them is a backend projection defect that the
Console cannot fix, one closes a design decision that has been open since
EEM-9/01, and one completes a product decision taken on 2026-09-08 that missed
two surfaces.

This plan is written for implementation in a separate session. Nothing in it has
been implemented.

## Reported defects, and what each one actually is

| # | Reported | Actual cause |
|---|---|---|
| 1 | The Memory card's title is the knowledge "level", not the claim | Backend list projection reads `knowledge_value`, the importance grade, instead of `knowledge`, the claim |
| 2 | The supersession Replacement control shows only `MEDIUM` | Same projection, reached through the same list endpoint, plus a `select` that cannot present a 200-character sentence |
| 3 | The Memory tab and the Knowledge Object page overload the eye | Open decision 4 was never closed for these surfaces: permanent seven-control filter grid, duplicated status chips, and seven simultaneously expanded forms |
| 4 | Mandatory fields carry no asterisk and no error state | The two memory form files hand-roll their controls and never use the shared field primitives that already carry `aria-invalid` styling |
| 5 | A USD figure is disclosed on the pull request detail page | `SHOW_COST_FIGURES` was set `false` on 2026-09-08 and two surfaces were missed |

## Root cause for defects 1 and 2

`core.knowledge_objects` carries two distinct columns:

- `knowledge` holds the claim sentence;
- `knowledge_value` holds the importance grade, whose closed vocabulary is
  `LOW`, `MEDIUM`, `HIGH`, `VERY_HIGH` in the extraction schema at
  `schemas/knowledge-extraction.schema.json` and is written verbatim by the
  worker insert in `supabase/migrations/20260825140413_eem3_worker_persistence_v2.sql`.

Every customer-facing list projection reads the grade:

- `private.b09_knowledge_summary_row`, at line 593 of
  `supabase/migrations/20260901095316_console_customer_read_api.sql`, builds
  `shortClaim` from `left(knowledge_value, 200)`. It feeds `api.list_knowledge`,
  which is both the `/memory` queue and — through
  `readSupersessionCandidates` in
  [`src/server/queries/knowledge.ts`](../../../src/server/queries/knowledge.ts) —
  the supersession replacement list.
- the admitted-knowledge aggregate inside `api.get_pull_request_detail`, at line
  1477 of the same migration and redefined at line 670 of
  `supabase/migrations/20260901182400_console_consistent_cutoff_reads.sql`.

The Knowledge Object page title and the supersession confirm step are correct
because both read `detail.knowledge` from the detail projection, which maps the
right column. That asymmetry is why a reviewer sees `MEDIUM` when choosing a
replacement and a sentence one step later.

The signed contract documents the wrong mapping rather than merely permitting
it. In `contracts/console/v1/schemas/knowledge-summary.json`, `shortClaim`
describes itself as "the first 200 characters of the knowledge value" and
annotates `x-evirion-backend-projection` as
`core.knowledge_objects.knowledge_value`, while its two examples show claim
sentences. `knowledge-detail.json` repeats the confusion: `knowledgeValue`
carries no description and both of its examples are sentences rather than
grades. Under `AGENTS.md` this is an authority mismatch, and it was reported to
the owner rather than silently corrected.

### Decision, 2026-09-16, owner

Correct both the runtime projection and the contract. The migration lands first
and repairs the interface on its own; the contract release follows behind it.

## Contract packet for the backend projection change

The change is a read-path projection correction. It is recorded here in full so
the absence of state, lock, and tenancy movement is explicit rather than
assumed.

| Concern | Position |
|---|---|
| State transitions | None. No state machine, review sequence, lifecycle version, or relation state is read or written. |
| Mutations | None. `create or replace function` on two `stable` read functions; no `insert`, `update`, or `delete` in either body. |
| No-side-effect invariant | Both functions remain side-effect free; the admission, review, and lifecycle predicates they already apply are unchanged. |
| Lock order | Not engaged. No row lock, advisory lock, or trigger participates. |
| Tenancy | Unchanged. Both functions keep every existing `organization_id` predicate and their `security definer` plus `set search_path = ''` declarations. |
| Representation parity | One row changes meaning in three representations: SQL column, JSON field, and the generated TypeScript type. The type is `string` before and after, so the generated client is unaffected and only the documented meaning moves. |
| Truncation | `left(..., 200)` is preserved, so `maxLength: 200` in the schema continues to hold for a claim of any length. |

No migration may widen what the projection exposes. `knowledge` is already
published in full by the detail projection at the same
`customer-safe-detail` sensitivity, so no new class of data reaches a customer.

## Subtasks

Start each from updated `main`. The Console subtasks do not block on the
backend migration: the local stub in `tools/console-stub` supplies `shortClaim`
from its own fixtures, so the redesign is fully testable before the migration is
applied. Only the *observed* fix on staging depends on it.

### MEM-UX/01 — knowledge claim projection, backend repository

Purpose: make every customer-facing list projection publish the claim.

Forward-only migration in `Evirion/evirion-engineering-memory` doing
`create or replace function` on:

- `private.b09_knowledge_summary_row`, changing `shortClaim` to
  `pg_catalog.left(p_knowledge_object.knowledge, 200)`;
- `api.get_pull_request_detail`, changing the `admittedKnowledgeObjects`
  aggregate to `pg_catalog.left(knowledge_object.knowledge, 200)`. Replace the
  definition from `20260901182400`, which is the live one; the earlier
  definition in `20260901095316` is superseded and must not be re-created.

Both bodies are otherwise copied unchanged, including every tenant predicate,
the admission gate, and the `security definer` and `search_path` declarations.

Acceptance:

- a database test asserts a queue row's `shortClaim` equals the first 200
  characters of `knowledge` for a seeded object whose `knowledge_value` is
  `MEDIUM`, and asserts it is not `MEDIUM`;
- the same assertion for the pull request detail aggregate;
- the existing Console contract test in
  `services/model-orchestration/tests/unit/test_console_contract.py` and the
  live read-API test in
  `services/model-orchestration/tests/database/test_customer_read_api_live.py`
  continue to pass, updated where they assert the old meaning;
- `supabase/functions/console-api/knowledge_test.ts` continues to pass; the key
  list is unchanged, so no Edge change is expected.

Exclusions: no schema change, no new column, no Edge function change, no
contract byte. Applying the migration to `EEC-staging` is a separately
authorized deployment and is not part of this subtask.

### MEM-UX/02 — console-contract-v1.0.6, claim projection wording

Purpose: make the contract describe the column it now reads.

Backend contract edits:

- `knowledge-summary.json`: `shortClaim` description becomes the first 200
  characters of the knowledge claim; `x-evirion-backend-projection` becomes
  `core.knowledge_objects.knowledge`;
- `pull-request-detail.json`: the same two corrections on its `shortClaim`;
- `knowledge-detail.json`: `knowledgeValue` gains a description naming it as the
  extraction's importance grade, and both examples are corrected from sentences
  to grade values.

No type narrows. `knowledgeValue` stays `string` rather than gaining an `enum`,
because the database column is free text and tightening it would make a
legitimate backend value an unsupported response.

Then the release and consumption chain, in order:

1. tag, sign, and publish `console-contract-v1.0.6` through
   `.github/workflows/console-contract-release.yml`;
2. in this repository, re-vendor with `scripts/fetch_console_contract.py`,
   re-pin [`docs/contracts/console-contract-lock.json`](../../contracts/console-contract-lock.json),
   add `docs/contracts/console-contract-v1.0.6-evidence.json`, regenerate with
   `scripts/generate_console_client.py`, and move the
   [`docs/authority/package-files.json`](../../authority/package-files.json)
   entries from the `v1.0.5` vendor directory to `v1.0.6`;
3. in the backend, re-pin the moved Dashboard authority digest.

Two prerequisites are outside the implementer's control and must be satisfied
before this subtask starts:

- the exact tag `console-contract-v1.0.6` requires explicit owner
  authorization, per the release practice recorded in the task catalog;
- GitHub Actions currently refuses to start jobs because account payments
  failed, as recorded in [`docs/HANDOFF.md`](../../HANDOFF.md). The release and
  its attestation both run there, so the chain cannot complete until that is
  resolved.

Stop and report rather than working around either one.

### MEM-UX/03 — the review queue and its filters

Purpose: one claim per card, one status to act on, and filters that are not
permanently in the way.

Files: [`src/components/memory/memory-queue.tsx`](../../../src/components/memory/memory-queue.tsx),
[`src/components/memory/memory-filters.tsx`](../../../src/components/memory/memory-filters.tsx),
[`src/lib/knowledge/presentation.ts`](../../../src/lib/knowledge/presentation.ts).

The filter panel becomes a single bar. Active predicates render as removable
chips, each a link that drops that one predicate and the cursor. The full
seven-control grid moves inside a native `details` element, open only when a
predicate beyond review status is set. It stays a `GET` form with no action, so
URLs stay shareable and no JavaScript is involved.

The card keeps its current DOM contract and changes its visual weight:

- the claim is the only large type and remains the link target;
- review status keeps its tinted `StatusChip`, because it is the axis a reviewer
  acts on;
- lifecycle drops to a labelled plain-text fact in the metadata line. Both axes
  stay present and separately labelled as the contract requires, at roughly half
  the visual weight of two competing chips;
- the uppercase monospace knowledge-type chip is removed and the type joins the
  metadata line, where it no longer competes with the claim;
- the metadata line loses its monospace treatment and the phrase
  `Model confidence 88 of 100`, reading as ordinary prose: type, repository and
  pull request, merge date, lifecycle, confidence.

Deliberately excluded, because the projection publishes no such fact and the
Console may not invent one: a result total, a sort control, and grouping by pull
request. `page.page.nextCursor` remains the only pagination authority.

Acceptance:

- [`tests/component/memory/memory-queue.test.tsx`](../../../tests/component/memory/memory-queue.test.tsx)
  asserts the claim is the accessible link name, that both review and lifecycle
  remain in the row's accessible content, and that the grade never appears as a
  title;
- a component test asserts the advanced filter disclosure is closed with only a
  review-status predicate and open when any other predicate is set;
- a component test asserts each active-filter chip drops its own predicate and
  the cursor, and keeps the others;
- [`tests/e2e/memory.spec.ts`](../../../tests/e2e/memory.spec.ts) continues to
  pass with the filter interaction updated to open the disclosure first.

### MEM-UX/04 — the Knowledge Object page, decision-first

Purpose: turn a page of equally weighted panels into a page that supports one
decision.

Files: [`src/app/(console)/memory/[knowledgeObjectId]/page.tsx`](<../../../src/app/(console)/memory/[knowledgeObjectId]/page.tsx>),
[`src/components/memory/knowledge-detail.tsx`](../../../src/components/memory/knowledge-detail.tsx),
[`src/components/memory/knowledge-payload.tsx`](../../../src/components/memory/knowledge-payload.tsx),
[`src/components/memory/review-actions.tsx`](../../../src/components/memory/review-actions.tsx),
[`src/components/memory/lifecycle-actions.tsx`](../../../src/components/memory/lifecycle-actions.tsx),
[`src/components/memory/review-history.tsx`](../../../src/components/memory/review-history.tsx),
[`src/components/memory/correction-status.tsx`](../../../src/components/memory/correction-status.tsx).

Today the page renders a three-column state grid, a four-column source grid, up
to twenty-six payload fields across two panels, the evidence, then seven fully
expanded forms, then history and corrections. The new order is:

1. the claim as the heading, with a compact state strip beneath it carrying
   review, lifecycle, and whether retrieval can return this, keeping the
   sentence that the two axes are independent;
2. evidence, expanded and never collapsible, because `KD-002` requires the
   attribution to be readable before a decision and it currently sits below the
   payload panels;
3. one **Decide** region in which each review action is a collapsed `details`
   whose summary is the action, so the reader sees four one-line choices rather
   than four forms;
4. lifecycle as its own separately headed region with the same treatment,
   preserving the two-step supersession;
5. source context, the machine-extraction versus derivative comparison, review
   history, and correction requests as collapsed disclosures. The derivative
   panel is open whenever an edit exists, because the difference between the two
   payloads is the reason that screen exists.

Constraints that do not move:

- every `data-testid` and every section `aria-label` is preserved, and every
  form stays in the DOM; `details` only hides;
- review and lifecycle remain two separately labelled axes and neither collapses
  into a single status;
- `allowedActions` narrowed by the session capability remains the only authority
  for which control renders;
- the reauthentication precondition notices stay inside their own forms, so a
  collapsed disclosure never hides the statement that a ceremony is required;
- disclosure state carries no meaning and is never used to hide a refusal, a
  conflict, or an unsupported state.

Acceptance:

- the existing Playwright suites continue to pass with the relevant disclosure
  opened first:
  [`tests/e2e/memory-detail.spec.ts`](../../../tests/e2e/memory-detail.spec.ts),
  [`tests/e2e/memory-review.spec.ts`](../../../tests/e2e/memory-review.spec.ts),
  [`tests/e2e/reauthentication.spec.ts`](../../../tests/e2e/reauthentication.spec.ts),
  [`tests/security/memory-boundary.spec.ts`](../../../tests/security/memory-boundary.spec.ts),
  and [`tests/security/xss-corpus.spec.ts`](../../../tests/security/xss-corpus.spec.ts);
- a test asserts evidence appears before every review and lifecycle control in
  document order;
- a test asserts the derivative comparison is open when `humanEdited` is true
  and collapsed otherwise;
- an accessibility check covers keyboard traversal into and out of each
  disclosure against the WCAG 2.2 AA target `AGENTS.md` fixes.

This subtask carries the largest test churn in the plan. It is deliberately its
own pull request for that reason.

### MEM-UX/05 — required-field marking

Purpose: mark what is mandatory, and show a missing value as an error rather
than as silence.

Files: [`src/components/ui/field.tsx`](../../../src/components/ui/field.tsx),
[`src/components/memory/review-actions.tsx`](../../../src/components/memory/review-actions.tsx),
[`src/components/memory/lifecycle-actions.tsx`](../../../src/components/memory/lifecycle-actions.tsx).

The shared primitives already carry the right foundation — `Field`, `Label`,
`FieldHint`, `FieldError`, and a control surface with
`aria-invalid:border-destructive` — and the two memory form files use none of
them, hand-rolling a `control` class string instead. The work is therefore:

- give `Label` a `required` prop rendering a `text-destructive` asterisk marked
  `aria-hidden` beside a visually hidden "(required)", so the marker is seen
  once and announced once;
- add a `user-invalid` red border and an inline `FieldError` to the shared
  control surface, so a field turns red after the reader leaves it empty or
  submits, not on first paint;
- migrate both memory form files onto `Field`, `Label`, `Select`, `Textarea`,
  `FieldHint`, deleting the duplicated `control` and `labelClass` strings;
- mark as required: knowledge type, implementation status, the four long-form
  text fields, issue severity on both forms, the rejection reason, the
  correction type and reason, and the replacement choice.

The note fields are required only when the reason is "Another reason". A static
`required` cannot express that, so those keep the conditional wording in their
hint and continue to rely on the backend's refusal. An asterisk that is wrong in
most states is worse than no asterisk.

Acceptance:

- a component test asserts every control with `required` has a visible marker
  and an accessible required state, and that no optional control has either;
- a component test asserts the conditional note fields are not marked required;
- an e2e test asserts an empty required field blocks submission and renders the
  inline error rather than the page reloading silently.

### MEM-UX/06 — the supersession replacement picker

Purpose: let a reviewer read what they are choosing.

Files: [`src/components/memory/lifecycle-actions.tsx`](../../../src/components/memory/lifecycle-actions.tsx),
[`src/server/queries/knowledge.ts`](../../../src/server/queries/knowledge.ts).

A `select` whose options are 200-character sentences is unusable even once the
projection is corrected. Step one becomes a list of radio cards inside the same
`GET` form: the claim clamped to two lines, the knowledge type, and the review
state, each a single labelled control. `SupersessionCandidate` grows the fields
the card needs, all of them already present on the summary the query reads.

Unchanged: the two-step flow, the `GET` form with no action, the selection
travelling in the URL, all four optimistic tokens observed on the confirm step,
the direction stated in words, and the empty state when no reviewed object is
eligible.

Acceptance:

- a component test asserts each candidate's accessible name contains its claim
  and its review state, and that no candidate is presented by grade;
- [`tests/e2e/memory-review.spec.ts`](../../../tests/e2e/memory-review.spec.ts)
  continues to pass through the two-step flow with the radio control;
- the existing assertion that the confirm step renders all four tokens and the
  direction is unchanged.

### MEM-UX/07 — complete the cost-disclosure suspension

Purpose: finish a product decision that two surfaces escaped.

[`src/lib/ui/cost-reporting.ts`](../../../src/lib/ui/cost-reporting.ts) holds
`SHOW_COST_FIGURES = false`, set on 2026-09-08. It gates the processing table
and the usage panel. Two surfaces still disclose money:

- [`src/components/processing/pull-request-detail.tsx`](../../../src/components/processing/pull-request-detail.tsx),
  lines 44 to 50 — the figure the owner found. Both branches go, including
  `Cost not included for your role`, which discloses that a cost exists and that
  visibility depends on the reader's role;
- [`src/components/imports/import-progress.tsx`](../../../src/components/imports/import-progress.tsx),
  line 84 — the whole `ImportCost` panel: completeness, headline amount, budget,
  and three further figures, rendered from the import page.

Both route through the existing constant rather than being deleted, matching the
recorded decision that this is a suspension and not a removal: requirement
G-006 was never amended, and [`docs/CHANGELOG.md`](../../CHANGELOG.md) carries
the record of that gap. The constant's comment is updated to name all four
gated surfaces so the next reader does not have to find them.

Kept, because they are authorization rather than disclosure: the import
approval's cost budget input, the repository consent's maximum budget input, and
the repository detail's budget-ceiling readout, which shows a customer the
ceiling they set.

Audited and clean: no model name, token count, latency measurement, or pipeline
fingerprint reaches any customer surface, and `extractionRunId` appears only as
a React key. Two borderline items were reviewed with the owner on 2026-09-16 and
are deliberately kept: the processing table's error-code chip, which is what a
customer quotes to support, and the cost-completeness label, which already sits
inside the gated column.

Acceptance:

- component tests assert no figure on either newly gated surface while cost
  reporting is suspended, mirroring the two existing suspension tests in
  [`tests/component/processing/processing-activity-table.test.tsx`](../../../tests/component/processing/processing-activity-table.test.tsx)
  and [`tests/component/settings/usage-metrics-panel.test.tsx`](../../../tests/component/settings/usage-metrics-panel.test.tsx);
- the `progress_outcomes_and_cost` block in
  [`tests/e2e/import.spec.ts`](../../../tests/e2e/import.spec.ts), roughly six
  tests asserting the four cost states, inverts to absence assertions. The
  `costView` unit tests in
  [`tests/unit/imports/presentation.test.ts`](../../../tests/unit/imports/presentation.test.ts)
  stay exactly as they are, because the view model stays wired and the switch
  must remain exercised;
- a test asserts the two budget inputs and the budget-ceiling readout are still
  rendered, so completing the suspension cannot remove the paid-authorization
  path.

## Delivery order

| Order | Pull request | Contents | Depends on |
|---|---|---|---|
| 1 | Backend | MEM-UX/01 | nothing |
| 2 | Console | MEM-UX/05 and MEM-UX/07 | nothing |
| 3 | Console | MEM-UX/03 and MEM-UX/06 | nothing in code; observed correctness needs 1 deployed |
| 4 | Console | MEM-UX/04 | 3, to avoid two reworks of the same specs |
| 5 | Backend, then Console, then Backend | MEM-UX/02 | owner tag authorization and working GitHub Actions |

Order 2 is first among the Console work because it is mechanical and low risk,
and it should not wait behind the redesign.

## Authorizations required

- the exact tag `console-contract-v1.0.6`, for MEM-UX/02;
- applying MEM-UX/01's migration to `EEC-staging`, which is a deployment;
- deploying the Console, for any of this to be observed.

None of this plan starts a provider request, a paid operation, a worker, or a
hosted mutation.

## Documentation to update as the work lands

- `docs/architecture/console-ui-conventions.md`: open decision 4 gains its
  answer for the two memory surfaces, recorded as an owner decision of
  2026-09-16, alongside the `/processing` answer already there. The remaining
  list surfaces stay open.
- `docs/CHANGELOG.md`: one entry per pull request, recording why, the contracts
  and defaults that moved, the verification evidence, and the remaining gates.
  The MEM-UX/07 entry extends the existing 2026-09-08 cost-suspension record
  rather than opening a second account of the same decision.
- `docs/HANDOFF.md`: branch, next action, and the two blocking prerequisites on
  MEM-UX/02.
- `docs/product/design-partner-console-requirements.md`: G-006 stays unamended
  and stays knowingly unmet. Whoever makes the cost suspension permanent owns
  amending it.

## Status

MEM-UX/05 and MEM-UX/07 are implemented and locally verified on
`MEM-UX/05-07-required-fields-cost-disclosure`. The remaining subtasks stay
planned. Nothing from this plan is merged, deployed, or observed on staging.
