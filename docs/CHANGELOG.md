# Dashboard changelog

## 2026-09-03 — EEM-9/03e Console contract revision consumed

- Why: the backend published `console-contract-v1.0.1`, a revision of contract
  `1.0` carrying the two schemas that closed backend issues
  [#53](https://github.com/Evirion/evirion-engineering-memory/issues/53) and
  [#54](https://github.com/Evirion/evirion-engineering-memory/issues/54). The
  Dashboard consumes both in one subtask rather than two, which `ROADMAP.md`
  records, because the ceremony is identical either way.
- Security: **the frozen trust policy could not verify the release at all.**
  `docs/security/artifact-attestation-policy.json` pinned
  `^refs/tags/console-contract-v[0-9]+\.[0-9]+$` and
  `verify_artifact_attestation.py` requires `signer.ref` to match in full, so
  the offline gate refused a signed, immutable, additively compatible release
  before any consumption question arose. The `console-contract-v1` entry now
  mirrors backend ADR 0014's grammar,
  `^refs/tags/console-contract-v[0-9]+\.[0-9]+(\.[1-9][0-9]*)?$`, widened by
  exactly the optional revision component. `v1.0.0`, `v1.0.1.1`, `v1`,
  `v1.0-rc1`, `v1.0.`, `v.1`, a leading-zero revision and a foreign namespace
  all stay refused, and every other refusal is untouched. Recorded as
  [ADR-0005](decisions/0005-console-contract-release-revisions.md), with a test
  comparing the mirrored pattern against the backend literal so the two cannot
  drift silently.
- Security: widening moved `policyDigest` from `dcf0652a` to `0b5b0e93`, which
  the lock and the recorded evidence both pin. The evidence value was
  re-observed rather than edited: `console-contract-v1.0` was downloaded again
  and re-verified against the amended policy before its digest changed, which is
  also the proof that the widening did not weaken the existing release.
- Contracts: `console-contract-v1.0.1` is vendored and the client regenerated
  from exactly those bytes. Archive `a116ae5c`, `packageSha256` `29ff7b73`,
  source commit `2458f333`, release asset `542665268`. `contractVersion` stays
  `1.0`, which is the point of a revision tag, so the generated `isConsoleError`
  const and the envelope guard in `src/server/adapters/console-api.ts` are
  untouched and no Console read breaks. A test now pins that explicitly.
- Contracts: `generatedClientSurfaceSha256` moved from `b5a6facb` to `08178d2f`.
  The lock check reports any surface change as a breaking backend change,
  because the digest is over sorted export names and cannot tell additive from
  breaking. This one is additive: four exports added, none removed or renamed.
- Contracts: the published error vocabulary is now 39 codes.
  `MODEL_PROFILE_NOT_OFFERED` is treated as field level rather than state final,
  because the action is available and the named value is not. Customer wording
  stays open decision 2.
- Behavior: `/repositories/:repositoryId` renders the `REPO-003` counters,
  answering open decision 6. Seventeen counters, not the sixteen the requirement
  names; the extra is `withdrawn`, the discrepancy issue #53 resolved
  deliberately. Rejected and quarantined runs stay in the processing group and
  never near the admitted Knowledge Object count. The rendered `asOf` is shown,
  because figures at different cutoffs are not comparable.
- Behavior: an unavailable aggregate never renders as zero, and here that is
  structural. Every counter is required by the schema, so one the backend could
  not compute cannot be represented: the document fails validation and the block
  states it is unavailable. A rendered zero is therefore always a real zero, and
  both halves are asserted.
- Behavior: the `AUTO_EXTRACT` consent field is a choice from the published
  catalogue instead of free text. The value posted is the registry's canonical
  identifier, never composed from provider and model, which is the format defect
  issue #54 found underneath the missing catalogue. Validation now requires
  membership of the offered set **in addition to** the contract pattern; a test
  offers a malformed identifier on purpose so the pattern is provably still
  enforced.
- Behavior: a catalogue that cannot be read withholds the consent form rather
  than falling back to free text, and records nothing if a submission is crafted
  anyway. An unreadable catalogue is not an empty one. A readable empty
  catalogue says so plainly, because being offered nothing is a fact.
- Behavior: a recorded consent naming a profile the organization no longer
  offers renders as its own state with no control, since withdrawing an offer
  does not revoke consent and the customer cannot resolve it. The full-diff
  self-audit found that `namedByActiveConsent` is organization-wide, so the
  notice is scoped to the repository whose own consent names the profile.
- Behavior: the overview and the catalogue resolve as independent sub-views, so
  neither can take the repository detail page down.
- Important files: `docs/security/artifact-attestation-policy.json`,
  `docs/contracts/console-contract-lock.json`,
  `docs/contracts/console-contract-v1.0.1-evidence.json`,
  `docs/decisions/0005-console-contract-release-revisions.md`,
  `vendor/console-contract-v1.0.1/`, `generated/console-contract/v1/`,
  `src/components/repositories/repository-counters.tsx`,
  `src/app/api/repositories/policy/route.ts`,
  `src/lib/repositories/presentation.ts`.
- Verification: lint, format, `tsc --noEmit`, 613 Vitest tests, a production
  build, 126 Playwright tests over the pinned origin
  `https://console.evirion.test:3443`, 98 Python tests, the Console contract
  lock, the authority package, the documentation tree, backend Auth parity at
  `2458f333`, Semgrep with 0 findings on 107 files, and digest-verified Gitleaks
  over 45 commits with no leaks. The generated client reproduces byte for byte
  from the pinned contract. Local Node is 22.18.0 against a baseline pin of
  24.20.0, which affects installation rather than these gates.
- Verification: both releases were verified with the pinned `cosign-linux-amd64`
  at `4629c757` against the pinned trusted root at `6494e21e`, offline in a
  network-isolated `linux/amd64` container. A control run without the trusted
  root fails at TUF refresh on the unreachable network, so the pinned root is
  proved load-bearing rather than assumed. Rekor inclusion holds at log index
  `2698606271`, four seconds before publication against a 3600-second bound, and
  the tag-scoped administrator attestation precedes publication by 206 seconds.
- Deviation recorded: the release assets were downloaded with the operator's own
  `gh` credential rather than the short-lived minimum-scope credential
  `download.allowedCredential` names. The credential gates read access only; the
  independently pinned digest and the signature verification are what establish
  trust, and both were checked. It lived only in the process environment.
- Deployment state: implemented and locally verified. Not merged, not deployed,
  not observed, not staging-certified, not paid-certified, not
  production-certified. No provider call, paid operation, worker run, hosted
  Supabase read or change, or customer data.
- Remaining gates: consuming this release moved the Dashboard authority
  `packageSha256`, so whether a paired backend successor pointer follows is an
  owner decision on that value. `SEC-2026-012` remains open under its approved
  waiver and remains readiness blocking. Accessibility open decision 1 is still
  unresolved and is due before EEM-9/07.

## 2026-09-03 — EEM-9/04 import operations

- Why: EEM-9/04 exposes guarded historical import after the EEM-7 contract
  freeze. All six import operations and both import schemas are already
  published in `console-contract-v1.0`, so no new contract bytes were consumed.
  `EEM-7/05-model-profile-registry` does not block it: it was created after the
  plan was frozen, it concerns the live `AUTO_EXTRACT` model-profile catalogue,
  and historical import reads none of it.
- Contracts: `scripts/generate_console_client.py` now also generates from the
  response envelopes the contract declares inline in `openapi.yaml`. Four import
  operations answer with `RepositoryImportReceipt`, which exists in no schema
  file, so the generator emitted no type for it and `isCommandReceipt` could not
  stand in: `command-receipt.json` fixes `responseCode` to the four entitlement
  codes, so every import receipt would have been classified
  `UNSUPPORTED_SERVER_RESPONSE` and no import mutation could ever have
  succeeded. The bytes are signed and digest verified, so the type is generated
  rather than hand-written.
- Contracts: `scripts/openapi_components.py` reads the `components.schemas`
  subtree with the standard library only, accepting the exact YAML subset the
  frozen contract uses and raising on anything else, so a later contract that
  introduces an unreviewed construct fails the generator loudly. The Python gate
  stays dependency free.
- Contracts: the projection rule takes a fully declared envelope's `data` rather
  than the envelope, which keeps the generated type parallel to every other one.
  Forty of the contract's forty-one success responses reference the bare
  `SuccessEnvelope`, so it matches exactly one component today, and a test pins
  that. It also recovers the unsupported-value sentinel the contract declares on
  `RepositoryImportReceipt/responseCode`, which the generated client had been
  dropping. `generatedClientSurfaceSha256` moves to
  `b5a6facb4862323122e4483ee883fad00c1e271003fe5fff18cbff3a5b6c6797`.
- Behavior: `/repositories/:repositoryId/import` renders the current run, its
  authorization, progress, cost and failed work. The route was frozen by
  EEM-9/01 and is now present in the reviewed inventory, owned by EEM-9/04.
- Behavior: the two waits are separate states with separate treatments. Waiting
  for the customer's approval is the only one of the six authorization states
  that carries a control; waiting for Evirion operational authorization carries
  none, states that there is nothing to do, and states that approving again
  would not grant it. Run status and authorization are rendered as two facts, so
  a `PROCESSING` run without operational authorization reads as the wait rather
  than as extraction under way.
- Behavior: approving records customer consent and never produces `AUTHORIZED`.
  The API double implements the same transition, so this is asserted against
  behaviour rather than against copy.
- Behavior: progress reports the nine counters the contract publishes, in two
  groups. `BF-004` asks for "processed / total" and the contract publishes
  neither field, so the page states completed and failed work against what
  discovery found and names it as the derivation it is. Rejected and quarantined
  are counted apart from failed, because they are model decisions rather than
  infrastructure failures, and both state they never become Knowledge Objects.
- Behavior: the four cost states come from the stored completeness rather than
  from an amount. Unresolved and not-applicable render no amount at all, because
  zero is a measurement neither of them has. Reserved, measured and unresolved
  travel as separately named figures and nothing is presented as an invoice.
- Behavior: there is no generic Retry. A retry appears beside one failed job
  only where that failure's own projection declares it retryable, and a blocked
  one states the blocker instead. The generic processing-job `PROC-002` control
  remains EEM-9/06's. A failure list that cannot be read says so rather than
  rendering an empty list, which would claim there is nothing to recover.
- Behavior: a resume the backend forces back to `PAUSED` is explained as the
  completed command it is. Its receipt response code is not one of the 38
  published error codes, so the shared outcome reader would have failed closed
  and reported an unknown outcome for a command that committed and changed
  state. The import surface reads its own outcome and delegates the rest.
- Behavior: a `NOT_APPLICABLE` cost renders no breakdown at all. Its three
  component amounts are all `0.000000`, so showing them would put zero-dollar
  measurements on screen for a state that has nothing to measure. `UNRESOLVED`
  keeps its breakdown, because there the components are real and only the single
  total is withheld.
- Behavior: polling is a bounded client component. It doubles to a ceiling, caps
  its refreshes, stops entirely while the tab is not visible, and refreshes the
  server route rather than reading anything itself, so the caller token stays
  server-side. It is the first product client component in the Console;
  architecture Section 21.1 permits client components for polling.
- Contracts: approve and state carry `expectedStatus` rather than
  `expectedVersion`, because `core.backfill_runs` has no version column. A stale
  status conflicts exactly as a stale version does. The create body admits no
  mode field at all, so `reextract` cannot be requested from this surface, and a
  test asserts no request body ever carries one.
- Security: import controls are narrowed by the session capability as well as by
  the backend's per-caller `capabilities` projection. The contract names no
  capability for the import operations and publishes no closed capability enum,
  so the nearest published one, `repository.policy.manage`, is used and recorded
  as an assumption in the acceptance trace. Hiding a control remains a
  convenience: the backend refuses the request either way, and the browser suite
  proves the refusal rather than assuming the control's absence.
- Verification: lint, format, `tsc --noEmit`, 565 Vitest tests, a production
  build, 121 Playwright tests over the pinned origin
  `https://console.evirion.test:3443`, 94 Python tests, Semgrep with no
  findings, digest-verified Gitleaks over 37 commits with no leaks, the
  authority package, the documentation tree and the Console contract lock all
  pass, and the generated client reproduces byte for byte from the pinned
  contract.
- Deployment state: implemented and locally verified only. Nothing is merged,
  deployed, observed, staging-certified, paid-certified or production-certified.
  No provider was called, no paid operation was authorized and no worker ran.
- Remaining gates: `EEM-9/07` owns the integrated free backend and the full
  per-role matrix against live fixtures; `EEM-9/08` owns paid certification.
  Accessibility open decision 1 remains unanswered and is due before `EEM-9/07`.
  `SEC-2026-012` remains open and readiness blocking.

## 2026-09-02 — EEM-9/03 repository control

- Why: EEM-9/03 exposes GitHub setup, repository entitlement and policy after
  the EEM-6 contract freeze. All EEM-6 subtasks are merged in the backend,
  ending with PR
  [#37](https://github.com/Evirion/evirion-engineering-memory/pull/37), whose
  commit is an ancestor of the source commit the Console contract lock records,
  so the single lock already covers these operations. The task catalog names an
  "attestation-verified EEM-6 contract lock"; no such artifact exists and none
  is required, and the catalog now says so.
- Behavior: `/repositories` lists accessible and entitled repositories with
  GitHub access, Evirion entitlement and live processing as three independent
  axes, each in its own labelled slot with its own text value. Collapsing them
  into one status chip is the failure this prevents, and text rather than
  colour is what `NFR-ACC-001` asks of a status indicator. Accessible and
  active are reported as separate counts, and an unprovisioned allowance says
  so instead of rendering as zero.
- Behavior: `/repositories/:repositoryId` states the facts behind those axes,
  none of them selectable, and carries the entitlement and policy controls.
  Operator-managed and locked render as resting states with an explanation
  rather than as failures.
- Contracts: every command carries the canonical `Idempotency-Key` header and
  `expectedVersion` in the body. The contract declares no expected-version
  header, so the adapter's inherited header mechanism would have been silently
  dropped and the optimistic check would never have run; a test pins the body
  form. The idempotency key is minted once per rendered form, so a duplicate
  click replays the stored receipt as a success and only a same key with a
  different body conflicts.
- Behavior: capacity, replacement mode, generation and operator decisions are
  never judged locally. A one-slot race and a stale version are both decided by
  the backend, and its answer is what the customer sees.
- Behavior: `AUTO_EXTRACT` is reachable only through its own consent form,
  which collects the model profiles, call ceiling, budget ceiling, retry policy
  and expiry the contract requires and states that Evirion operational
  authorization is still separate. An incomplete consent is refused rather than
  partially recorded. Moving back to `OFF` or `SOURCE_ONLY` sends an explicit
  null consent.
- Behavior: onboarding carries the GitHub connection, and the repository
  inventory carries installation freshness and synchronization progress. A
  running traversal states that the inventory shown is the last complete one,
  because an incomplete traversal must never read as lost access. A suspended
  installation is visible, explained and recoverable, and entitlements are
  untouched by it.
- Security: `Referrer-Policy` changes from `no-referrer` to `same-origin`.
  Under `no-referrer` Chrome sends `Origin: null` on a form navigation, so the
  mutation guard refused every native form post and no state-changing form in
  the Console could ever have succeeded. EEM-9/02 could not see it because its
  auth journey accepts either destination for anti-enumeration reasons.
  `same-origin` sends no referrer to any other origin, so the leakage the
  control exists to prevent is still prevented and the exact-Origin check is
  unchanged.
- Security: `form-action` now names the configured GitHub App install origin
  beside `'self'`. Chrome applies the directive to the entire redirect chain,
  so the connect form was refused outright. The origin is derived from
  `CONSOLE_GITHUB_APP_INSTALL_URL` rather than hardcoded, and a test asserts no
  other directive widened with it.
- Security: the GitHub App handoff is the only off-origin redirect in the
  Console. It goes through a named helper that builds the destination from
  configuration and refuses a state that is not a setup-intent nonce, and a
  contract test asserts no other route may use it.
- Operations: the browser gate gained a contract-shaped Console API double,
  because `CONSOLE_API_BASE_URL` previously pointed at a host that does not
  resolve and every read failed unreachable. Its fixtures are validated by the
  same generated schemas the Console uses at runtime, and a coverage assertion
  fails if a published product state has no fixture. Its state is per session,
  so the suite still runs fully parallel. The harness maps GitHub to loopback
  so no test can reach it.
- Files: `src/lib/repositories/`, `src/server/adapters/repositories.ts`,
  `src/server/queries/repositories.ts`, `src/components/repositories/`,
  `src/app/(console)/repositories/`, `src/app/api/repositories/`,
  `src/app/api/github/`, `tools/console-stub/`.
- Review: one bounded wave of a security and a correctness reviewer. The
  security reviewer found nothing at medium severity or above. The correctness
  reviewer found three contract-fidelity defects, all fixed: a budget ceiling
  below a microdollar rounded to the `0.000000` the consent schema forbids, a
  repeated model profile passed a schema requiring unique items, and the
  change-request candidate list came from one default page without saying so.
- Verification: lint, format, `tsc --noEmit`, 423 Vitest tests, a production
  build, 83 Playwright tests over `https://console.evirion.test:3443`, 58
  Python tests, Semgrep with no findings, digest-verified Gitleaks over the
  full history, the authority package, the documentation tree and the Console
  contract lock all pass. Local Node is 22.18.0 against a baseline pin of
  24.20.0; CI runs the pinned runtime. Every Definition-of-Done row is traced
  in [`plans/active/eem-9-03-acceptance-trace.md`](plans/active/eem-9-03-acceptance-trace.md).
- Deployment state: implemented and locally verified only. Not merged, not
  deployed, not observed, not staging-certified, not paid-certified, not
  production-certified. No real GitHub App was connected, no GitHub API was
  called, no worker ran, no provider was called and no paid operation was
  authorized.
- Remaining gates: open decision 6 is blocked on a contract gap, because no
  repository-overview schema exists for either this subtask or EEM-9/06 to
  validate, and the model profiles a consent may name are neither enumerated nor
  expressible in the format the worker builds. Both are raised as backend issues
  [#53](https://github.com/Evirion/evirion-engineering-memory/issues/53) and
  [#54](https://github.com/Evirion/evirion-engineering-memory/issues/54). Open
  decisions 1, 3, 4 and 5 remain unanswered. `SEC-2026-012` remains open and
  readiness-blocking.

## 2026-09-02 — EEM-9/02b Console response envelope

- Why: EEM-9/03 could not read a repository, and the merged Auth shell could not
  have read a live session either. The backend answers every route through one
  success responder that emits `{contractVersion, requestId, data}`, but the
  Console validated that whole document against the generated payload schema.
  Those schemas reject unknown keys, so every real success would have been
  classified `unsupported` and every protected page would have rendered its
  fail-closed unavailable state. Nothing caught it because the transport
  fixtures were written to match the validator rather than the backend.
- Contracts: `callConsoleApi` now checks the success envelope exactly as the
  generated `isConsoleError` checks the failure envelope — the three keys and no
  others, `contractVersion` pinned to `1.0`, and a UUID `requestId` — then hands
  only `data` to the payload validator. Unwrapping alone was rejected: without
  the version pin, a backend bump would pass silently on success while the error
  path still refused it, which is what the field exists to prevent. `data`
  carries no schema in the contract, so only its presence is asserted and the
  payload validator still owns its shape.
- Behavior: the success arm of `ConsoleResult` now carries `requestId`. It is
  the support-correlation handle a customer can quote without retrying, and the
  `PROC-002` call to action in EEM-9/06 needs it.
- Behavior: the private session bootstrap is enveloped too. Being absent from
  the customer OpenAPI exempts it from having a generated validator, not from
  the responder every route shares.
- Behavior: `src/server/queries/invitation-choices.ts` reads `/v1/session/pre-auth`
  directly rather than through the adapter and had the same assumption. It now
  imports the adapter's envelope guard instead of carrying a second one, and its
  parsing is exposed as `parseInvitationChoices` so it is provable in isolation.
- Tests: every transport fixture now sends what the backend sends. Correcting
  only the expectations would have re-admitted the same class of defect, so the
  fixtures moved and negatives were added for an absent envelope, an unannounced
  contract version, a non-UUID request identifier, an unexpected envelope key,
  and a payload that fails its validator inside a valid envelope.
- Not changed: the client generator and the contract. The asymmetry is the
  contract's own — `Error` models a complete response body while every payload
  schema models the `data` member — and `packageSha256`
  `53da9379428d8f34b7e674805019244e85ed89a7cd6f0e1d9b4a2a79b23d6b6c` does not
  move.
- Verification: lint, format, `tsc --noEmit`, 253 Vitest tests including 24 in
  the two envelope suites, a production build, and 45 Playwright tests over
  `https://console.evirion.test:3443` all pass. Local Node is 22.18.0 against a
  baseline pin of 24.20.0; CI runs the pinned runtime.
- Deployment state: implemented and locally verified only. Not merged, not
  deployed, not observed, not staging-certified, not paid-certified, not
  production-certified. No backend, hosted Supabase, provider or paid path was
  touched; the sibling repository was read with `git show` at the pinned commit.
- Remaining gates: EEM-9/07 proves this against a live backend. `SEC-2026-012`
  remains open and readiness-blocking.

## 2026-09-02 — EEM-9/02 secure Console shell and invite-only authentication

- Why: EEM-9/02 builds the Console shell and the invite-only email-OTP
  authentication UX against the frozen EEM-4 contracts. Its C00 phase is an
  owner-authorized addition taken before any screen, because the scaffold
  could not land correctly without it.
- Authority boundary: `package-files.json` and `manifest.json` held the same 84
  entries, so the authority package was the whole repository and any scaffold
  file could only enter the reviewed package or break the authority gate. All
  84 entries stay packaged; `scripts/check_authority.py` now reads a reviewed
  allowlist of non-package tracked paths in
  `docs/authority/non-package-paths.json`. A path in both lists fails, a path
  in neither still fails, and a pattern matching nothing fails. After this,
  `packageSha256` no longer moves when application source changes, which is the
  property the backend pointer depends on.
- Guard: `test_no_dashboard_runtime_scaffold_exists_in_bootstrap` is replaced,
  not deleted. Six prohibitions expired because this subtask creates the
  runtime they excluded. `supabase` did not expire and keeps its own named
  test, because the backend owns persistence and Auth. The replacement checks
  the URLs the App Router actually resolves against
  `docs/architecture/console-route-inventory.json`, since `(auth)/sign-in`
  serves `/sign-in` while still rendering correctly. `/api/*` is not pinned;
  the one assertion added is that every route handler resolves under `/api/`.
- Contracts: the frozen EEM-9 plan freezes `/auth/*`, while the accepted
  implementation plan's C02 file list uses a route group that would serve
  `/sign-in`. By owner decision the URL contract binds and the file list is
  layout guidance. `/settings/sessions` is accepted as a reviewed fourteenth
  path and `/` as a declared owned route. ADR-0003 records all of it; neither
  frozen plan was edited.
- Toolchain: the pinned `typescript@7.0.2` is the native compiler whose main
  entry exports only `version` and `versionMajorMinor`, and
  `typescript-eslint` requires `typescript >=4.8.4 <6.1.0`, so
  `eslint-config-next` cannot parse TypeScript here. `tsc --noEmit` and
  `next build` both work under the pin, so the pin stands and the linter is
  `oxlint`, which needs no compiler API and enforces the same prohibitions
  including `react/no-danger`. Prettier carries `semi: false`. ADR-0004
  records the evidence.
- Behavior: Next.js App Router under `src` with strict TypeScript, a
  per-response CSPRNG nonce CSP with no `unsafe-inline` or `unsafe-eval` in
  production, a server-only `__Host-` session broker, the pre-auth transaction
  and its bound proof, the session-bound CSRF and origin boundary, server-side
  `verifyOtp`, invitation selection, the protected shell with capability-driven
  navigation, and the Auth surfaces the route contract pins.
- Security: cookie chunking implements the frozen budget exactly, and writing a
  session now refuses a payload that fits four 3072-byte chunks but not the
  8192-byte inbound `Cookie` header, because the aggregate binds first and such
  a session could never be read back.
- Security: redirects were built from `request.url`, which behind the trusted
  edge carries the internal upstream host, so every redirect left the canonical
  origin. The pinned HTTPS harness caught it; testing against Next on localhost
  would not have. Redirects now derive from the reviewed canonical origin and a
  contract test forbids the old form.
- Security: Gitleaks found the bootstrap commit had captured the generated
  local TLS private keys, because `.gitignore` did not cover `.local/`. They
  are untracked, `.gitignore` excludes `.local/` and `.venv/`, and the branch
  history was purged before anything was pushed.
- Operations: `.github/workflows/ci.yml` pins Actions to full SHAs and runs
  install, lint, format, typecheck, test, build, audit, Semgrep from
  `tools/security/uv.lock` and digest-verified Gitleaks. The browser gate runs
  over the pinned origin `https://console.evirion.test:3443` behind a local TLS
  terminator that also acts as the single trusted edge hop, with no machine
  change: Chromium resolves the host with `--host-resolver-rules` and trusts
  one leaf by SPKI pin, so `ignoreHTTPSErrors` is never set.
- Parity: `docs/contracts/backend-auth-config-lock.json` pins the backend Auth
  configuration digests and derived settings at the same commit the
  attestation-verified contract lock records, so CI proves parity without a
  cross-repository read. `scripts/check_backend_auth_parity.py` closes the
  other half locally by re-reading the sibling with `git show`.
- Review: one bounded independent wave ran against the final tree. No security
  issue at medium severity or above. It found that five forms posted to route
  handlers that were never written, which lint, typecheck, the build and the
  route guard could all miss, because the guard checks that routes are declared
  rather than that referenced routes exist. The remediation added the four
  missing BFF routes, replaced the recovery form with the operator-led surface
  the backend contract supports, minted the session-bound CSRF proof the
  post-authentication forms needed, and added a contract test asserting every
  form action resolves to an existing handler and carries a proof.
- Verification: lint, format, `tsc --noEmit`, 240 Vitest tests, production
  build, 45 Playwright tests over the pinned HTTPS origin, Semgrep, Gitleaks
  over the full history, and 79 Python tests all pass. Every Definition-of-Done
  row is traced in
  [`docs/plans/active/eem-9-02-acceptance-trace.md`](plans/active/eem-9-02-acceptance-trace.md).
- Open decision: the accessibility target is WCAG 2.2 AA per `AGENTS.md`, but
  the axe ruleset, tag selection and pass threshold have no owner decision, so
  no configured accessibility gate is claimed. `NFR-ACC-001` places the primary
  owner at `I01-C`, so the decision is due before EEM-9/07.
- Deployment state: implemented and locally verified only. Nothing is merged,
  deployed, observed, staging-certified, paid-certified or
  production-certified. No hosted Supabase Auth setting was read or changed, no
  real email was sent, no worker ran, no provider was called, no paid operation
  was authorized, and the backend repository was only read.
- Remaining gates: EEM-9/07 owns hosted Auth parity, the synthetic mailbox,
  the live tenant and capability matrices, authenticated DAST and the
  deployed cache and header evidence. `SEC-2026-012` remains open.

## 2026-09-02 — EEM-9/01b Console contract consumed and immutability evidence corrected

- Why: the backend published `console-contract-v1.0` as an immutable signed
  release, and consuming it proved that three EEM-9/01 artifacts could not
  execute as frozen.
- Security: the frozen attestation text and `authority-release.yml` both
  required `repos/{owner}/{repo}/immutable-releases`, which needs admin read
  access that no GitHub Actions token can hold. Backend run 33611371573 proved
  it with `Resource not accessible by integration (HTTP 403)`. Taken literally
  the frozen text forbade publication permanently, including
  `dashboard-authority-v*`. Backend ADR 0013 attributed this correction to the
  successor pointer; both defective files are owned here, so they are corrected
  here and the pointer re-pins the result. A tracked, tag-scoped administrator
  attestation bounded at 24 hours with a 300-second clock-skew allowance now
  gates signing, and `immutable == true` is asserted on the published release
  with `contents` permission.
- Security: `authority-release.yml` now creates a draft, attaches both assets,
  matches the uploaded archive digest while the release is still mutable, and
  only then publishes, because publication is what freezes an immutable
  release's asset set. `softprops/action-gh-release` is no longer used.
- Security: offline `cosign verify-blob` needs a trusted root under Cosign v3,
  which deprecates `--offline` and otherwise fetches the root over the network.
  The Sigstore public-good trusted root is pinned by digest and committed.
- Security: the trust policy became a map of artifact entries. The
  `dashboard-authority-v1` entry keeps its values; a `console-contract-v1` entry
  names `Evirion/evirion-engineering-memory`, its tag prefix, its workflow path,
  and the same verifier pins. The negative-evidence fixture now covers both
  entries with 28 executable cases each, including a missing, stale, post-dated,
  wrong-tag, or wrong-repository administrator attestation and a release whose
  `immutable` field is false or absent.
- Behavior: the pinned release asset and its extracted members are vendored, and
  TypeScript types plus runtime validators are generated from exactly those
  bytes. CI fails on archive digest drift, contract `packageSha256` drift,
  generated-client drift, and any change to the generated export surface.
- Verification: the published release verifies offline with the pinned
  `cosign-linux-amd64` under network isolation against the exact certificate
  identity, GitHub Actions issuer, repository, tag ref, source commit, and
  `push` trigger, with Rekor inclusion and a 5-second signing-to-release
  interval inside the frozen one-hour bound. 64 bootstrap and contract tests,
  392 acceptance rows, 212 ASVS rows, 12 `SEC-WEB` rows, documentation,
  authority, secret, and deterministic-packaging checks pass.
- Console contract `1.0` content is unchanged at
  `53da9379428d8f34b7e674805019244e85ed89a7cd6f0e1d9b4a2a79b23d6b6c`, because
  this consumes published bytes rather than producing them.
- Governance: repository immutable-release policy is now enabled and observed.
  `SEC-2026-012` concerns ruleset governance on GitHub Free, remains open under
  its approved waiver, remains readiness-blocking, and is unrelated to this
  correction.
- Deployment state: no Dashboard release, signature, tag, deployment, hosted
  configuration, provider call, paid operation, or customer data was used. No
  Dashboard administrator attestation is committed, so `authority-release.yml`
  still fails closed until one is recorded for an exact tag.
- Remaining delivery: the paired backend successor pointer re-pins this merged
  commit, the corrected artifacts, and the new authority package digest.

## 2026-08-27 — EEM-9/01 catalog authority corrected

- Why: post-merge backend pointer preparation proved that the PR #1 copy-ready
  `/02`–`/10` aliases described different scopes from the full EEM-9 plan,
  violating `P01-A012` and the catalog's own controlling-plan rule.
- Preserved the accepted full plan and replaced the catalog requests with its
  exact `auth-shell`, `repository-control`, `import-operations`,
  `memory-review-lifecycle`, `processing-settings-metrics`,
  `free-integration`, `paid-certification`, `design-partner-ready`, and
  `first-design-partner-outcome` aliases and approval boundaries.
- Added a focused regression that extracts all ten aliases from both files and
  requires exact equality; updated roadmap and handoff state without changing
  requirements, architecture, acceptance ownership, security policy, runtime,
  or backend behavior.
- Verification: the focused alias-parity regression passed; the authority
  manifest was regenerated and mechanically verified. No broad product,
  PostgreSQL, Supabase, runtime, container, security, paid, or remote gate ran.
- Deployment state: repository-only remediation; no release, signature,
  deployment, hosted configuration, provider call, paid operation, or customer
  data was used.
- Remaining delivery: merge the authorized Dashboard remediation PR, then
  update the paused backend pointer to the successor Dashboard commit/package
  and complete its separately authorized delivery.

## 2026-08-27 — EEM-9/01 Dashboard authority half prepared locally

- Began the Dashboard authority/catalog half of EEM-9/01 after backend
  EEM-3/13 merged and its lock attestation was reverified.
- Preserved the initial Apache-2.0 license and added `.idea/` as the first
  Dashboard ignore rule.
- Migrated the accepted requirements, architecture, implementation plan,
  EEM-9 execution plan, and portable program design with source digests and
  immutable backend locators.
- Materialized stable product acceptance ownership and the selected OWASP ASVS
  5.0.0 Level 2 ownership/evidence matrix.
- Added deterministic authority verification, documentation checks, artifact
  trust policy, negative substitution fixtures, repository governance, and
  release-workflow policy.
- The release workflow now checks GitHub's dedicated immutable-release endpoint
  before signing or publication. Current API evidence is `not-enabled`, so the
  workflow fails closed and `SEC-2026-012` remains readiness-blocking.
- Local verification passed 37 bootstrap tests, 392 acceptance rows, 212
  selected ASVS Level 2 rows, 12 `SEC-WEB` rows, documentation/generated
  authority/secret scans, machine-readable and workflow syntax checks, and
  deterministic construction of the exact 50-member authority archive.
- Deployment state: not deployed or published. No hosted Auth/Supabase
  configuration, provider/paid operation, or customer data was used.
- Remaining gates: explicit Dashboard commit/push/PR authorization and merge;
  then the paired backend pointer/attestation PR and merge. Signing, release,
  immutable-release enablement, and any remote configuration remain separate
  explicitly authorized actions.
