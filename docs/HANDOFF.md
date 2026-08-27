# Dashboard handoff

Updated: 2026-08-27

## Current state

- Active task: `EEM-9/01-dashboard-repo-bootstrap`.
- Branch: `EEM-9/01-dashboard-repo-bootstrap`, based on initial Dashboard
  commit `85c851202dd978af50dbdac1a599c74f3994c5ad`.
- Backend prerequisite: EEM-3/13 merged through backend PR #24 at
  `b23f6ba2b11f583b61200cec63500a782992f1f0`; reviewed and merged trees match,
  and the merged PostgreSQL 17 global-lock attestation passes 10 tests.
- Dashboard authority migration, bounded full-diff audit, and complete local
  free verification are finished on the uncommitted task branch.
- No Dashboard commit, push, PR, merge, release, signature, deployment, hosted
  configuration, provider call, paid operation, or customer-data action has
  been performed in this task.

## Fixed delivery order

1. Freeze and locally verify the Dashboard authority/catalog tree.
2. Obtain separate user authorization for Dashboard commit, push, and PR.
3. Merge the Dashboard PR first.
4. Update backend `main`.
5. Prepare the paired backend stable pointer, machine-readable manifest,
   EEM-3 global-lock attestation, executable cross-repository verification, and
   index/current-state updates.
6. Obtain separate user authorization for the backend publication actions.
7. Merge the backend PR.

EEM-9/01 is complete only after both merges and a non-contradictory lock
attestation. EEM-9/02 and EEM-4 remain out of scope.

## Security and release state

- Public Sigstore/Fulcio and Rekor are the selected keyless attestation trust
  service.
- `SEC-2026-012` is open under the user-approved GitHub Free bootstrap waiver.
- The dedicated GitHub API check reports immutable releases are not enabled.
  The release workflow therefore fails closed before signing or publication.
- Technical Design Partner Ready remains blocked until repository and immutable
  release enforcement evidence exists.
- The Auth/session contract is frozen at JWT 15m, visible-tab human idle 30m
  with a 5m warning, touch coalescing 1m, absolute application session 8h,
  maximum three sessions with explicit oldest-session replacement, dangerous
  operation reauthentication 10m, OTP 10m, and resend cooldown 60s.

## Next action

Obtain explicit authorization before creating the Dashboard commit, pushing
the branch, or opening its PR. Merge the Dashboard PR before beginning the
paired backend pointer/attestation half.

Local evidence: 37 bootstrap tests passed; 392 acceptance rows, 212 selected
ASVS Level 2 rows, and 12 `SEC-WEB` rows verified; documentation, generated
authority, repository secret-pattern, JSON-compatible document, workflow YAML,
marker/whitespace, manifest, and 50-member deterministic archive checks passed.
Local `gitleaks` and `actionlint` executables were unavailable; the repository
scanner plus Ruby YAML parsing and full-SHA workflow tests were used.
