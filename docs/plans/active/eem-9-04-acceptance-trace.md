# EEM-9/04 acceptance trace

Every Definition-of-Done row from the EEM-9/04 section of the controlling
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
| 1 | The browser and BFF never call a provider, queue, internal worker or authorization endpoint | covered | The BFF reaches exactly six published customer operations and nothing else: `tests/unit/imports/adapter.test.ts` pins every URL it builds, and `tests/contract/no-browser-secrets.test.ts` keeps the browser bundle free of a backend client. No provider was called and no paid operation ran; the browser harness maps GitHub to loopback and the API double reaches no network |
| 2 | Organization, repository and run identifiers are tenant-substitution tested through the BFF and the backend boundary | covered | `tests/security/import-boundary.spec.ts` substitutes all three: a foreign repository and an absent one produce identical bytes with no run disclosed, a run the caller cannot see answers exactly as one that never existed, and a direct backend read for another organization is refused. `tests/unit/imports/adapter.test.ts` proves a traversal-shaped identifier never reaches the transport |
| 3 | Response-loss replay and import-specific recovery reuse the exact idempotency key and body and cannot duplicate an import; C04 renders no generic processing-job Retry call to action | covered | `tests/e2e/import.spec.ts` proves same key with same body replays the stored receipt as a success and only a same-key different-body request conflicts; that a second run is not offered while one is current; and, scoped to this page's own content, that no `PROC-002` Retry, Resume and Support control exists and the only retry is the per-job one the projection declared. `tests/component/imports/import-surface.test.tsx` asserts the same absence at component level |
| 4 | The UI never maps an unresolved cost to zero or a rejected or quarantined outcome to knowledge | covered | `tests/unit/imports/presentation.test.ts` asserts an unresolved and an inapplicable cost carry no amount at all, that reserved, measured and unresolved stay separate figures, and that no figure claims invoice authority; `tests/e2e/import.spec.ts` walks all four cost states in the browser and asserts the unresolved headline reads as an absence. Rejected and quarantined are counted apart from failed and both state they never become Knowledge Objects |
| 5 | No approve control appears unless the backend capability permits it | covered | `tests/component/imports/import-surface.test.tsx` asserts approve, pause, resume, cancel and prepare each appear only where permitted, and that a principal without the capability is offered nothing; `tests/security/import-boundary.spec.ts` proves a read-only principal is refused when it posts anyway, so hiding is a convenience rather than the authorization |
| 6 | The operational-authorization wait cannot be bypassed by customer consent | covered | `tests/e2e/import.spec.ts` approves and asserts the run moves to `AWAITING_OPERATIONAL_AUTHORIZATION`, never to `AUTHORIZED`, and that no control is offered afterwards. `tests/unit/imports/presentation.test.ts` asserts the six authorization states are distinct and that only the customer wait and an expired authorization carry an action. The API double implements the same transition, so the assertion is against behaviour rather than against copy |
| 7 | Input ranges, polling cadence, response bodies and retry counts stay bounded under adversarial and duplicate-click tests | covered | Ranges: `tests/unit/imports/request-fields.test.ts` refuses an undefined range, a custom window missing a bound, bounds the wrong way round and a calendar day that does not exist, and `tests/e2e/import.spec.ts` drives the same refusal through the browser. Polling: `src/components/imports/import-poll.tsx` doubles to a ceiling, caps its refreshes and stops while the tab is hidden, and `tests/e2e/import.spec.ts` asserts it runs on a live run and is absent on a terminal one. Bodies: the failure list is bounded by the contract at 500 items and is read only when the projection reports failed work. Duplicate clicks: the replay test in row 3 |
| 8 | C04 journeys pass with fake backend contracts and an integrated free backend | partial | The fake-contract half is covered: `tests/e2e/import.spec.ts` runs the whole journey against a double whose fixtures are validated by the generated schemas, and `tests/contract/console-stub-fixtures.test.ts` fails if a published run state, authorization state or cost state has no fixture. The integrated free backend is `EEM-9/07`; nothing here has run against a deployed backend |

## Requirement ownership from the task reading map

| Requirement | Status | Evidence or owner |
|---|---|---|
| `BF-001` prepare import | covered | `tests/e2e/import.spec.ts::prepare_import` covers the three ranges, the active-entitlement gate, that a duplicate click creates no second run, that refresh restores the current run, and that a caller cannot inject `reextract`. `tests/unit/imports/adapter.test.ts` proves no request body can name a mode at all, because the contract's create body admits none |
| `BF-002` real backend status mapping | covered | `tests/e2e/import.spec.ts::all_backend_states` renders all eight states with the labels the requirement fixes; `tests/unit/imports/presentation.test.ts` pins those labels and proves an unpublished state throws rather than rendering. The derived authorization substate is separate, and a `PROCESSING` run without operational authorization reads as the wait rather than as extraction |
| `BF-003` paid approval | covered | `tests/e2e/import.spec.ts::approve_with_explicit_warning` shows the repository, eligible pull requests, already-processed count, prepared source envelopes, the budget and an explicit paid-model warning, and proves approval requires the capability and produces no authorization by itself. `tests/unit/imports/request-fields.test.ts` pins the budget the contract accepts, including the microdollar edge that rounds to the value it forbids |
| `BF-004` progress | covered | `tests/e2e/import.spec.ts::progress_outcomes_and_cost` and `tests/unit/imports/presentation.test.ts`: every count comes from the backend aggregate, accepted, rejected, quarantined and failed are separate, all four cost completeness states are distinguished, and an unresolved or reserved cost never appears as a measured zero. See the derivation note below for "processed / total" |
| `J-004` prepare and approve historical import | covered | `tests/e2e/import.spec.ts::journey_prepare_and_approve_historical_import` walks range, discovery, the awaiting-approval workload, approval, and the Evirion wait with no customer action. Error flows are covered by the duplicate, stale-status and capability tests above |
| `J-010` recover a paused or failed import | partial | The reading map and the implementation plan's acceptance matrix assign `J-010` to `EEM-9/06` and `tests/e2e/processing-settings.spec.ts`. What this subtask owns is import-run and item recovery, covered by the retry, pause and resume tests in `tests/e2e/import.spec.ts` and by `tests/security/import-boundary.spec.ts`, which proves a job the backend has not declared retryable is refused when posted directly |
| `NFR-ACC-001` accessibility | partial | The ruleset-independent assertions this requirement names ship here: every state carries a text value rather than colour alone, including the two waits, which are distinguished by wording and by `data-waiting-on` rather than by treatment; every control has an accessible name; each surface is reachable by role; and the loading and polling states are announced through a status role. The configured axe gate cannot be written until open decision 1 answers the ruleset, tags and threshold. `NFR-ACC-001` names `I01-C` as primary owner |
| `SEC-WEB-001` access control | partial | `tests/security/import-boundary.spec.ts` covers the import surface, including all three substitutable identifiers, the read-only principal and the absence of any secret in the document. The full per-role matrix against live fixtures is `EEM-9/07` |

## Two derivations recorded rather than hidden

### `BF-004` asks for a count the contract does not publish

The requirement lists "processed / total". `repository-import.json` publishes
neither field. It publishes nine counters in two groups: `counts` with
`discovered`, `enqueued`, `skipped`, `sourceReady`, `completed` and `failed`,
and `dispositions` with `accepted`, `rejected` and `quarantined`.

All nine render under their contract names. The relationship the contract does
support is completed and failed work against what discovery found, and the page
states it in those words rather than presenting a `processed` aggregate the
backend never sent. Inventing one would be the UI computing a figure, which is
the thing this surface is not allowed to do.

This is an owner-confirmable reading rather than a gap: no contract change is
required either way, and approved wording would replace the sentence without
invalidating an acceptance row.

### The contract names no capability for the import operations

Every import operation is authorized by the backend, and the run projection
carries its own per-caller `capabilities`. Those four booleans decide approve,
pause, resume and cancel, and are only ever narrowed by the Console.

Preparing and retrying have no such projection: one has no run yet, and a
failure item carries the work's `retryable` rather than the caller's
permission. Both therefore need a session capability, and the contract
publishes no capability name for imports and no closed capability enum. The
nearest published one, `repository.policy.manage`, is used, on the reading that
consenting to paid extraction for one repository is the same class of decision
as setting its live processing policy.

It is recorded as an assumption because it is one. It is also not load-bearing
for security: hiding a control is a convenience, the backend refuses the
request either way, and `tests/security/import-boundary.spec.ts` proves the
refusal rather than assuming the control's absence.

## Two defects the browser gate found in this subtask's own work

Both were found against the running BFF and fixed before the gate was frozen.

- **A read-only principal was offered the approve control.** The page reflected
  the projection's `capabilities`, which is correct, but the API double served
  the same capabilities to every caller, which a real backend never does:
  capabilities are its answer for the calling principal. The double now
  computes them per caller, and the page additionally narrows every control by
  the session capability.
- **The generic-Retry assertion was matching the shell navigation.**
  `/processing` is a navigation entry `EEM-9/02` owns, and a nav link is not a
  recovery call to action. The assertion is now scoped to the page's own
  content and additionally pins that the only retry rendered is the per-job one
  the projection declared.

A fixture defect was caught by the coverage assertion on its first run: a
capability flag sat outside its object, so the run did not validate against the
generated schema. That is what the assertion exists for.

## The gap this subtask had to close before it could start

Four of the six import operations answer with `RepositoryImportReceipt`, and
the generated client contained no such type. The contract declares that receipt
inline in `openapi.yaml` rather than as a schema file, and
`scripts/generate_console_client.py` read only `schemas/*.json`, so it never saw
it. `isCommandReceipt` could not stand in: `command-receipt.json` fixes
`responseCode` to the four entitlement codes, so every import receipt would have
been classified `UNSUPPORTED_SERVER_RESPONSE` and no import mutation could ever
have succeeded.

This is unlike the `repository-overview.json` gap the EEM-9/03 trace records.
There the contract had no bytes at all. Here the bytes exist and are signed:
`openapi.yaml` is a manifest member, digest verified before the generator is
given it. So the type is generated from the contract rather than hand-written,
which is what `AGENTS.md` requires and what EEM-9/03 declined to compromise on.

Reading it needed a parser the repository does not have, and the Python gate is
standard-library only by design, so `scripts/openapi_components.py` accepts the
exact subset the frozen contract uses and raises on anything else. The
projection rule takes an envelope's `data` rather than the envelope, which keeps
the generated type parallel to every other one and needs no second transport
path. Forty of the contract's forty-one success responses reference the bare
`SuccessEnvelope`, so the rule matches exactly one component today and
`tests/test_console_contract.py` pins that.

It also recovered an annotation that was being dropped: the contract marks
`RepositoryImportReceipt/responseCode` with an unsupported-value sentinel, and
`unsupported-states.ts` did not carry it.

## Open decisions carried, not answered

- **Decision 1**, accessibility: `AGENTS.md` already fixes WCAG 2.2 AA as the
  target. The axe ruleset, tag selection and pass threshold remain open, and
  that is what an executable gate needs. This subtask ships the
  ruleset-independent assertions and records the dependency.
- **Decision 3**, the wording for the four confusable terms. The tests assert
  that the two waits are separate and separately attributed rather than
  asserting these words, so approved copy lands without invalidating a row.
- **Decision 4**, the list primitive. The failure list is the only list here and
  the tests assert accessible names and per-item state rather than the element.
- **Decision 5**, loading and error treatment. Loading and polling are announced
  through a status role and failures render inline; the visual treatment is
  still open. The two waits are deliberately not a shared treatment, which is a
  Definition-of-Done requirement rather than a design choice.

## An operational note for the next session

A local browser gate must start with ports 3000, 3443 and 3444 free. Two
different stale processes cost debugging cycles here, and neither announced
itself.

`playwright.config.ts` sets `reuseExistingServer: !process.env.CI`, so a stub
left listening on 3444 is reused silently and serves whatever fixtures that
older process was built with. Every browser test then fails at scenario load
with a `500`, which reads as thirty-eight independent failures.

Worse, `tools/local-tls/serve.mjs` starts Next with `--hostname 127.0.0.1`,
which binds IPv4 only, while an abandoned `next-server` from an earlier session
binds the IPv6 wildcard. Both then listen on 3000, the edge reaches whichever
the resolver hands it, and the gate intermittently answers from a build that is
days old. The symptom is a small, shifting set of failures in suites nobody
touched: `404` for chunk names the old build never had, and pages that render
the wrong thing. `pkill -f serve.mjs` does not clear it, because the orphan's
command line is `next-server`.

Check the three ports before running a gate rather than trusting `pkill`. CI is
unaffected: it starts clean and sets `CI`, which disables server reuse.

## What this subtask does not claim

Implemented and locally verified only. Nothing is merged, deployed, observed,
staging-certified, paid-certified or production-certified. No provider was
called, no paid operation was authorized, no worker ran, no hosted Supabase
setting was read or changed, and no remote deployment happened.

The backend sibling checkout was used read only: its authority pointer was
verified and its working tree was inspected, and nothing was written to it. It
was, separately and concurrently, being changed by its own `EEM-7/05` work,
including `contracts/console/v1/openapi.yaml`. That does not reach this branch.
The Dashboard consumes the pinned, released `console-contract-v1.0` archive, and
`scripts/check_console_contract_lock` still verifies it at `packageSha256`
`53da9379428d8f34b7e674805019244e85ed89a7cd6f0e1d9b4a2a79b23d6b6c`.
Unreleased backend contract edits become consumable only through a new signed
release, which `docs/ROADMAP.md` schedules as one later subtask.
