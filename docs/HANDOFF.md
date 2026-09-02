# Dashboard handoff

Updated: 2026-09-02

## Current state

- Active task: EEM-9/01b, the Dashboard half of a paired three-pull-request
  subtask.
- Branch: `EEM-9/01b-console-contract-lock`, based on Dashboard `main` at
  `773f3af`, which merged PR
  [#2](https://github.com/Evirion/evirion-engineering-memory-dashboard/pull/2).
- Backend PR 1,
  [#51](https://github.com/Evirion/evirion-engineering-memory/pull/51), merged
  at `4004e5837ad1a98cdfa8a07ffea201adf00ce252` and published
  `console-contract-v1.0` as an immutable signed release.
- This pull request is PR 2. It consumes those published bytes and corrects the
  EEM-9/01 artifacts that consumption proved unexecutable. PR 3 is the backend
  successor pointer that re-pins this repository.

## What changed here and why

- The frozen `docs/security/artifact-attestation.md` and
  `.github/workflows/authority-release.yml` both required
  `repos/{owner}/{repo}/immutable-releases`. That endpoint requires admin read
  access, the GitHub Actions permissions surface has no `administration` scope,
  and backend run 33611371573 proved it with `Resource not accessible by
  integration (HTTP 403)`. A check that can never succeed and must fail closed
  forbids publication permanently, so `dashboard-authority-v*` could not publish
  either. Backend ADR 0013 attributes this correction to the successor pointer;
  both defective files are owned here, so the correction is made here and PR 3
  re-pins the result.
- Immutability is now proved by a tracked, tag-scoped administrator attestation
  checked before signing and by `immutable == true` on the published release.
  The release workflow attaches assets to a draft and publishes afterwards.
- Offline verification now uses a pinned Sigstore trusted root, because Cosign
  v3 deprecates `--offline` and otherwise fetches that root over the network.
- The trust policy carries a second artifact entry for the backend contract, the
  contract is pinned by `docs/contracts/console-contract-lock.json`, and the
  generated client is produced from exactly the pinned asset bytes.
- Rationale is recorded in
  [ADR-0002](decisions/0002-console-contract-consumption-and-immutability-evidence.md).

## Fixed delivery order

1. Review and merge this Dashboard pull request.
2. Update Dashboard `main`.
3. Prepare backend PR 3, the successor pointer, pinning this merge commit, the
   corrected artifacts, and the new authority package digest stated in this
   pull request's body.
4. Obtain separate user authorization before any backend commit, push, or pull
   request.
5. Merge backend PR 3.

EEM-9/01b is complete only after PR 3 merges. EEM-9/02 remains blocked until
then.

## Security and release state

- Public Sigstore/Fulcio and Rekor remain the selected keyless attestation trust
  service.
- `SEC-2026-012` remains open under the approved GitHub Free bootstrap waiver
  and remains readiness-blocking. It concerns ruleset-based governance and is
  unrelated to the immutability correction above.
- Repository immutable-release policy is enabled on both repositories, observed
  with an administrator-authenticated read.
- No Dashboard administrator attestation is committed, because no Dashboard
  release is authorized or prepared. `authority-release.yml` therefore still
  fails closed before signing.
- Technical Design Partner Ready remains blocked until repository-governance
  enforcement evidence exists.
- The Auth/session contract remains frozen at JWT 15m, visible-tab human idle
  30m with a 5m warning, touch coalescing 1m, absolute application session 8h,
  maximum three sessions with explicit oldest-session replacement,
  dangerous-operation reauthentication 10m, OTP 10m, and resend cooldown 60s.

## Verification and next action

The published release was verified offline with the pinned
`cosign-linux-amd64` under network isolation against the exact certificate
identity, GitHub Actions issuer, repository, tag ref, source commit, and `push`
trigger, together with Rekor inclusion and the frozen signing-to-release bound.
Every case in the negative-evidence fixture rejects for both artifact entries.
The bootstrap and contract suites, documentation, generated authorities,
authority manifest, secret scan, deterministic packaging, and the Console
contract lock all pass locally.

No release, signature, tag, deployment, hosted configuration, provider call,
paid operation, or customer-data action is authorized. Commit, push, pull
request, and merge each require separate explicit authorization.
