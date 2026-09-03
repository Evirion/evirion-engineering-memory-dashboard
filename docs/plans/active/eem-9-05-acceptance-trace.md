# EEM-9/05 acceptance trace

Every Definition-of-Done row from the EEM-9/05 section of the controlling
[EEM-9 plan](eem-9-design-partner-console-dashboard-and-certification.md) maps
here to a named executable test or to an explicit reason it is not this
subtask's to satisfy. A link is not evidence; a row with no test and no owner
elsewhere is a gap.

Rows are numbered in the order the plan states them.

## Status vocabulary

- **covered** — a named test in this repository asserts it now.
- **partial** — asserted here for the half the Console owns, with the rest
  named against its owner.
- **owned elsewhere** — the plan assigns primary evidence to another subtask.
- **blocked** — the row cannot be satisfied by anyone yet, and why.

## Trace

| # | Definition-of-Done row | Status | Evidence or owner |
|---|---|---|---|
| 1 | Original versus edited value and evidence is visually and semantically distinct | covered | `tests/e2e/memory-detail.spec.ts` asserts both regions are present at once on an edited object, that the original is not behind a disclosure or a destructive action, and that no derivative renders when the backend says the object is not edited. `tests/unit/memory/presentation.test.ts` proves `humanEdited` is read from the effective review rather than inferred by comparing payloads: the same fixture, whose history contains an edit, yields no derivative when the backend fact says it is not edited. The evidence half is asserted by the warning that the edited words were not re-extracted, in both the derivative panel and the edit form |
| 2 | Every action forwards its exact optimistic-version set without local synthesis | covered | `tests/unit/memory/adapter.test.ts` pins each body: review and activate carry the observed pair, supersession carries four tokens with the new object named in the body, and a correction carries the relation version only when retracting. It also proves zero survives, which is the case that would break first, since review sequence zero is `PENDING` and lifecycle version zero is `UNRESOLVED`. `tests/e2e/memory-review.spec.ts::stale_review_conflict` proves each of the two single-object tokens conflicts alone and that neither conflict records anything, and `::supersede_direction` proves all four are rendered on the confirmation step the reviewer reads before submitting |
| 3 | Knowledge, evidence, review, relation and correction identifiers are cross-tenant and cross-organization substitution tested through direct BFF calls | covered | `tests/security/memory-boundary.spec.ts` substitutes all five. A foreign Knowledge Object and one that never existed produce the same status and the same rendered text; a direct backend read for another organization is refused with `ORGANIZATION_MEMBERSHIP_REQUIRED`; a review mutation naming a foreign object answers as one naming an absent object; a foreign relation and a relation belonging to a different object of the same tenant are both refused without mutating; a supersession naming a foreign replacement answers as one naming an absent replacement; and no foreign evidence, review or correction identifier reaches the document. `tests/unit/memory/adapter.test.ts` proves a traversal-shaped identifier never reaches the transport |
| 4 | Rejected and quarantined runs never render as Knowledge Objects | covered | `tests/e2e/memory.spec.ts::pending_queue_excludes_outcomes` walks all four review-status filters and finds neither. `tests/e2e/memory-detail.spec.ts::source_context` proves the detail route answers `404` for both even though the backend serves the projection, so the refusal is the Console's own and not a fixture artefact. `tests/security/memory-boundary.spec.ts` proves the same of the supersession picker, which is the surface's second read path and needed the gate separately. `tests/contract/console-stub-fixtures.test.ts` fails unless a fixture exists for each of the three admission dispositions, so the tests above cannot pass by there being nothing to find |
| 5 | Unauthorized and sensitive fields are absent from fixtures, DOM, telemetry, errors, cache and source maps | partial | `tests/security/memory-boundary.spec.ts` asserts no caller token, service-role string, DSN, GitHub token pattern, Source Envelope or raw model response reaches the document on three surfaces, and that the session is unreadable from `document.cookie`, `localStorage` and `sessionStorage`. `tests/contract/no-browser-secrets.test.ts` keeps the browser bundle free of a backend client, and `tests/security/headers-cache-isolation.spec.ts` owns the cache contract. Telemetry has no owner here because the Console emits none yet; source-map inspection at a built artefact is `EEM-9/07` |
| 6 | Loading, empty, error, conflict, locked and operator-managed states pass unit, Playwright and accessibility checks | partial | Empty: `tests/e2e/memory.spec.ts` for both the empty queue and an unreadable one, which must not read as empty. Error: the same file for an unreadable queue and `tests/e2e/memory-detail.spec.ts` for unreadable evidence, which must not read as no evidence. Conflict: `::stale_review_conflict` and `::mark_active` for each token alone. Locked: `::unresolved_state` and the viewer cases, where no control is offered and the backend refuses anyway. Operator-managed: `::correction_history`, where an in-progress request is a legitimate state with no customer action rather than a failure. Unknown, which the conventions matrix marks reachable on every route: the `memoryUnsupported` scenario serves a lifecycle state no contract publishes, and both the queue and the detail fail closed rather than rendering a partial document. Loading is server-rendered on every one of these routes, so there is no client loading state to assert. The accessibility half is ruleset-independent only, pending open decision 1 |
| 7 | Every C05 requirement and acceptance row has named UI evidence | covered | The table below names all twenty coverage identifiers from the implementation plan's acceptance map against the tests that discharge them |

## Requirement ownership from the task reading map

The implementation plan's acceptance map names twenty coverage identifiers for
this surface across three spec files. As in the EEM-9/04 trace, the identifier
is the plan's label for a concern rather than a test function name, and the
tests that discharge it are named here.

| Requirement | Coverage identifier | Status | Evidence or owner |
|---|---|---|---|
| `MEM-001` | `memory.spec.ts::pending_queue_excludes_outcomes` | covered | Four tests: the default view is the backend's own `PENDING`, no filter combination reaches a machine-rejected or quarantined extraction, user-rejected and superseded objects stay reachable through an explicit filter, and an unreadable queue reports itself rather than rendering empty |
| `MEM-002` | `memory.spec.ts::filters_and_pagination` | partial | The filter state lives in the URL and survives a reload, the link embeds no secret, the cursor follows the backend's own `nextCursor` and keeps the predicates, a predicate the contract does not admit is dropped, and the repository queue is scoped by its path rather than by an editable predicate. `tests/unit/memory/filters.test.ts` covers each dropped value. `MEM-002.A5`, a measured query plan for a large tenant, is `B09` and cannot be produced against a double |
| `MEM-003` | `memory.spec.ts::queue_row` | covered | The row carries short claim, type, pull request, merge date, confidence and both states, and the same test asserts no evidence quote and no extraction run identifier reaches the list. `tests/component/memory/memory-queue.test.tsx` asserts a null pull request reads as absent rather than as a zero |
| `KD-001` | `memory-detail.spec.ts::original_and_edit` | covered | Six tests covering both regions present at once, the derivative labelled as the reviewer's, no derivative when the backend says the object is not edited, no invented empty section, and the two axes readable separately. The edit schema version is reported in the technical block, which is where `KD-001` asks for it |
| `KD-002` | `memory-detail.spec.ts::evidence_before_action` | covered | The exact quote with author and source type, the evidence positioned above every control by geometry rather than by intention, no Source Envelope or raw model response in the document, every evidence link on the host the contract allowlists, and an unreadable evidence read reported as unavailable rather than as no evidence |
| `KD-003` | `memory-detail.spec.ts::source_context` | covered | Pull request number, title, author, merge date and a github.com link. A foreign identifier, an absent one, a malformed one and a non-admitted one all answer `404`, so none discloses that an object exists |
| `KD-004` | `memory-detail.spec.ts::technical_details` | covered | The collapsed block carries the extraction run, admission and its origin, model, pipeline fingerprint, extracted timestamp, latency, aggregate token usage and cost with its completeness. A reserved cost states that it is held and not settled, and no state renders as a settled zero. A separate test asserts no credential, DSN or raw model response is in the document |
| `REV-001` | `memory-review.spec.ts::approve_original` | covered | Four tests: an approval is recorded and says the lifecycle did not move, the decision is appended rather than replacing one, a duplicate submission with the same key and body replays instead of recording twice, and a viewer is offered nothing |
| `REV-002` | `memory-review.spec.ts::edit_with_evidence_warning` | covered | Six tests: the evidence warning, the machine extraction still present and unchanged after an edit, an incomplete derivative refused rather than completed, an empty list accepted because the schema admits one, a second edit prefilled from the current derivative rather than the original, and the two enum keys editable as `REV-002` lists them |
| `REV-003` | `memory-review.spec.ts::reject_reason` | covered | Four tests: a structured reason and severity are recorded, the original knowledge and its evidence survive a rejection, a reason the contract does not publish is refused, and normal reject is unavailable once the lifecycle is not unresolved |
| `REV-004` | `memory-review.spec.ts::stale_review_conflict` | covered | Five tests: each token conflicts alone, neither conflict records anything, a conflict reads as something to reload rather than as a failure, and the rendered form carries zero as zero |
| `REV-005` | `memory-review.spec.ts::revert_is_explicit` | covered | Four tests: an edited object is offered no generic approve, the revert control says the edit is kept, the revert is appended with the edit still in the timeline, and the history renders as a timeline with no delete and no amend. `B09` owns the projection half |
| `LIFE-001` | `memory-review.spec.ts::unresolved_state` | covered | Four tests: no lifecycle event is unresolved and not unknown, no lifecycle action exists before the object is reviewed, recording a review leaves the lifecycle where it was, and a viewer is offered nothing |
| `LIFE-002` | `memory-review.spec.ts::mark_active` | covered | Four tests: activating puts the object in trusted memory, the review state is untouched, the reauthentication precondition is stated, and a stale lifecycle version is refused with nothing recorded |
| `LIFE-003` | `memory-review.spec.ts::supersede_direction` | covered | Six tests: the direction is stated in words before recording, the relation is recorded without activating the newer object, all four tokens are rendered on the confirm step, a cycle is refused without mutating, an exhausted traversal bound fails closed, and self supersession is refused before the backend is called |
| `LIFE-004` | Contract capability test | owned elsewhere | `withdrawn` is not a reviewer action, and the Console offers none. `tests/unit/memory/presentation.test.ts` pins that the four lifecycle labels are distinct so an internally withdrawn object still renders, and `tests/e2e/memory-review.spec.ts::unresolved_state` pins that no control produces one. `B08` owns the primary evidence |
| `LIFE-005` | `memory-review.spec.ts::correction_history` | covered | Six tests: every published status renders with no operator control anywhere, a failed request shows a bounded support status with the failure code and no retry, the append-only history shows both actor kinds, no operator is named, a created request reports that nothing has changed yet, and a reason that carries no meaning on its own requires a note. `failureCode` is a bounded free string rather than a closed vocabulary, and the contract names it customer-safe and the operator's one channel to the requester, so it is rendered as sent |
| `G-004` | `memory-review.spec.ts::goal_human_validation_preserves_machine_provenance` | covered | Two tests. The first reads the backend projection before and after an edit and asserts `originalPayload`, `technicalDetails` and `sourceContext` are byte-identical while `humanEdited` moved. The second asserts the evidence set is unchanged |
| `G-005` | `memory-review.spec.ts::goal_lifecycle_is_independent` | covered | Two tests. The first drives all three directions: a review with no lifecycle movement, a lifecycle movement with no review recorded, and an active object reviewed again. The second asserts the two axes never share a word for two different facts |
| `J-005` | `memory-review.spec.ts::journey_review_knowledge_object` | covered | Opens from the queue, reads the claim, source and both evidence quotes before any control, decides, and sees the committed result rendered from the re-read projection |
| `J-006` | `memory-review.spec.ts::journey_supersede_old_knowledge` | covered | Opens the old object, selects the newer one, confirms the stated direction, records it, and finds the object superseded with normal review actions gone and the correction path offered instead |
| `BR-020` | secondary | partial | Provenance is preserved across every human decision, which `G-004` proves. `B07` and `B08` own the durable half |
| `NFR-SEC-004` | secondary | partial | `tests/security/memory-boundary.spec.ts` covers this surface. The full per-role matrix against live fixtures is `EEM-9/07` |
| `NFR-ACC-001` | accessibility | partial | Ruleset-independent assertions ship here: every control has an accessible name and an associated label, both lists carry accessible names, each state carries a text value rather than colour alone, and the two axes are separately labelled. The configured axe gate waits on open decision 1. `I01-C` is the named primary owner |

## Two contract limits recorded rather than hidden

### Three lifecycle operations require a freshness no session field reports

`openapi.yaml` states that activation, supersession and correction each require
`knowledge.lifecycle.manage` **and** recent reauthentication, and states just as
explicitly that recording a review does not, because the approved EEM-4 session
freeze reserves one-time reauthentication for enumerated dangerous operations.

The Console cannot tell a customer whether that freshness is currently
satisfied, for two reasons that compound.

`session-context.json` pins `session.status` to `"const": "ACTIVE"`. It is not
that the field is missing: the projection is structurally forbidden from
reporting anything else. Meanwhile `session.json`, the session-list schema,
publishes `status` as an enum that includes `REAUTH_REQUIRED`. The backend has
the concept and the session list can report it; the current-session projection
cannot.

And none of the published error codes distinguishes stale freshness from being
signed out. A refusal therefore arrives as `AUTHENTICATION_REQUIRED`, whose
reviewed treatment is `sign-in-required`, which tells an already-signed-in
customer to sign in.

What ships here is what can honestly be built. The three confirm steps state
the operation's own published precondition — that the action may ask you to
sign in again — and claim no knowledge of whether it is met.
`tests/e2e/memory-review.spec.ts::mark_active` asserts the notice is present.
The refusal renders through the existing fail-closed path, and no treatment is
invented for a code the contract does not publish.

This is not the EEM-8/05 situation. There the contract published no payload
schemas, the generated client had no types and the surface was unwritable.
Here everything needed to build and call is published; only the recovery
affordance is missing. `error.json` declares `UNSUPPORTED_SERVER_RESPONSE` as
its `x-evirion-unsupported-value` and keeps it inside the enum, so the code
list is additively widenable: a `REAUTHENTICATION_REQUIRED` code can land in a
1.x revision, and the mutation path would need no rework, only a new case in
the error mapping.

The backend request is two additive things: a distinct error code, and either
widening `session-context.session.status` to the enum `session.json` already
publishes or adding a freshness field. Without one of them the Console cannot
tell "sign in" apart from "you are signed in, but this action needs a fresher
proof", and those are different instructions to a customer.

### A conflict cannot report the legitimate zero

`error.json` constrains `currentVersion` to `minimum: 1`. Both knowledge tokens
legitimately reach zero: `KnowledgeExpectedSequence` says so in the contract's
own words, because review sequence zero is `PENDING` and lifecycle version zero
is `UNRESOLVED`.

So a conflict against a zero cannot carry the current value. Sending it anyway
fails the generated validator and turns a published refusal into
`UNSUPPORTED_SERVER_RESPONSE`, which is how this was found: the stale-lifecycle
test reported an unknown outcome for a refusal the backend had stated clearly.
The double now omits the field below one, and a real backend must do the same.

The customer consequence is bounded and worth stating. On a conflict against a
zero the surface says the state changed and to reload, but cannot say what it
changed to. That is the `PENDING` and `UNRESOLVED` case specifically, which is
the most common starting state in a review queue. Raising it in the same
backend request as the code above would cost nothing extra.

## One derivation recorded rather than hidden

### Two of the eleven operations are bound but not read

The adapter binds all eleven published knowledge operations, and each one's URL
and validator are pinned by `tests/unit/memory/adapter.test.ts`. Two of them,
the standalone review-state and lifecycle-state reads, are not called by any
page: `KnowledgeDetail` embeds both documents, so a screen holding the detail
already has them, and a second round trip would only risk rendering a claim and
a token taken a moment apart.

They are kept rather than dropped because the module's purpose is to bind the
published surface, and a later task adding two operations back would be a worse
outcome than an unused export whose reason is written where a reader finds it.
This is a judgement rather than a requirement, and it is recorded as one.

## What the self-audit changed

One full-diff audit ran after the product code stabilised. Five findings, all
accepted and fixed in one remediation wave. Two were behaviour:

- **An empty list could not be submitted.** The seven array fields of the
  editable projection have no lower bound in the schema, so a claim documenting
  no trade-off is as valid as one documenting three. The form required them and
  the route refused them, which would have blocked a legitimate edit outright.
- **Two editable keys were not editable.** `knowledgeType` and
  `implementationStatus` are among the thirteen keys `REV-002` lists, and they
  were carried through as fixed hidden values. That quietly narrowed the
  contract. Both are now selects over the published vocabularies.

One was a correctness risk found while reading rather than by a test: a second
edit prefilled from the machine extraction, so opening the form on an already
edited object would have silently discarded the previous reviewer's words. It
now prefills from the current derivative.

The remaining two were hygiene: a redundant backend round trip in the
supersession target read, and two exports nothing called.

## Independent review

One bounded review wave ran against this tree: a security reviewer and a
correctness reviewer in parallel. They independently reported the same single
defect, which is the strongest signal either could have given.

**The supersession picker skipped the admission gate.** `readKnowledgeDetail`
refuses a `REJECTED` or `QUARANTINED` admission with not-found, and
`readSupersessionTarget` did not. A crafted `?supersedeWith=` on an otherwise
valid detail page therefore rendered a machine outcome's claim in the confirm
step, disclosing both that the extraction exists in the tenant and what it
says, for an identifier that answers `404` when opened directly. The backend
would still have refused the mutation, so this was read-side disclosure rather
than a lifecycle write, and it breaks Definition-of-Done row 4.

The cause is worth naming rather than just the fix: the confirm step is a
second read path, and the gate had been applied to the first one only. It is
now applied to both, and a foreign target, an absent one and a non-admitted one
all return the same unavailable answer, so naming an object as a replacement
discloses exactly as much as opening it would.
`tests/security/memory-boundary.spec.ts` proves it, and the test was written to
fail against the defect before the fix landed.

The security reviewer found nothing else at medium severity or above. It
confirmed that the mutation boundary settles before any form field is read and
matches `import-command.ts` in ordering and failure semantics, that the
organization comes from the backend's live projection and never from a form,
that every adapter path identifier is UUID-validated, that the caller token
stays inside the query module, that every memory component is a server
component, and that a crafted filter value is dropped rather than echoed or
forwarded. It noted below its threshold that the two edit enums are not
enum-checked at the BFF, which is deliberate: the backend and the generated
schema own that vocabulary, and re-encoding a closed list in a second place is
how the two drift.

Both reviewers were given `tools/console-stub/` as a test double and asked
whether a weakness in it would let a real assertion pass vacuously. Neither
found one, and a later read found the class they had both missed, below.

## What a further review found in the double's consistency

A review after the wave, requested by the owner and agreed as a second
remediation pass, found one class of gap that the wave could not: the double
always derives internally consistent projections, so no test exercised a
contract-legal response with an optional block absent. Two shapes matter.

`review` is optional on `KnowledgeDetail` and is the only source of
`allowedActions`. If a backend omits it, no review control renders, on exactly
the objects most in need of review. The behaviour was already fail-closed, but
the message blamed the object's state for what was really an undetermined
answer. The two are now told apart.

`editedPayload` is optional on a review, so a backend can report an object as
edited and give nothing to render. `editedDerivativeOf` folded that into "no
edit", which left the page declaring an edit that was nowhere on screen and
handed the edit form the machine extraction to start a second edit from. That
is the silent discard the effective-payload prefill had just been introduced to
prevent, reached through a different door. The function now returns three
outcomes rather than two, the page states that an edit exists and cannot be
shown, and the edit form warns before starting from the extraction instead.

Both are covered by a `memoryPartialProjection` scenario that withholds each
block per scenario rather than storing it, so every other test keeps deriving
consistently.

Four further findings were judged not worth code changes: a note longer than
2000 characters sent by direct call can be truncated into one the backend
refuses, which mirrors the same helper in `repositories.ts` and is unreachable
through the form; `acknowledgedEvidenceIds` is bound in the adapter and read by
no route, so the field cannot be sent; `readRelation` ignores extra
colon-separated segments, both parts being validated; and the wording above
about `failureCode` was corrected rather than the code.

## Open decisions carried, not answered

- **Decision 1**, accessibility. `AGENTS.md` fixes WCAG 2.2 AA as the target;
  the axe ruleset, tag selection and pass threshold remain open, and that is
  what an executable gate needs. The ruleset-independent assertions ship here.
- **Decision 2**, copy for the published error codes. Nothing in this subtask
  adds a treatment; every refusal routes through the existing reviewed table,
  and the four knowledge receipt codes get neutral text stating what committed.
- **Decision 3**, the wording for the four confusable terms. This surface
  touches two of them: a correction request is a wait on Evirion with no
  customer action, and it is worded differently from a review the customer
  owns. The tests assert the separation rather than these words.
- **Decision 4**, the list primitive. It lands hardest here, because this
  subtask owns the queue, the evidence list, the review timeline and the
  correction list. Every acceptance row asserts an accessible name or per-item
  state, so a later table or card decision invalidates none of them.
- **Decision 5**, loading and error treatment. All four routes are
  server-rendered, so there is no client loading state; failures render inline
  through the shared unavailable block. The visual treatment is still open.

Decision 6 is closed and does not apply here: repository counters live on
`/repositories/:repositoryId` and belong to EEM-9/06.

## An operational note

The port caution the EEM-9/04 trace records held again. One combined browser
run in this subtask failed three tests that passed individually moments later,
with no source change between the runs. Checking the three ports and rerunning
cleared it. `reuseExistingServer` is on outside CI, so a gate can silently
answer from an older build; the three ports are worth checking rather than
trusting `pkill`.

## What this subtask does not claim

Implemented and locally verified only. Nothing is merged, deployed, observed,
staging-certified, paid-certified or production-certified. No provider was
called, no paid operation was authorized, no worker ran, no hosted Supabase
setting was read or changed, and no remote deployment happened.

The backend sibling checkout was used read only: its authority pointer was
verified and nothing was written to it. The pointer resolved to Dashboard
commit `a6665b599472e295636382ece4d0071e1cb4492c` with `packageSha256`
`6897d9661a038a14eee0fd8128e7a3e96d5b191ef41f197f621779cc2e0ec56f`, which is
the EEM-9/01 authority package it pins and not this working tree.

No contract bytes changed. The Console consumes the pinned
`console-contract-v1.0.2` release, and the eleven knowledge operations it
publishes were already generated by `EEM-9/03f`.
