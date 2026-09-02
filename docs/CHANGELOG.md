# Dashboard changelog

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
