# Dashboard changelog

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
