# Dashboard handoff

Updated: 2026-08-27

## Current state

- Active task: EEM-9/01 authority catalog remediation.
- Branch: `EEM-9/01-dashboard-catalog-remediation`, based on merged Dashboard
  PR [#1](https://github.com/Evirion/evirion-engineering-memory-dashboard/pull/1)
  commit `6a489ccb84ce3bd0b17e0d42b983f8d15d238cef`.
- PR #1 moved the accepted authority package into this repository with
  content-set package digest
  `c0ff6f5e75de706ab301328947e519de762c030b40923d60a93783755b02b089`.
  That package remains immutable historical evidence but cannot be pinned by
  the backend because its copy-ready catalog conflicts with the controlling
  full plan.
- The accepted resolution is to keep the full EEM-9 plan controlling and
  correct only the catalog/current-state authority around it. The local
  remediation restores the exact `/01`–`/10` aliases and adds an executable
  alias-parity regression.
- The paired backend pointer work is paused with local uncommitted changes. It
  must pin the remediation merge commit and successor package digest, not PR
  #1's superseded package.

## Fixed delivery order

1. Regenerate and mechanically verify the corrected Dashboard authority
   manifest.
2. Obtain separate user authorization before commit, push, or PR creation.
3. Merge the Dashboard catalog-remediation PR.
4. Update Dashboard `main`.
5. Resume the paired backend branch and pin the corrected Dashboard
   commit/tree/manifest/package.
6. Obtain separate user authorization before backend commit, push, or PR
   creation.
7. Merge the backend pointer/global-lock-attestation PR.

EEM-9/01 is complete only after both corrective delivery steps and the backend
merge. EEM-4/01 and EEM-9/02 remain blocked. No adjacent EEM task has started.

## Security and release state

- Public Sigstore/Fulcio and Rekor remain the selected keyless attestation
  trust service.
- `SEC-2026-012` remains open under the approved GitHub Free bootstrap waiver.
- Immutable releases are not enabled. The release workflow therefore fails
  closed before signing or publication.
- Technical Design Partner Ready remains blocked until repository and
  immutable-release enforcement evidence exists.
- The Auth/session contract remains frozen at JWT 15m, visible-tab human idle
  30m with a 5m warning, touch coalescing 1m, absolute application session 8h,
  maximum three sessions with explicit oldest-session replacement,
  dangerous-operation reauthentication 10m, OTP 10m, and resend cooldown 60s.

## Verification and next action

The focused alias-parity regression passed. Because this remediation changes
only tracked authority/current-state files and their regression, no broad
Dashboard, backend, PostgreSQL, Supabase, runtime, container, security, paid,
or remote gate ran. The corrected authority manifest was regenerated and
mechanically verified.

Commit/push/PR/merge authorization has been granted for this remediation.
After Git confirms its merge, update local Dashboard `main` and resume the
paired backend pointer against the remediation merge commit and package digest.
No release, signature, deployment, hosted configuration, provider call, paid
operation, or customer-data action is authorized.
