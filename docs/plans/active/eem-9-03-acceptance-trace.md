# EEM-9/03 acceptance trace

Every Definition-of-Done row from the EEM-9/03 section of the controlling
[EEM-9 plan](eem-9-design-partner-console-dashboard-and-certification.md) maps
here to a named executable test or to an explicit reason it is not this
subtask's to satisfy. A link is not evidence; a row with no test and no owner
elsewhere is a gap, and the two that exist are recorded as gaps rather than
quietly claimed.

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
| 1 | No GitHub token, private key or setup-state secret reaches the browser or a log | partial | No App key, client secret or installation token exists in this process: the Console only asks the backend for a setup intent, and `tests/security/repository-boundary.spec.ts` asserts no caller token or secret-shaped value reaches the document. The one-time state necessarily transits the browser, because that is what the handoff is; `tests/unit/repositories/github-redirect.test.ts` proves it is the only caller-influenced part of the destination and that a non-nonce is refused. Nothing in this repository logs it, and `Referrer-Policy: same-origin` keeps the Console URL out of the request GitHub receives. Deployed log inspection is `EEM-9/07` |
| 2 | Cross-tenant repository, installation, setup-intent and direct-action substitution return the bounded foreign or missing response without existence disclosure | covered | `tests/security/repository-boundary.spec.ts` asserts a foreign repository and an absent one produce identical bytes, that a malformed identifier is refused without a backend call, and that a direct BFF read for another organization is refused; `tests/unit/repositories/adapter.test.ts` proves a traversal-shaped identifier never reaches the transport |
| 3 | The UI cannot select entitlement source, capacity, replacement mode, generation or operator decision | covered | `tests/unit/repositories/presentation.test.ts` asserts controls follow backend capability and replacement mode rather than choosing them; `tests/component/repositories/repository-detail.test.tsx` asserts the entitlement facts render no input or select; `tests/unit/repositories/adapter.test.ts` shows the request bodies carry no source, capacity or mode field |
| 4 | One-slot and disable race responses refresh from the backend rather than from optimistic local authority | covered | `tests/e2e/repository-commands.spec.ts` proves the second of two activations is refused with `REPOSITORY_LIMIT_REACHED` decided by the backend, and that a two-tab stale version is refused with `VERSION_CONFLICT` while the committed state is the other tab's. No success is claimed before a receipt: `tests/unit/repositories/command-outcome.test.ts` |
| 5 | Duplicate commands, stale versions and every documented access x entitlement x policy state have exhaustive component, API and Playwright mappings | covered | Duplicate and stale: `tests/e2e/repository-commands.spec.ts`. All eight published product states: `tests/contract/console-stub-fixtures.test.ts` fails if one has no fixture, `tests/unit/repositories/presentation.test.ts` labels each, `tests/component/repositories/repository-list.test.tsx` renders each, `tests/e2e/repositories.spec.ts` walks them in the browser |
| 6 | Policy copy clearly distinguishes source work, customer consent, operational authorization and paid execution | partial | The four are separate, separately labelled and separately attributed, asserted by `tests/unit/repositories/presentation.test.ts`, `tests/component/repositories/repository-detail.test.tsx` and `tests/e2e/repositories.spec.ts`. The wording is neutral text derived from the accepted requirements and is explicitly not approved product copy: open decision 3 is unresolved. The tests assert separateness rather than these words, so approved copy lands without invalidating this row |
| 7 | C03 journeys and requirements pass component, Playwright and accessibility coverage | partial | Component and Playwright are covered by the suites above. Accessibility ships the ruleset-independent assertions `NFR-ACC-001` names — every axis carries a text value rather than colour alone, every control has an accessible name, and each surface is reachable by role — asserted throughout the component and browser suites. The configured axe gate cannot be written until open decision 1 answers the ruleset, tags and threshold; `NFR-ACC-001` names `I01-C` as primary owner |

## Requirement ownership from the task reading map

| Requirement | Status | Evidence or owner |
|---|---|---|
| `GH-001` connect the existing GitHub App | partial | `tests/e2e/github-connection.spec.ts` proves the handoff carries a one-time state and nothing else, and `tests/unit/repositories/github-redirect.test.ts` proves the destination comes from configuration. Signed-state validation, single use and installation resolution are backend `EEM-6/03`; the live binding is `EEM-9/07` |
| `GH-002` existing installation detection | covered | `tests/e2e/github-connection.spec.ts` renders connected, not connected and suspended distinctly, and offers Reconnect rather than a second connection |
| `GH-003` accessible repository synchronization | covered | `tests/e2e/github-connection.spec.ts` proves a queued run returns a receipt rather than a traversal, that a running traversal states the inventory is the last complete one, and that no repository is dropped while it runs |
| `GH-004` installation lifecycle freshness | partial | The Console renders suspended and removed as blocking new source work, asserted in `tests/e2e/github-connection.spec.ts`. Lifecycle events, freshness windows and fail-closed source claims are backend `EEM-6/03` |
| `ENT-001` distinct entitlement | covered | `tests/unit/repositories/presentation.test.ts` keeps entitlement separate from access and from policy, including a GitHub-accessible repository that stays locked |
| `ENT-002` organization repository limit | covered | `tests/unit/repositories/presentation.test.ts` for fixed, unlimited and unprovisioned; `tests/e2e/repository-commands.spec.ts` for the server-side limit under concurrency |
| `ENT-003` idempotent activation | covered | `tests/e2e/repository-commands.spec.ts` proves same key and same body replays the receipt, and only a same key with a different body conflicts |
| `ENT-004` controlled disable | covered | `tests/component/repositories/repository-actions.test.tsx` and `tests/e2e/repository-commands.spec.ts`: disable only where replacement is self-service, and the surface states that history and usage are kept. Generation fencing of in-flight work is backend `EEM-6/01` |
| `ENT-005` anti-rotation | covered | `tests/e2e/repository-commands.spec.ts` proves limited Alpha offers a request rather than an unrestricted replacement, and that the request frees no slot |
| `ENT-006` entitlement source ownership | covered | `tests/component/repositories/repository-detail.test.tsx` renders source read-only; `tests/unit/repositories/adapter.test.ts` proves no request body carries a source field |
| `REPO-001` accessible versus active | covered | `tests/unit/repositories/presentation.test.ts` asserts `Available` never reads as `Active`; the three axes and the two separate counts are asserted in the component and browser suites |
| `REPO-002` activation confirmation | covered | `tests/component/repositories/repository-actions.test.tsx` asserts the four consequences verbatim as the requirement fixes them, and that confirmation is explicit; `tests/e2e/repository-commands.spec.ts` proves an unconfirmed activation is refused |
| `REPO-003` repository overview | owned elsewhere | The reading map assigns it to `EEM-9/06`. It is also contract-blocked; see the gap below |
| `REPO-004` repository processing policy | covered | `tests/component/repositories/repository-actions.test.tsx` and `tests/e2e/repository-commands.spec.ts`: capability, expected version and idempotency key on every mutation, `AUTO_EXTRACT` only through a complete consent, an incomplete consent refused, no live-envelope promotion action, and the explicit null consent that revokes future dispatch |
| `J-002` connect GitHub and discover repositories | covered | `tests/e2e/github-connection.spec.ts`, including that connecting creates no entitlement |
| `J-003` activate one repository | covered | `tests/e2e/repository-commands.spec.ts` |
| `J-009` reconnect, suspend or remove the installation | partial | `tests/e2e/github-connection.spec.ts` covers the customer-visible half. Atomic single-effective-installation selection and access tombstoning after a complete generation are backend `EEM-6/03` |
| `NFR-ACC-001` accessibility | partial | See Definition-of-Done row 7 |
| `SEC-WEB-001` access control | partial | `tests/security/repository-boundary.spec.ts` covers the repository surface. The full per-role matrix against live fixtures is `EEM-9/07` |

## Two gaps that are not this subtask's to close

### Open decision 6 is a contract gap, not only a product question

Whether `/repositories/:repositoryId` shows repository counters cannot be
answered by product alone. All 41 success responses in the contract reference
the bare `SuccessEnvelope`, whose `data` property carries no type or `$ref`, and
there is no `allOf` anywhere; binding an operation to a payload schema is an
adapter convention rather than something the contract derives. That convention
works for the repository surface because `repository.json` exists. It cannot
work for counters: there is no `repository-overview.json` among the eighteen
schemas and no `RepositoryOverview` among the eighteen generated types.

So the counters are unimplementable by `EEM-9/06` as well, not merely open here.
Answering "yes, show them" requires adding a schema to the contract, which is a
backend change and a new frozen digest. It is raised now so it is resolved
before `EEM-9/06` starts rather than rediscovered there. Rendering them from a
hand-written type was rejected: it would make the one surface with no contract
authority also the only surface rendering unvalidated backend data.

### No endpoint enumerates the allowed model profiles

`AUTO_EXTRACT` consent requires `allowedModelProfiles`, and the contract
publishes no operation that lists which profiles an organization may name. The
consent form prefills from an existing consent where one exists and otherwise
accepts the contract's own pattern, leaving the backend to refuse an unknown
profile. That is fail-closed and correct, but it is a poor first-time
experience and it belongs in the same contract conversation as the counters.

## Open decisions carried, not answered

- **Decision 1**, accessibility: `AGENTS.md` already fixes WCAG 2.2 AA as the
  target, so the target is not open. The axe ruleset, tag selection and pass
  threshold are, and that is what an executable gate needs. This subtask ships
  the ruleset-independent assertions and records the dependency.
- **Decision 3**, the wording for the four confusable terms. Blocks approved
  copy for Definition-of-Done row 6, not the structure it requires.
- **Decision 4**, the list primitive, filter placement and pagination control.
  The tests assert accessible names and per-axis text rather than the element,
  so a table or card decision changes no acceptance row.
- **Decision 5**, loading and error treatment. Loading is announced through a
  status role and failures render inline; the visual treatment is still open.
- **Decision 6**, repository counters, is contract-blocked as recorded above.

## Two defects in merged code that this subtask had to fix

Both were found against the running BFF, both are recorded in
`docs/CHANGELOG.md`, and both were changed only with the owner's explicit
agreement.

- **No native form post could ever succeed.** `Referrer-Policy: no-referrer`
  makes Chrome send `Origin: null` on a form navigation, and the mutation guard
  refuses that as an origin mismatch. `same-origin` still sends no referrer to
  any other origin, so nothing leaks off-origin and the exact-Origin check is
  unchanged. EEM-9/02 could not see it because its auth journey accepts either
  destination for anti-enumeration reasons.
- **`form-action 'self'` blocked the GitHub handoff.** Chrome applies the
  directive to the whole redirect chain, so a form posting same-origin and then
  redirected off-origin is refused. The directive now names the configured
  install origin and nothing else, asserted by
  `tests/unit/repositories/form-action-policy.test.ts`.

A third defect, the response envelope, was corrected in the separate
`EEM-9/02b` pull request that precedes this one.

## Independent review

One bounded review wave ran against this tree: a security reviewer and a
correctness reviewer in parallel.

The security reviewer found nothing at medium severity or above, and confirmed
each of the nine Console invariants against the changed code, including that
the caller token never leaves the server-only modules, that both header changes
are narrowly scoped with no other directive widened, that a crafted `?result=`
cannot print arbitrary text, and that `tools/console-stub/` is unreachable from
`src`. It noted below its threshold that a crafted `?result=applied` link can
show a misleading banner to the same signed-in user. That was considered and
left as it is: the banner's substantive claim, that the state below is the
committed one, is true on every render, the page re-reads that state from the
backend regardless of how it was reached, and the alternatives all add durable
server state to defend against a customer misleading only themselves.

The correctness reviewer found three defects, all accepted and all fixed in one
remediation wave.

- **A budget ceiling under a microdollar became the value the contract
  forbids.** `Number("0.0000001")` is positive, so it passed the local check,
  and `toFixed(6)` then produced exactly `0.000000`, which the consent schema
  refuses with `not: { const: "0.000000" }`. The backend would have rejected
  the body, so nothing unsafe could happen, but the Console was building a
  request the contract does not admit. Refused before the call now, and
  `tests/unit/repositories/consent-fields.test.ts` pins both edges.
- **A repeated model profile passed a schema requiring unique items.** It is
  refused rather than silently collapsed, because quietly editing the contents
  of a consent is exactly what a consent form must not do.
- **Change-request candidates came from one default page.** The detail read now
  asks for the contract maximum, and a remaining cursor is disclosed rather
  than a partial list being offered as though it were complete. Walking every
  cursor to render one page would be an unbounded read.

The self-audit before that wave closed three of its own findings: a component
naming its failure type from a server-only module, an unreachable branch in the
failure path, and an API double that did not store a GitHub projection against
its idempotency key.

## What this subtask does not claim

Implemented and locally verified only. Nothing is merged, deployed, observed,
staging-certified, paid-certified or production-certified. No real GitHub App
was connected, no GitHub API was called, no hosted Supabase setting was read or
changed, no worker ran, no provider was called and no paid operation was
authorized. The backend repository was read with `git show` at the pinned commit
and never modified. The browser harness maps GitHub to loopback so no test can
reach it.
