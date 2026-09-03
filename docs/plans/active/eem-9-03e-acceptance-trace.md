# EEM-9/03e acceptance trace

Every behaviour this subtask changed maps here to a named executable test or to
an explicit owner elsewhere. A link is not evidence; a row with neither a test
nor a named owner is a gap and is recorded as one.

EEM-9/03e has no Definition-of-Done section in the controlling
[EEM-9 plan](eem-9-design-partner-console-dashboard-and-certification.md),
because it did not exist when that plan was frozen. Its scope is fixed by
[`ROADMAP.md`](../../ROADMAP.md), "The next Dashboard contract consumption is one
subtask, not two", which names the consumption plus three UI changes. The
plan's `EEM-9/03` and `EEM-9/06` rows remain controlling for the surfaces this
subtask touches.

## Status vocabulary

- **covered** — a named test in this repository asserts it now.
- **partial** — asserted here for the half the Console owns, with the rest
  named against its owner.
- **owned elsewhere** — primary evidence belongs to another subtask.
- **carried** — a dependency this subtask deliberately did not resolve.

## What the release changed

`console-contract-v1.0.1` is a revision of contract `1.0`, not a new version.
Three files moved and `packageSha256` went from `53da9379` to `29ff7b73`:

- new `repository-overview.json`, seventeen counters;
- new `organization-model-profiles.json`;
- `error.json` gained a thirty-ninth code, `MODEL_PROFILE_NOT_OFFERED`.

## Phase 0, the trust-boundary amendment

| # | Behaviour | Status | Evidence or owner |
|---|---|---|---|
| 0.1 | The frozen `console-contract-v1` `refPattern` admits an optional release revision | covered | `ContractRevisionTagGrammarTests.test_a_version_or_a_revision_tag_is_admitted` accepts `console-contract-v1.0`, `v1.0.1` and `v2.3.17`. Each candidate rewrites every tag-bearing field and the expectation together, so the grammar is the only thing left that can refuse it |
| 0.2 | Nothing else became admissible | covered | `ContractRevisionTagGrammarTests.test_every_other_tag_shape_stays_refused` refuses `v1.0.0`, `v1.0.1.1`, `v1`, `v1.0-rc1`, `v1.0.`, `v.1`, a leading-zero revision, and a foreign namespace |
| 0.3 | The grammar cannot drift from the backend workflow that enforces it | covered | `ContractRevisionTagGrammarTests.test_the_grammar_mirrors_the_backend_release_workflow` compares this repository's pattern against the literal from backend ADR 0014. The two are written separately in two languages, so drift on either side fails here |
| 0.4 | Every other refusal in the policy is unchanged | covered | `ArtifactAttestationPolicyTests.test_repository_policy_fixture_rejects_every_required_negative` still rejects all 28 negative cases for both artifact entries against the amended policy |
| 0.5 | The widening did not weaken the already-published release | covered | `console-contract-v1.0` was re-downloaded and re-verified with pinned cosign v3.1.3 against the pinned trusted root, offline, before its recorded `policyDigest` changed. `ConsoleContractLockTests` and `test_published_console_contract_evidence_is_accepted` verify the recorded evidence against the amended policy |
| 0.6 | The lock, the evidence and the policy agree on one digest | covered | `check_console_contract_lock.verify_lock_against_policy` and `verify_recorded_evidence`; `ConsoleContractLockTests.test_stale_lock_digest_is_rejected` proves a stale one is refused |

## Phase 1, consuming the release

| # | Behaviour | Status | Evidence or owner |
|---|---|---|---|
| 1.1 | The vendored tree is exactly the pinned archive, and the archive is the pinned digest | covered | `ConsoleContractLockTests.test_vendored_bytes_are_exactly_the_pinned_archive` and `test_replaced_archive_bytes_are_rejected` |
| 1.2 | The consumed bytes are the published content set | covered | `ConsoleContractLockTests.test_console_contract_content_is_the_consumed_revision` pins `packageSha256` `29ff7b73` and verifies every manifest member |
| 1.3 | The generated client reproduces byte for byte from the pinned asset | covered | `ConsoleContractLockTests.test_generated_client_is_reproducible_from_the_pinned_asset`; CI additionally runs `git diff --exit-code -- generated` |
| 1.4 | The export surface moved, and moved only additively | covered | `generatedClientSurfaceSha256` is `08178d2f`. Four exports added, none removed or renamed: `RepositoryOverview`, `isRepositoryOverview`, `OrganizationModelProfiles`, `isOrganizationModelProfiles`. The lock check reports any surface change as a breaking backend change because the digest is over sorted export names and cannot distinguish the two; the additive claim is the reviewed judgement recorded in the Phase 1 commit |
| 1.5 | A revision did not move the API version | covered | `ConsoleContractLockTests.test_the_revision_did_not_move_the_api_version` asserts the lock, the vendored manifest and the generated validator all still say `1.0`, so the envelope guard in `src/server/adapters/console-api.ts` is untouched and no Console read breaks |
| 1.6 | The generated client records its own provenance | covered | `ConsoleContractLockTests.test_generated_client_records_its_provenance` and `tests/contract/console-contract-provenance.test.ts`, which reads the lock rather than a copied literal |
| 1.7 | The thirty-ninth error code has a reviewed treatment | covered | `TREATMENTS` in `src/lib/errors/console-errors.ts` is `Record<ConsoleErrorCode, ErrorTreatment>`, so `tsc` refused the build until `MODEL_PROFILE_NOT_OFFERED` was mapped. It is `field-level`: the action is available and the named value is not, so the remedy is to change the field. Customer wording is open decision 2 |
| 1.8 | Backend Auth parity still holds at the new source commit | covered | `scripts/check_backend_auth_parity.py` verified at `2458f333` against the sibling; `tests/contract/backend-auth-parity.test.ts` asserts the lock follows the contract source commit. Both recorded files are byte-identical at `20cd3b60` and `2458f333`, so no derived Auth value moved |
| 1.9 | The superseded evidence is retained rather than removed | covered | `docs/contracts/console-contract-v1.0-evidence.json` stays tracked and inventoried; `tests/test_bootstrap_contract.py` requires both evidence files to exist |

## Phase 2, the repository counters

Closes **open decision 6**. The question was never only a product one: while the
contract published no schema, the counters were unimplementable by EEM-9/06 as
much as by EEM-9/03. Requirements Section 10 gives the overview no route of its
own, so `/repositories/:repositoryId` is the only route that could carry it.

| # | Behaviour | Status | Evidence or owner |
|---|---|---|---|
| 2.1 | `REPO-003` counters render on the repository detail page | owned elsewhere, implemented here | `REPO-003` remains an `EEM-9/06` requirement. The block is implemented here because the page is EEM-9/03's. `tests/e2e/repositories.spec.ts` "shows the repository counters the contract now publishes"; `tests/component/repositories/repository-detail.test.tsx` "renders all seventeen published counters" |
| 2.2 | Seventeen counters, not the sixteen the requirement names | covered | `tests/unit/repositories/presentation.test.ts` "renders every published counter and invents none". The extra is `withdrawn`, the discrepancy backend issue [#53](https://github.com/Evirion/evirion-engineering-memory/issues/53) recorded and resolved deliberately; the published schema is followed, not the requirement text |
| 2.3 | A counter the backend adds later cannot be silently dropped | covered | Both label tables are `Record<keyof RepositoryOverview[...], string>`, so an unlabelled counter fails `tsc`. `tests/unit/repositories/presentation.test.ts` asserts the rendered key order equals the published field order |
| 2.4 | An unavailable aggregate never renders as `0` | covered | Structural, not defensive: every counter is `required`, so an uncomputable one cannot be represented and the document fails validation. `tests/unit/repositories/adapter.test.ts` proves a missing and a null counter both fail closed; `tests/component/repositories/repository-detail.test.tsx` asserts no digit appears in the unavailable block; `tests/e2e/repositories.spec.ts` asserts the same in the browser |
| 2.5 | A genuine zero renders as zero | covered | The other half of 2.4, and the reason a dash is not acceptable. `tests/component/repositories/repository-detail.test.tsx` "renders a genuine zero as zero rather than hiding it"; the stub fixture carries `quarantinedRuns: 0` deliberately |
| 2.6 | `REJECTED` and `QUARANTINED` never read as Knowledge Objects | covered | `tests/unit/repositories/presentation.test.ts` "keeps machine dispositions out of the Engineering Memory group"; `tests/e2e/repositories.spec.ts` "keeps machine dispositions out of the Knowledge Object count" |
| 2.7 | A machine rejection and a reviewer rejection never read alike | covered | `tests/unit/repositories/presentation.test.ts` "never labels a machine rejection and a reviewer rejection the same way" asserts every label is distinct |
| 2.8 | The rendered cutoff is visible | covered | Two figures at different `asOf` values are not comparable. Component and browser tests both assert the cutoff appears |
| 2.9 | Failing counters do not take the page down | covered | The overview is an independent sub-view. `tests/e2e/repositories.spec.ts` "renders an unreadable overview as an explicit state, never as zero" asserts the policy vocabulary still renders |
| 2.10 | The EEM-9/03 counters-absent test is replaced, not deleted | covered | `tests/e2e/repositories.spec.ts` carries the inverted assertion plus two states the original could not reach. The deliberate-absence comments in `page.tsx` and the component test header are corrected |

## Phase 3, the consent catalogue

| # | Behaviour | Status | Evidence or owner |
|---|---|---|---|
| 3.1 | `AUTO_EXTRACT` profiles are chosen from the published catalogue | covered | `tests/component/repositories/repository-actions.test.tsx` "offers the catalogue as a choice rather than as free text" asserts the free-text input is gone and the checkbox group is present |
| 3.2 | The posted value is the registry's canonical identifier | covered | `tests/component/repositories/repository-actions.test.tsx` "posts the registry identifier, never a label composed from the parts". Composing it is the defect backend issue [#54](https://github.com/Evirion/evirion-engineering-memory/issues/54) found underneath the missing catalogue |
| 3.3 | Nothing the organization may no longer name is offered | covered | `tests/unit/repositories/presentation.test.ts` "offers only what the organization may still name"; `tests/component/repositories/repository-actions.test.tsx` "offers nothing the organization may no longer name" |
| 3.4 | An existing consent prefills as a checked choice | covered | `tests/component/repositories/repository-actions.test.tsx` "prefills an existing consent by checking what it already names" |
| 3.5 | Validation is the catalogue **and** the contract pattern, not one instead of the other | covered | `tests/unit/repositories/consent-fields.test.ts` "refuses a profile the organization is not offered" and "still refuses a malformed profile the catalogue happens to contain". The second offers a malformed identifier on purpose so the pattern is the only thing that can refuse it |
| 3.6 | An unoffered profile is refused by the BFF, not merely hidden | covered | `tests/e2e/repository-commands.spec.ts` "refuses a profile the organization is not offered" injects the value the form cannot express and submits it through the real browser path |
| 3.7 | An unreadable catalogue withholds the form rather than falling back to free text | covered | `tests/component/repositories/repository-actions.test.tsx` "withholds the form entirely when the catalogue cannot be read"; `tests/e2e/repository-commands.spec.ts` "withholds the consent form when the catalogue cannot be read" |
| 3.8 | An unreadable catalogue records no consent at all | covered | `tests/e2e/repository-commands.spec.ts` "records no consent at all while the catalogue cannot be read" crafts the submission the withheld form will not make and asserts `DEPENDENCY_UNAVAILABLE` with no consent recorded. An unreadable catalogue is not an empty one |
| 3.9 | An empty catalogue is a fact, not a failure | covered | `tests/component/repositories/repository-actions.test.tsx` "states plainly when nothing is offered, rather than showing an empty form" |
| 3.10 | A consent naming a withdrawn profile renders as its own state | covered | `tests/component/repositories/repository-detail.test.tsx` "renders a withdrawn profile a live consent names as its own state"; `tests/e2e/repository-commands.spec.ts` "shows a withdrawn profile a live consent names as its own state". It renders no control, because the customer cannot resolve it |
| 3.11 | That state is scoped to the repository whose consent names it | covered | `namedByActiveConsent` is organization-wide, so filtering on it alone reported one repository's withdrawal on every other repository's page. `tests/unit/repositories/presentation.test.ts` "says nothing about a withdrawal this repository's consent does not name" and the matching component test. Found by the full-diff self-audit |
| 3.12 | An unreadable catalogue asserts nothing about withdrawals | covered | `tests/component/repositories/repository-detail.test.tsx` "says nothing about profiles when the catalogue cannot be read". Absence of evidence is not evidence a profile was withdrawn |
| 3.13 | One idempotency key per rendered form | covered | Unchanged from EEM-9/03. `mintIdempotencyKeys` in `page.tsx`; `tests/e2e/repository-commands.spec.ts` replay assertions |
| 3.14 | `expectedVersion` travels in the body, never as a header | covered | Unchanged. `tests/unit/repositories/adapter.test.ts` |
| 3.15 | Success is claimed only from a committed receipt | covered | Unchanged. `finishRepositoryCommand`; `tests/unit/repositories/command-outcome.test.ts` |
| 3.16 | Retryability is never derived locally | covered | Unchanged. `mapConsoleError` copies the backend's `retryable`; the mutation notice never restates it |
| 3.17 | The catalogue is gated on the capability that writes the consent | partial | The contract gates `listOrganizationModelProfiles` on `repository.policy.manage` and the stub refuses a viewer with `CAPABILITY_REQUIRED`. The Console renders no consent control for a viewer regardless, asserted in `tests/component/repositories/repository-actions.test.tsx`. Live per-role enforcement is `EEM-9/07` |

## Carried, not answered

| Open decision | Status | Effect here |
|---|---|---|
| 1, the accessibility ruleset, tags and threshold | carried | Ships the ruleset-independent assertions only: every counter carries a text label and value rather than colour alone, the checkbox group is a labelled `fieldset` with a `legend`, and each new block is reachable by role. The configured axe gate still cannot be written. `NFR-ACC-001` names `I01-C` as primary owner and it is due before EEM-9/07 |
| 3, wording for the four confusable terms | carried | All new text is neutral and contract-derived, not approved product copy. Tests assert separateness and structure rather than these words, so approved copy lands without invalidating a row |
| 4, the list primitive | carried | The counters use a definition list and the catalogue a checkbox group, both chosen for the states they must express rather than as an answer. A design decision replaces them without changing behaviour |
| 5, loading and error treatment | carried | The two new unavailable blocks reuse the EEM-9/03 inline treatment. Skeleton versus spinner and banner versus inline remain open |
| 2, copy for the published error codes | carried | `MODEL_PROFILE_NOT_OFFERED` has a reviewed treatment and no approved copy, exactly as the other thirty-eight |

## Independent review

One bounded wave ran against the final tree: a security reviewer and a
correctness reviewer in parallel. The security reviewer found nothing at medium
severity or above; the correctness reviewer found no defects. No remediation
followed, so no confirmation re-review was required.

The security reviewer left one item below its own reporting bar: the BFF does
not assert that `overview.repositoryId` equals the requested identifier, nor
that `catalogue.organizationId` equals the caller's scope. It is not actionable
here. Reaching it requires the backend itself to answer with another tenant's
document rather than anything a peer tenant can drive, and it is inert on this
surface because the counters block renders only `asOf` and the numbers, never
the overview's own identity fields. It is recorded as a hardening candidate for
whichever subtask next adds a BFF read, not as a finding against this one.

## Deployment and release state

Implemented and locally verified. Not merged, not deployed, not observed, not
staging-certified, not paid-certified, not production-certified.

Final gate evidence, all from this tree: lint, format, `tsc --noEmit`, 613
Vitest tests, a production build, 127 Playwright tests, 98 Python tests, the
Console contract lock, the authority package, the documentation tree, backend
Auth parity at `2458f333`, Semgrep with 0 findings on 107 files, and
digest-verified Gitleaks over 47 commits with no leaks.

No provider was called, no paid operation was authorized, no worker ran, no
hosted Supabase setting was read or changed, and nothing was deployed. The only
network use was downloading two published release assets and the pinned cosign
binary; the signature verification itself ran with networking disabled.

`SEC-2026-012` remains open under its approved GitHub Free bootstrap waiver and
remains readiness blocking. Technical Design Partner Ready remains false.

## One consequence for the reader to decide

Consuming this release moved the Dashboard authority `packageSha256`. Whether a
paired backend successor pointer follows is an owner decision taken on that
value, and it is not assumed here.
