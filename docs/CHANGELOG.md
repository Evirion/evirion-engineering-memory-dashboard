# Dashboard changelog

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
