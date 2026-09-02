# Console UI conventions

## This document is subordinate to the pinned authority

The controlling document is the
[EEM-9 plan](../plans/active/eem-9-design-partner-console-dashboard-and-certification.md)
at the Dashboard commit pinned by the backend stable pointer. Its scope,
exclusions, acceptance rows and merge ordering win over anything here. This
document adds the UI detail that plan deliberately leaves open; it never
restates or overrides it.

The plan is a frozen manifest member. Do not edit it to add UI detail. Doing so
moves `packageSha256` and puts the Dashboard tree out of step with the backend
pointer, which the pointer forbids. Changing it requires an explicitly reviewed
successor pointer and a paired backend pull request.

## Verifying the pinned authority

Before starting any EEM-9 task, verify the pointer from the backend repository:

```bash
uv run --frozen --project services/model-orchestration python -m \
  model_orchestration.security.dashboard_authority_pointer \
  --dashboard-repository ../evirion-engineering-memory-dashboard
```

It prints the pinned Dashboard commit and authority `packageSha256`. Both must
match the values the backend pointer records. The pointer reads the pinned
commit rather than Dashboard `main`, so it keeps verifying after later Dashboard
work moves the digest.

## Working-tree and authority-package rules

`scripts/check_authority.py` walks the filesystem with `rglob("*")`, not git, and
raises `unlisted authority files` for anything that is neither in the authority
package nor in the reviewed non-package allowlist. An untracked scratch file
breaks the local authority check. Excluded directories are only `.git`, `.idea`,
`.next`, `__pycache__`, `coverage`, `dist`, `node_modules`, `playwright-report`
and `test-results`.

Console application source is tracked but deliberately outside the authority
package, enumerated in `docs/authority/non-package-paths.json`. Every tracked
file belongs to exactly one side: a path in both lists fails, a path in neither
still fails, and an allowlist pattern matching nothing fails. Add an allowlist
entry in the same reviewed commit as the files it covers. The rationale is
[ADR-0003](../decisions/0003-application-source-boundary-and-route-contract.md).

## Open decisions, with owners

These are unresolved. Do not invent an answer; carry the TODO and ask.

| # | Decision | Owner | Blocks |
|---|---|---|---|
| 1 | Accessibility level. The plan and requirements say only "accessibility checks", with no WCAG level and no axe ruleset, while security names ASVS v5.0.0 Level 2 explicitly | product owner | every a11y gate in /02–/06 |
| 2 | Customer-facing copy for the 38 published error codes | product owner | [the error vocabulary](#published-error-vocabulary-and-its-ui-treatment) |
| 3 | Customer-facing wording for the four confusable terms: source work, customer consent, operational authorization, paid execution | product owner | /03, /04, /06 |
| 4 | List primitive: table or card, filter placement, pagination control | design | the four list surfaces |
| 5 | Loading and error treatment: skeleton or spinner, banner or toast, inline or page level | design | every screen |
| 6 | Whether `/repositories/:repositoryId` shows EEM-9/06 repository counters inside an EEM-9/03 page, and who owns that block | product owner | /03 and /06 boundary |

Decision 1 has a partial answer that does not close it. `AGENTS.md` already
fixes WCAG 2.2 AA as target behavior for every owned journey, so the target is
not open. What remains open is the axe ruleset, the tag selection and the pass
threshold, which is what an executable gate needs. Record the dependency rather
than choosing a configuration.

## Routes, ownership and applicable states

Thirteen App Router paths were frozen by EEM-9/01 from requirements Section 10.
They may not be renamed, and none may be added. Same-origin BFF `api` routes sit
beside them. The machine-readable form, including routes declared outside the
freeze, is `console-route-inventory.json`, which
`tests/test_bootstrap_contract.py` checks against the URLs the App Router
actually resolves.

### Ownership

| Route | Owner | Surface |
|---|---|---|
| `/auth/*` | /02 | Sign-in, email-OTP, invite acceptance, TOTP enrolment and challenge, logout |
| `/onboarding` | /02 | Onboarding entry after first successful sign-in |
| `/settings/sessions` | /02 | Active application-session inventory. A reviewed fourteenth path, declared rather than frozen; see ADR-0003 |
| `/repositories` | /03 | Accessible and entitled repository list, capacity and slot state |
| `/repositories/:repositoryId` | /03 | Repository detail, access versus entitlement versus policy, activation, change request, allowed policy controls. **Open decision 6**: whether /06 repository counters appear here |
| `/repositories/:repositoryId/import` | /04 | Historical import range, prepare and consent, authorization wait, progress, terminal outcome, cost completeness |
| `/repositories/:repositoryId/memory` | /05 | Repository-scoped memory queue |
| `/memory` | /05 | Organization-wide memory queue, filters, pagination |
| `/memory/:knowledgeObjectId` | /05 | Knowledge detail, evidence, review history and actions, lifecycle, supersession, correction-request status |
| `/repositories/:repositoryId/pull-requests/:prNumber` | /06 | Pull request detail |
| `/processing` | /06 | Processing activity list and detail, the sole generic `PROC-002` Retry, Resume and Support call to action |
| `/settings/members` | /06 | Members, invitations, capability surfaces |
| `/settings/github` | /06 | GitHub installation status and freshness, offboarding request and status |
| `/settings/usage` | /06 | Usage, distinct cost states, consistent-cutoff metrics |

`/` is a declared root entry owned by /02. It carries no customer data: the
bootstrap renders an unauthenticated shell and the Auth phase replaces it with a
server-side redirect to the authorized destination.

A route group in parentheses contributes no URL segment. `(auth)/sign-in`
resolves to `/sign-in`, not `/auth/sign-in`, and that failure is silent because
the page still renders. Routes that share a URL prefix use a real directory
segment with a nested layout; a group is only for sharing a layout across
routes that share no prefix.

### Applicable states

`Y` means the state is reachable and must be implemented. `-` means the contract
cannot produce it. `forbidden` covers forbidden and not-found together, because
the backend deliberately refuses a foreign resource without disclosing whether
it exists.

| Route | loading | empty | available | forbidden | conflict | retryable | non-retryable | unknown |
|---|---|---|---|---|---|---|---|---|
| `/auth/*` | Y | - | Y | Y | Y | Y | Y | Y |
| `/onboarding` | Y | Y | Y | Y | - | Y | Y | Y |
| `/settings/sessions` | Y | - | Y | Y | Y | Y | Y | Y |
| `/repositories` | Y | Y | Y | Y | Y | Y | Y | Y |
| `/repositories/:repositoryId` | Y | - | Y | Y | Y | Y | Y | Y |
| `/repositories/:repositoryId/import` | Y | Y | Y | Y | Y | Y | Y | Y |
| `/repositories/:repositoryId/memory` | Y | Y | Y | Y | - | Y | Y | Y |
| `/memory` | Y | Y | Y | Y | - | Y | Y | Y |
| `/memory/:knowledgeObjectId` | Y | - | Y | Y | Y | Y | Y | Y |
| `/repositories/:repositoryId/pull-requests/:prNumber` | Y | - | Y | Y | - | Y | Y | Y |
| `/processing` | Y | Y | Y | Y | - | Y | Y | Y |
| `/settings/members` | Y | Y | Y | Y | Y | Y | Y | Y |
| `/settings/github` | Y | Y | Y | Y | Y | Y | Y | Y |
| `/settings/usage` | Y | Y | Y | Y | - | Y | Y | Y |

Notes on the `-` cells, so they are not read as oversights:

- `empty` is absent on detail routes, because a detail route with no resource is
  `forbidden`, not empty. `/settings/sessions` always has at least the current
  session, so it cannot be empty either.
- `conflict` is absent where the route issues no optimistic-version mutation.
  Read-only surfaces cannot produce a stale version.
- `unknown` is never absent. Every route must fail closed on an unsupported
  server response rather than rendering a partial document.

### The two waits that must look different

`/repositories/:repositoryId/import` has two distinct waiting states and the
plan forbids conflating them:

- **waiting for customer consent** — the customer has an action to take;
- **waiting for Evirion operational authorization** — the customer has no action
  and must not be offered one.

A customer consent action never satisfies operational authorization. Rendering
one progress treatment for both is a Definition-of-Done failure for /04.

### Three orthogonal repository states

`/repositories` and `/repositories/:repositoryId` show three independent axes
that must not read as one status:

- **access** — whether GitHub still exposes the repository to the installation;
- **entitlement** — whether Evirion has activated a slot for it;
- **policy** — `OFF`, `SOURCE_ONLY` or `AUTO_EXTRACT`.

A repository can be GitHub-accessible and not entitled, entitled and locked by
an operator, or entitled with policy `OFF`. The UI never selects entitlement
source, capacity, replacement mode, generation or operator decision.

## Per-subtask UI detail

What the pinned EEM-9 plan settles, and what it leaves to be decided. Each
section adds only the UI detail the plan omits. Its Scope, Exclusions and
Definition-of-Done rows remain controlling.

The plan's depth is uneven and deliberately so: EEM-9/02 carries 33
Definition-of-Done rows because it owns the authentication boundary, while
/03–/06 carry seven or eight each. That is right for security risk and inverted
for product risk, which is why /05 and /06 need the most added here.

### EEM-9/02 — Auth shell

**The plan is complete on this task.** Do not add UI requirements; add the shell
contract every later task inherits.

Three shell behaviours are load-bearing and are stated as UI instructions
because /03–/06 depend on them:

- **Navigation is a reflection, never an authorization.** Hiding a link is a
  convenience. The backend refuses regardless, and every later task must render
  the refusal path even for a control it also hides.
- **Organization selection is opaque before authentication.** Zero, one and many
  invitations are three different screens. There is no order-based
  auto-selection, and no organization name, slug or count leaks before the
  session exists.
- **The capability matrix has four roles**: Owner, Admin, Reviewer, which is the
  database role `member`, and Viewer. Every later task inherits this vocabulary.
  Reviewer and `member` are the same principal under two names; use one term in
  UI copy and never both.

### EEM-9/03 — Repository control

**Missing from the plan: how three independent axes read in one row.** See
[the three orthogonal axes](#three-orthogonal-repository-states).

The failure mode is a single status chip. Access, entitlement and policy are
orthogonal, so a repository can be GitHub-accessible and not entitled, entitled
and operator-locked, or entitled with policy `OFF`. Collapsing them into one
label makes an unresolvable support question.

- Each axis needs its own visual slot. **TODO, design**: whether that is three
  chips, a chip plus two columns, or a status column plus a detail popover.
- **Operator-managed and locked are not error states.** They are legitimate
  states with no customer action. Do not render them as a failure.
- The UI never selects entitlement source, capacity, replacement mode,
  generation or operator decision. Those come from the backend or not at all.
- A one-slot race and a disable race refresh from the backend. There is no
  optimistic local authority over capacity.
- **TODO, product**: exact wording distinguishing source work, customer consent,
  operational authorization and paid execution. Shared with /04 and /06.

### EEM-9/04 — Import operations

**Missing from the plan: how the two waits differ visually.** See
[the two waits](#the-two-waits-that-must-look-different) for why conflating them
is a Definition-of-Done failure.

Six authorization states must be distinguishable, and only one of them gives the
customer something to do:

| State | Customer action |
|---|---|
| `NOT_REQUIRED` | none, proceed |
| waiting for customer consent | **yes, this is the only actionable one** |
| waiting for Evirion operational authorization | none, and offer none |
| authorized | none, proceed |
| expired | re-request |
| revoked | none, explain |

- **TODO, design**: the treatment that separates "we are waiting for you" from
  "we are waiting for us". A shared spinner for both is the defect.
- Progress reports processed, accepted, rejected, quarantined and failed as five
  distinct counts. Rejected and quarantined are legitimate machine outcomes, not
  infrastructure failures, and never render as Knowledge Objects.
- **No generic Retry control.** Import recovery exists only where the EEM-7
  import projection declares it. Response-loss replay reuses the exact
  idempotency key and body. The generic `PROC-002` Retry belongs to /06.
- Polling is bounded and stops on a terminal state or when the page is inactive.

### EEM-9/05 — Memory review and lifecycle

**Missing from the plan: everything about how original and edited sit together.**
The plan's only visual requirement in the entire document is one sentence:
"original versus edited value/evidence is visually and semantically distinct".

The semantics are fixed by the backend and are not a design choice:

- **The edit is a derivative, not a replacement.** `originalPayload` remains the
  machine extraction whatever a reviewer did. Both must stay reachable on the
  same screen; the original is never overwritten, hidden behind a destructive
  action, or presented as a previous version to be discarded.
- **`humanEdited` is a backend fact.** It comes from the effective review being
  `EDITED`. The UI never infers it by comparing payloads.
- **Review history is append-only.** Render it as a timeline, not an editable
  log. There is no delete and no amend.
- **`PENDING` is review sequence 0**, a derived state and not a stored one. An
  object with no review is pending, not unknown.
- Lifecycle and review are two separate axes. An object can be reviewed and
  unresolved, or active and later re-reviewed. Do not merge them into one status.
- Every action forwards its exact optimistic version set — review sequence,
  lifecycle version, relation version, request version — with no local synthesis.
- **TODO, design**: side-by-side, diff, or toggle for original versus edited, and
  the same decision for evidence. Whatever is chosen must survive a payload with
  thirteen editable fields.

### EEM-9/06 — Processing, settings and metrics

**Missing from the plan: the positive form of the cost rule.** The plan states
the prohibition — unresolved or unknown cost is never rendered as zero or as
invoice authority — and never says what to render instead.

The four cost states are disjoint by construction, derived from a stored status
rather than inferred from an amount:

| State | Meaning | Must not look like |
|---|---|---|
| `MEASURED` | settled, the amount is real | anything provisional |
| `RESERVED` | budget held, not yet settled | a measured amount |
| `UNRESOLVED` | an amount exists but is not attributable | zero, or measured |
| `NOT_APPLICABLE` | no contributing job at all | zero |

- All four need distinct treatments. **TODO, design**: what each looks like.
- A zero denominator returns `null` with `NOT_APPLICABLE`, never `0`. An empty
  dash is ambiguous with zero and is not acceptable on its own.
- A rollup takes the worst state present: `UNRESOLVED` beats `RESERVED` beats
  `MEASURED` beats `NOT_APPLICABLE`. Reserved and unresolved amounts travel
  beside the measured one as separate named figures, never summed into it.
- **The `asOf` contract is visible, not internal.** A document re-queried at one
  `asOf` is internally consistent, and a later review or lifecycle event cannot
  move it. Cost settlement is the one exception the contract allows: it stays
  attributed to the execution's first terminal period, so a later `asOf` updates
  that original period's figure. The UI shows the `asOf` it rendered, because
  two figures taken at different cutoffs are not comparable.
- `/processing` carries the **sole** generic `PROC-002` Retry, Resume and Support
  call to action in the whole Console. Retryability comes from the backend
  projection and is never derived in the client.
- Member and offboarding controls render only backend capabilities and states.
  No customer route executes operator offboarding or paid authorization.
- **TODO, product**: whether `/repositories/:repositoryId` shows repository
  counters owned by this task inside a page owned by /03.

## The nine states are mandatory, not aspirational

Every page implements the states applicable to its contract: loading, empty,
available, forbidden/not-found, conflict/stale, retryable, non-retryable and
unknown. Discriminated unions are handled exhaustively with a compile-time
`never` check and a runtime fail-closed unsupported-state response.

"Applicable to its contract" is decided per route in
[the applicable-states table](#applicable-states), not per developer.

## What must never render

These are absolute. Each one is a Definition-of-Done row somewhere in /02–/06.

- an unavailable, unresolved or unknown aggregate as `0`;
- `REJECTED` or `QUARANTINED` as a trusted Knowledge Object;
- a cost figure as invoice authority;
- hidden navigation treated as authorization: the backend decides, the UI
  reflects;
- an approve, retry or activate control that the backend capability does not
  permit;
- any service-role key, DSN, GitHub token or private key, provider key, raw
  model response, Source Envelope body, or operator credential, in DOM,
  telemetry, cache, errors or source maps.

## Ownership boundaries that are easy to violate

The plan assigns these deliberately. Reproducing a pattern across tasks breaks
them.

- The generic processing-job `PROC-002` Retry, Resume and Support call to action
  belongs to **/06 only**. `/04` must not render it; `/04` recovery exists only
  when the EEM-7 import projection declares it, and response-loss replay reuses
  the exact command receipt.
- Member, settings and offboarding surfaces belong to **/06**, not /03.
  `/settings/sessions` is the exception: it is the principal's own session
  inventory, owned by /02, and it exposes no member roster.
- Review and lifecycle actions belong to **/05**, not /06.
- Customer consent is never converted into Evirion operational authorization.
  They are two different waits and must look different.

## Browser to BFF to backend

Domain components never call Supabase or the backend directly. Everything goes
through a same-origin BFF route or server action.

The BFF may aggregate customer-safe reads. It may not use a service-role key or
DSN, authorize from caller-supplied role, organization or capability data, read
or write `core`, hold GitHub or provider secrets, inspect raw Source Envelopes
or model responses, call a provider, mint worker claims, or turn a customer
consent action into operational authorization.

Mutations forward the caller token, a canonical `Idempotency-Key`, the exact
`expected_*_version` set and a bounded correlation ID. Optimistic versions come
from the backend and are forwarded unchanged; the UI never synthesises one.

Success is claimed only from a committed receipt or projection, never from a
pending request. After success, revalidate the exact organization resource.

## Published error vocabulary and its UI treatment

The backend publishes exactly 38 stable codes in
`contracts/console/v1/schemas/error.json`. The BFF maps a stable code to safe UI
copy and status. It never forwards a raw SQL, Supabase, GitHub, worker or
provider error, and it never invents a code.

Regenerate this inventory rather than editing it by hand when the contract
digest moves:

```bash
python3 -c "
import json, pathlib
root = 'vendor/console-contract-v1.0/contracts/console/v1/schemas/error.json'
d = json.loads(pathlib.Path(root).read_text())
def find(o):
    if isinstance(o, dict):
        for k, v in o.items():
            if k == 'enum' and isinstance(v, list): return v
            r = find(v)
            if r: return r
    elif isinstance(o, list):
        for i in o:
            r = find(i)
            if r: return r
print('\n'.join(find(d) or []))
"
```

### Open decision 2: the copy column is unwritten

Nobody has decided the customer-facing wording. The treatment column below is a
**proposal** derived from what each code means; the copy itself is a product
decision and is deliberately left as TODO. Do not ship invented copy.

Until it is answered, an unmapped code falls to the `unknown` state and fails
closed. That is correct behaviour, not a placeholder.

### Treatment groups

Codes are grouped by what the customer can do about them, which is what decides
the UI, not by HTTP status.

#### The customer must sign in or is not permitted

The action is unavailable, and the control should not have been rendered.
Reaching one of these means the UI trusted its own state instead of the backend.

| Code | Treatment | Copy |
|---|---|---|
| `AUTHENTICATION_REQUIRED` | redirect to `/auth/sign-in`, no open redirect | TODO |
| `ORGANIZATION_MEMBERSHIP_REQUIRED` | organization switcher, never disclose the resource | TODO |
| `CAPABILITY_REQUIRED` | omit the control; if reached, page-level refusal | TODO |
| `RESOURCE_NOT_FOUND` | same treatment as forbidden, no existence disclosure | TODO |

#### The state moved under the customer

Reload the committed projection and require a deliberate resubmit. Never auto
retry: that would resubmit against a state the customer has not seen.

| Code | Treatment | Copy |
|---|---|---|
| `VERSION_CONFLICT` | reload, show what changed, resubmit | TODO |
| `REVIEW_VERSION_CONFLICT` | reload the review, resubmit | TODO |
| `LIFECYCLE_VERSION_CONFLICT` | reload the lifecycle, resubmit | TODO |
| `ENTITLEMENT_GENERATION_STALE` | reload the repository, resubmit | TODO |
| `REPOSITORY_ACCESS_CHANGED` | reload, explain the GitHub-side change | TODO |
| `INVITATION_STATE_CONFLICT` | reload the invitation | TODO |
| `ORGANIZATION_CONTROL_CONFLICT` | reload, operator-managed state | TODO |

#### The action is not available in this state

A refusal that is correct and final for now. Explain the state, do not offer a
retry.

| Code | Treatment | Copy |
|---|---|---|
| `REPOSITORY_NOT_ENTITLED` | inline, link to activation | TODO |
| `REPOSITORY_LIMIT_REACHED` | inline, explain capacity | TODO |
| `REPOSITORY_REPLACEMENT_REQUIRES_OPERATOR` | inline, no customer control | TODO |
| `ORGANIZATION_LIMIT_NOT_PROVISIONED` | page level, contact path | TODO |
| `BACKFILL_NOT_APPROVABLE` | inline on the approve control | TODO |
| `KNOWLEDGE_ACTION_NOT_ALLOWED` | inline on the action | TODO |
| `SUPERSESSION_INVALID` | inline, explain the rejected edge | TODO |
| `SUPERSESSION_TRAVERSAL_LIMIT` | inline, bounded chain | TODO |
| `GITHUB_SYNC_INCOMPLETE` | inline, sync in progress | TODO |
| `REPOSITORY_IMPORT_FILTERS_INVALID` | field level | TODO |
| `REPOSITORY_IMPORT_JOB_NOT_RETRYABLE` | inline, no Retry control | TODO |
| `REPOSITORY_IMPORT_NOT_CANCELLABLE` | inline | TODO |
| `REPOSITORY_IMPORT_NOT_RESUMABLE` | inline | TODO |
| `REPOSITORY_IMPORT_NOT_PAUSABLE` | inline | TODO |
| `REPOSITORY_IMPORT_NOT_APPROVABLE` | inline | TODO |
| `REPOSITORY_IMPORT_ALREADY_ACTIVE` | inline, link to the active run | TODO |
| `REPOSITORY_IMPORT_NOT_FOUND` | forbidden treatment | TODO |

#### Authorization the customer cannot grant

The distinction that must survive into the copy: the customer's own consent does
not satisfy Evirion operational authorization. Offer no action.

| Code | Treatment | Copy |
|---|---|---|
| `NEW_MODEL_CALL_NOT_AUTHORIZED` | waiting state, no customer action | TODO |
| `PAID_OPERATION_NOT_AUTHORIZED` | waiting state, no customer action | TODO |

#### The outcome is genuinely unknown

Never render as success or as failure, and never auto retry. Observe before
retrying is the backend's own rule and the UI must not undercut it.

| Code | Treatment | Copy |
|---|---|---|
| `PROVIDER_OUTCOME_UNKNOWN` | explicit unknown state, refresh only | TODO |
| `UNSUPPORTED_SERVER_RESPONSE` | fail closed, unknown state | TODO |

#### Transport and infrastructure

| Code | Treatment | Copy |
|---|---|---|
| `IDEMPOTENCY_KEY_REUSED` | same key with a different body: show the conflict, no side effect | TODO |
| `RATE_LIMITED` | bounded backoff, show the wait | TODO |
| `REQUEST_INVALID` | field level where derivable, else form level | TODO |
| `REQUEST_TOO_LARGE` | field level | TODO |
| `DEPENDENCY_UNAVAILABLE` | retryable, bounded | TODO |
| `INTERNAL_ERROR` | non-retryable, correlation ID visible for support | TODO |

### Two rules that outrank the copy

**A duplicate submission with the same key and the same body returns the stored
receipt and is a success, not an error.** Only a same-key different-payload
request is a conflict. The UI must not show an error for the first case.

**A retry control appears only when the backend projection declares the work
retryable.** The UI never derives retryability. The generic processing-job
`PROC-002` Retry, Resume and Support call to action exists on `/processing`
only, owned by EEM-9/06; `/04` must not render it.

## Implementation

The `front-end-cursor-rules` rule governs code style and is auto-attached on
`.ts` and `.tsx`. Its no-semicolon and Tailwind-only requirements are enforced
by the committed Prettier and ESLint configuration rather than left to the
author. Shadcn on Tailwind with Radix primitives is the component baseline.

Its Conventional Commits section does not apply to EEM-9/02 phase commits, whose
subjects are fixed verbatim by the accepted implementation plan.

Two repository rules reinforce plan requirements rather than competing with
them: keep imports at the top of the module, and give every switch over a
discriminated union a `never` default so a new variant fails at compile time.

Generated contract code under `generated/console-contract/` is digest-pinned
authority. It is excluded from every formatter and linter write path, and CI
reproduces it and fails on any diff.

## Verification before claiming a screen is done

1. Component and unit tests for every applicable state in
   [the applicable-states table](#applicable-states).
2. Playwright for the journey, including the negative cases: cross-tenant
   substitution through a direct BFF call, a stale optimistic version, a
   duplicate click, and a lost response replayed with the same idempotency key.
3. Accessibility snapshot against WCAG 2.2 AA target behavior. Record the exact
   ruleset once open decision 1 is answered.
4. Confirm no sensitive value reaches DOM, telemetry, cache, errors or source
   maps.
5. Confirm the contract lock still verifies and the authority package still
   passes.
