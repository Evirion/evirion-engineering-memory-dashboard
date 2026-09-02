# Dashboard handoff

Updated: 2026-09-02

## Current state

- Active task: EEM-9/02, the secure Console shell and invite-only Auth UX.
- Branch: `EEM-9/02-auth-shell`, based on Dashboard `main` at `a6665b5`, which
  merged PR
  [#3](https://github.com/Evirion/evirion-engineering-memory-dashboard/pull/3).
- EEM-9/01b is complete. Backend PR 3,
  [#52](https://github.com/Evirion/evirion-engineering-memory/pull/52), merged
  and re-pinned this repository. The pointer verifies at commit
  `a6665b599472e295636382ece4d0071e1cb4492c` and package digest
  `6897d9661a038a14eee0fd8128e7a3e96d5b191ef41f197f621779cc2e0ec56f`.
- Prerequisite check: EEM-4/01–04 are merged in the backend as PRs
  [#26](https://github.com/Evirion/evirion-engineering-memory/pull/26)–[#29](https://github.com/Evirion/evirion-engineering-memory/pull/29).
  The previous roadmap statement that EEM-4/01 was blocked was stale and is
  corrected.
- This work is committed on its branch and not pushed. No pull request exists.

## What changed here and why

- **C00 separates the authority package from application source.** The package
  inventory and the manifest held the same 84 entries, so the package was the
  whole repository and every scaffold file would either enter the reviewed
  authority or break the authority gate. All 84 entries stay packaged and the
  rule changed instead: a reviewed allowlist now names non-package tracked
  paths, a path in both lists fails, a path in neither still fails, and a
  pattern matching nothing fails.
- **C00 inverts the bootstrap guard rather than deleting it.** Six
  prohibitions expired with the arrival of the runtime. `supabase` did not and
  keeps its own named test. The replacement asserts the URLs the App Router
  resolves, because a route group can serve the wrong URL while still
  rendering.
- **C01 bootstraps the application.** Pinned Corepack, pnpm, Node and registry
  with denied install scripts; strict TypeScript under `src`; the environment
  boundary; the per-response nonce CSP; the supply-chain and release-surface
  gates; and the local HTTPS harness.
- **C02 adds authentication.** The server-only `__Host-` session broker, the
  pre-auth transaction, the CSRF and origin boundary, server-side `verifyOtp`,
  invitation selection, the protected shell and the Auth surfaces.
- **C03 records the trace and history.**
- Rationale is in
  [ADR-0003](decisions/0003-application-source-boundary-and-route-contract.md)
  and
  [ADR-0004](decisions/0004-console-lint-and-format-toolchain.md).

## Decisions a reviewer should check first

- The frozen EEM-9 plan freezes `/auth/*`; the accepted implementation plan's
  C02 file list uses a route group that would serve `/sign-in`. By owner
  decision the URL contract binds and the file list is layout guidance.
  `/settings/sessions` is a reviewed fourteenth path and `/` is a declared
  owned route. Neither frozen plan was edited.
- The pinned `typescript@7.0.2` is the native compiler and exposes no compiler
  API, so `eslint-config-next` cannot run. The pin stands; the linter is
  `oxlint`, which enforces the same prohibitions.

## Security and release state

- The Auth/session contract remains frozen at JWT 15m, visible-tab human idle
  30m with a 5m warning, touch coalescing 1m, absolute application session 8h,
  maximum three sessions with explicit oldest-session replacement,
  dangerous-operation reauthentication 10m, OTP 10m, and resend cooldown 60s.
  `src/lib/auth/session-policy.ts` mirrors these and a contract test asserts
  the mirror stays exact.
- Two defects were found by the gates and fixed. Redirects were built from
  `request.url`, which behind the trusted edge carries the internal upstream
  host, so every redirect left the canonical origin; only the pinned HTTPS
  harness could see it. Gitleaks found the bootstrap commit had captured the
  generated local TLS private keys, because `.gitignore` did not cover
  `.local/`; they were untracked and the branch history was purged before
  anything was pushed.
- `SEC-2026-012` remains open under the approved GitHub Free bootstrap waiver
  and remains readiness-blocking.
- Technical Design Partner Ready remains blocked.
- No hosted Supabase Auth setting was read or changed, no real email was sent,
  no worker ran, no provider was called and no paid operation was authorized.
  The backend repository was read with `git show` at the pinned commit and
  never modified.

## Verification and next action

Lint, format, `tsc --noEmit`, 236 Vitest tests, a production build, 45
Playwright tests over the pinned origin `https://console.evirion.test:3443`,
Semgrep, digest-verified Gitleaks over the full history, and 78 Python tests
all pass. Documentation, generated authorities, the authority manifest, the
Console contract lock and backend Auth parity all verify. Every
Definition-of-Done row is traced in
[`plans/active/eem-9-02-acceptance-trace.md`](plans/active/eem-9-02-acceptance-trace.md).

The next action is review of this branch, then a decision on whether the moved
authority `packageSha256` warrants a paired backend successor pointer. The
pointer keeps verifying either way, because it reads the pinned commit rather
than Dashboard `main`.

Commit, push, pull request, and merge each require separate explicit
authorization. Accessibility open decision 1 is unresolved and is due before
EEM-9/07.
