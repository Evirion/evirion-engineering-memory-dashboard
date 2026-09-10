# Dashboard handoff

Updated: 2026-09-10

## Current state

- Active branch: `EEM-9/07-import-shows-discovery-outcome`. Observation follow-up
  from the first real Prepare import on staging.
- **The import page lied after discovery and after approve.** Staging showed
  "Discovering PR history" until a full reload, Pause after discovery had
  finished, and a spinning "Extracting Engineering Memory" after Approve
  extraction. A soft refresh does not replace the hosted RSC snapshot. Approve
  records consent and leaves the run `PROCESSING` while Evirion authorization
  is still missing. This branch polls four progress facts, reloads only when
  they move, names discovery as finished rather than complete, hides Pause at
  `AWAITING_APPROVAL`, keeps Extracting while the run is processing, shows
  success when it completes and an error with prepare-again when it fails.
  **Not deployed.** Staging still serves the previous poll. Paid extraction
  still cannot finish until a separately authorized extraction worker is
  running; do not start it from this task.
- **A platform operator signing in to the Console is refused, and now the copy says so.**
  Observed on staging on 2026-09-08: the emailed code is accepted, then
  `issue_console_member_pre_auth` answers `403`, because that function compares
  `raw_app_meta_data` for equality against the `organization-invitation-v1` provisioning marker
  and an operator carries `platform-operator-passwordless-v1`.
  The refusal is correct and the absence of an operator door is deliberate: operators act through
  `scripts/eem_operator_session.py` and `scripts/manage_organization_member.py`, and an operator
  holding `owner` of a partner organization is the onboarding state that `transfer_owner_and_leave`
  exists to end. Only the sentence was wrong, and `sessionNotPermitted` replaces it.
  Repository entitlement never needed an operator: an organization `admin` or `owner` provisioned
  through the invitation path signs in normally, and on 2026-09-08 one did, activated
  `svg-dd/test-repo` and set its policy to `SOURCE_ONLY`.
- **The backend refused every declared query parameter until today.** `processing-activity`,
  `knowledge`, `usage` and `metrics` answered `REQUEST_INVALID` before their own key lists were
  read, so filters, pagination and periods were dead and the pull request detail page — which
  resolves a number through `processing-activity?repositoryId=` — could never load. Fixed in
  backend [PR #113](https://github.com/Evirion/evirion-engineering-memory/pull/113) and deployed to
  the staging edge function.
- **Reading counts as presence, and it is deployed.** Pointer, keyboard and scroll input in a
  visible tab sends one heartbeat to `POST /api/session/activity`, coalesced to the interval the
  database applies, and the shell warns five minutes before the window closes instead of signing
  the reader out with no notice. `idleExpiry` is `2h` here and in backend migration
  `20260907200000`, which is applied to `EEC-staging`; the database still owns the deadline.
  Merged as [PR #54](https://github.com/Evirion/evirion-engineering-memory-dashboard/pull/54)
  (`e0298a5`) after backend [PR #96](https://github.com/Evirion/evirion-engineering-memory/pull/96)
  (`df1ffe2`). The deployed route refuses an unauthenticated POST at the mutation guard, which is
  the boundary answering rather than a handler running.
  **Not observed:** no session has been watched surviving past the old thirty-minute mark, and the
  warning has not been seen by a real reader.
- **The authority package digest moves with the baseline.** The literal is not repeated in this
  file, because recording it inside a package file would change the value it records. It does not
  disturb the backend pointer, which pins the EEM-9/01 package at Dashboard commit `f7d43d2d`
  rather than at whatever `main` holds.
- **EEM-9/07g is merged and the Console is deployed.**
  [PR #53](https://github.com/Evirion/evirion-engineering-memory-dashboard/pull/53) merged as
  `d4cae0c` after backend [PR #95](https://github.com/Evirion/evirion-engineering-memory/pull/95),
  and `https://console.evirion.dev/api/github/installed` answers, redirecting an unauthenticated
  caller to sign-in. Setting the GitHub App Setup URL to that address is the remaining operator
  step; no real installation has been observed.
- **The frozen-authority check is green again.** It had failed on every pull request since
  `vercel.json` arrived with the region pin without being named in either inventory. It is
  deployment configuration and now sits in `non-package-paths.json`.
- **EEM-9/07g — GitHub App installation return.** `GET /api/github/installed` completes the
  browser half of the handshake and redirects to `/settings/github?result=…`, which now renders
  that outcome through the shared command-outcome notice. The pending poll is bounded by the
  fifteen-minute proof window, so an organization that uninstalled no longer sits in a permanent
  refresh loop. `pnpm lint`, `pnpm typecheck` and `pnpm format:check` pass; 968 unit/contract tests
  across 66 files and 334 Playwright tests pass. The five security specs that fail on `main` still
  fail identically.
- **Depends on backend.** Open as
  [PR #53](https://github.com/Evirion/evirion-engineering-memory-dashboard/pull/53), paired with
  backend [PR #95](https://github.com/Evirion/evirion-engineering-memory/pull/95), which merges
  first. **The backend half is already live on `EEC-staging`** — migration `20260907170000` applied
  and `console-api` at version 30 — so the callback there accepts a body without `accountLogin` and
  can answer `GITHUB_INSTALLATION_PENDING_PROVIDER`. What remains is deploying this Console and
  setting the GitHub App Setup URL to `https://console.evirion.dev/api/github/installed`. Nothing
  is observed end to end yet.
- **Operator action after deploy.** GitHub App Setup URL:
  `https://console.evirion.dev/api/github/installed`.
- **A partner can sign in and use the Console, observed end to end on
  staging.** An email code alone is `aal1`; the backend creates such a session
  awaiting a second factor and refuses every read until one arrives.
  `/auth/mfa/enroll` shows a QR and the key to type, the challenge accepts a
  first unverified factor, and the backend session is activated once the token
  carries `aal2`. Merged as [#39](https://github.com/Evirion/evirion-engineering-memory-dashboard/pull/39),
  [#40](https://github.com/Evirion/evirion-engineering-memory-dashboard/pull/40)
  and [#41](https://github.com/Evirion/evirion-engineering-memory-dashboard/pull/41).
- **Two defects were found by walking the deployed journey, not by reading.**
  `listFactors` hides an unverified factor from `data.totp`, so the first
  confirmation could never begin; and the backend refuses a correlation
  identifier that is not a UUID, so every protected page answered `422`. The
  second means no protected page had ever loaded against the real backend. Both
  are fixed, and the browser doubles that let them through do not apply either
  rule.
- **Activation is unreleased as a contract tag.** It calls
  `POST /v1/session/activations`, merged and deployed in the backend, but the
  last tag is `console-contract-v1.0.5`, which this repository vendors. The call
  follows the handwritten adapter pattern pre-auth and bootstrap already use.
  Cutting `console-contract-v1.0.6`, vendoring it and regenerating the client is
  the follow-up; it is blocked while GitHub Actions refuses to start jobs
  because account payments have failed, which is also why every recent pull
  request shows red checks.
- **Five security specs fail on `main`** — four in
  `headers-cache-isolation.spec.ts` and one in `release-surface.spec.ts` — and
  fail identically before and after this branch. They are not diagnosed.
- Previous branch: `EEM-9/08-perform-the-pre-auth-ceremony`.
- **Sign-in works.** The BFF was missing the middle step of the ceremony: the
  backend issues the pre-auth transaction and the bootstrap must name that
  identifier, in `otp_verified`. The BFF invented one, so no session had ever
  been created. It now calls `/v1/session/pre-auth` for a member and
  `/v1/invitations/{id}/accept` for an invited reader, and sends the identifier
  it receives together with `deviceLabel` and a UUID idempotency key.
- **Staging needed `CONSOLE_PRE_AUTH_HMAC_KEY`** and now has it.
- **An invited reader signs in through a link that names their invitation.**
  `/auth/sign-in?invitation=<id>`. The backend routes on it: with an invitation
  it uses `api.issue_console_pre_auth`, without one
  `api.issue_console_member_pre_auth`, and the latter requires a membership in
  `active` which an invited reader does not have until they accept. Accepting
  needs a session, so without the link the invited path is unreachable and the
  reader is refused after a correct code.
- **Nothing sends that link yet.** The invitation email carries no links at
  all, so the URL must be handed over by other means until the branded Resend
  invitation exists. That is the next task, and this is why it is not
  cosmetic.
- **An invited reader can now ask for a code.** Their address is unconfirmed
  until they use one, and Supabase answers a code request for an unconfirmed
  account with `signup_disabled`, so the button refused exactly the people it
  exists for. `requestEmailOtp` falls back to resending the signup
  confirmation. Without this, the ten-minute code inside a seven-day invitation
  is the only one an invited reader ever gets.
- **The root redirects to sign-in.** The ADR-0003 placeholder outlived the Auth
  phase that was meant to replace it, and the first design partner landed on
  it.
- **Next: the invitation should be our own email.** Supabase keys templates by
  event type, so the invitation and the resent code are the same message today.
  A branded invitation sent through Resend, carrying the organization name and
  a plain link to sign-in and no code at all, is the accepted direction. It
  depends on the fallback above, or an announcement would leave the reader with
  no way to get a code.
- **The Console is deployed and reachable at `https://console.evirion.dev`.**
  Public routes answer, protected routes redirect to sign-in on that origin, and
  mail is delivered by Resend from `Evirion <no-reply@evirion.dev>` to any
  address. The previous `.vercel.app` hostname still resolves and stays in the
  Auth redirect allow-list while the move settles.
- Merging to the connected branch is an authorized Console deployment by owner
  decision of 2026-09-05. That covers the Console only.
- `docs/authority/eem3-global-lock-input.json` no longer carries
  `migration.remoteApplicationState`. That was a fact about a backend staging
  database this repository cannot observe, frozen as the literal `not-applied`
  and compared against that exact string, so applying the migration would have
  made it false with every gate still passing. The backend derives it from a
  recorded baseline now. First of a pair; the backend removes the matching
  assertion and re-pins second, and until then it refuses this change by
  design.
- `main` is at `8e81d04`, which merged Console `I01-C` through
  [PR #23](https://github.com/Evirion/evirion-engineering-memory-dashboard/pull/23).
  Two checks failed on the first push and both were Console defects invisible
  locally: the EEM-9/01 bootstrap contract still pinned the discarded
  `::asvs_v1_1_1` evidence shape, and the rollback rehearsal test read the
  canary profile from a sibling backend checkout no runner has. Both are fixed;
  the sibling case now asserts its own precondition instead of skipping.
- `EEM-9/03h` and `EEM-9/02c` are merged; text here previously asked for an
  `EEM-9/03h` pull request and a rebase of `EEM-9/06`, both of which had already
  landed, and EEM-9/07 corrected it against Git rather than leaving the next
  reader to discover it.
- The Console contract lock pins `console-contract-v1.0.5` at backend source
  commit `924d1c47`. The release is tagged, signed, published and immutable; the
  signature was verified offline here with the Cosign binary the policy pins by
  digest. The revision made `organizationId` optional on `/v1/session/context`,
  which is why a first session can now resolve a context at all.
- **The backend pins this repository's authority package digest**, which this
  branch moved. Re-pinning the backend pointer is a separate pull request in
  that repository and belongs immediately after this one. Read the value from
  `docs/authority/manifest.json` rather than from prose: this file is inside the
  package, so a digest quoted here describes the state before it was quoted.
- The paired backend `I01-B` is merged through
  [PR #73](https://github.com/Evirion/evirion-engineering-memory/pull/73) at
  `aa5bd83`. It moved no contract or migration byte, so no contract publication
  was needed between the two pull requests.
- Step 7, the staging apply, deployment and free canary, remains unauthorized
  and now has a written prerequisite plan. It is backend-owned, at
  `docs/plans/active/eem-9-07-remote-free-phase-plan.md` in
  `Evirion/evirion-engineering-memory`, because every action it describes is a
  backend apply, deployment or observation.   One prerequisite remains open, and it is not a Step 7 decision to make on the
  day: the recorded staging migration gap is itself stale, and the true applied
  count can only be read from the project.
- The other prerequisite is closed on this branch. The global lock supersession
  read `pending-dashboard-reattestation` with `EEM-9/07` as its named owner, so
  `docs/authority/eem3-global-lock-input.json` now re-attests the current
  backend lock plane at `aa5bd83`, backend PR #73, instead of the EEM-3/13 bytes
  merged by backend PR #24. This is the first pull request of the pair; the
  backend re-pins this commit and drops the marker in the second. Until that
  merges the backend verifier reads this file at its previously pinned commit,
  so the two repositories stay consistent in between.

## What changed here and why

EEM-9/07 is the first task where the Console and the backend are exercised
against each other rather than each against its own reading of the contract.

- **Conformance tier** — the double knew 32 of the 38 error codes a Console
  surface can receive, so six refusals could never be exercised by any test.
  They are closed, and an unknown code now throws instead of becoming a 500.
- **Nine security and journey suites** — `SEC-WEB-001`, `004`, `008`, `009`,
  `NFR-SEC-003`, `NFR-ACC-001`, `AUTH-009`, `G-001` and ASVS V10.
- **The gate is executable as specified** — five Step 6 scripts did not exist,
  and OWASP ZAP is now pinned by index digest rather than by tag.
- **The ASVS matrix can now pass** — every row named a synthesised case that
  existed in no suite, which is why all 212 read `planned`.
- **Rollback rehearsal** — one profile drives both repositories identically.

Trace: [`eem-9-07-acceptance-trace.md`](plans/active/eem-9-07-acceptance-trace.md).

## Security and release state

- No provider was called, no paid operation authorized, no worker run, no hosted
  Supabase setting read or changed, and nothing deployed.
- Network use was limited to fetching the pinned Node runtime and the
  digest-pinned OWASP ZAP image, both checksum or digest verified.
- The baseline DAST scanned only the local production build: 60 rules pass,
  7 warnings, nothing at High or above.
- `SEC-2026-012` remains open under the approved GitHub Free bootstrap waiver
  and remains readiness blocking.
- Technical Design Partner Ready remains blocked.

## Verification and next action

This branch: focused import unit/component tests, `tests/e2e/import.spec.ts`,
`tests/security/import-boundary.spec.ts`, `pnpm lint` and `pnpm typecheck` pass.
The complete free gate has not been re-run.

Next: merge
[PR #68](https://github.com/Evirion/evirion-engineering-memory-dashboard/pull/68),
then deploy the Console so staging stops serving the stuck discovery/extraction
poll. Do not start the paid extraction worker from this task. A full
`pnpm verify` is not required for this UI follow-up unless the PR gate asks
for it.

Two things are recorded for whoever picks this up. `error.json` is shared with
the operator contract, so the generated Console validator accepts two codes no
Console surface can receive; narrowing it is a contract change neither pull
request owns. And the ASVS status is suite level, not row level — a `pass` means
the named suite exists and passed, not that a separate assertion was written for
that single requirement.
