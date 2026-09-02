# ADR-0002: Console contract consumption and executable immutability evidence

Status: accepted
Date: 2026-09-02
Owners: EEM-9/01b

## Context

The backend published `console-contract-v1.0` as an immutable, signed release on
2026-09-02, under backend
[ADR 0012](https://github.com/Evirion/evirion-engineering-memory/blob/main/docs/decisions/0012-console-contract-release-signing.md)
and
[ADR 0013](https://github.com/Evirion/evirion-engineering-memory/blob/main/docs/decisions/0013-immutable-release-evidence-before-signing.md).
Consuming it exposed three defects in the artifacts EEM-9/01 froze here.

**The immutability check could never run.** Frozen publication step 5 required
the workflow to call `repos/{owner}/{repo}/immutable-releases`, and
`authority-release.yml` made that call. GitHub documents the endpoint as
requiring admin read access, and the Actions `permissions:` surface has no
`administration` scope. Backend run 33611371573 proved it with
`Resource not accessible by integration (HTTP 403)`. A check that can never
succeed and must fail closed forbids publication permanently, so
`dashboard-authority-v*` could not publish either. Backend ADR 0013 says the
successor pointer corrects this. That is imprecise: both defective files live in
this repository, so the correction belongs in this pull request and the pointer
re-pins the result.

**Publishing before attaching assets could not work either.** With immutable
releases enabled, publication freezes the asset set. `softprops/action-gh-release`
created a published release and then uploaded to it. The backend workflow proved
the working order: create a draft, attach both assets, verify the uploaded
archive digest while the release is still mutable, then publish.

**Offline verification needed a trusted root.** Frozen consumer step 4 required
`cosign verify-blob --offline`. Cosign v3.1.3 deprecates that flag and verifies a
v0.3 bundle against a trusted root, fetching one over the network when none is
supplied. Run under network isolation, the pinned verifier failed at TUF refresh
rather than at any signature check.

The trust policy also described exactly one artifact and could not name a second
repository, tag namespace, or workflow path.

## Decision

Immutable-release evidence is proved by a tracked, tag-scoped administrator
attestation checked before signing, bounded at 24 hours with a 300-second
clock-skew allowance, plus `immutable == true` asserted on the published release
object with `contents` permission. Neither is sufficient alone: the attestation
is an observation that could go stale between recording and running, and the
published flag arrives only after the signature is already public in Rekor.
`authority-release.yml` adopts the same draft-then-publish order the backend
workflow uses.

The trust policy becomes a map of artifact entries keyed by policy id. The
`dashboard-authority-v1` entry keeps every field and value it already had; a
`console-contract-v1` entry names `Evirion/evirion-engineering-memory`, its
`refs/tags/console-contract-v` prefix, its workflow path, and the same verifier
pins. Evidence names the entry it claims, and the caller pins the expected id,
so an unregistered id fails closed instead of selecting a weaker entry.

Offline verification uses a Sigstore trusted root materialized once through the
TUF client and pinned by digest in the policy and the contract lock.

The consumed contract is pinned by
[`docs/contracts/console-contract-lock.json`](../contracts/console-contract-lock.json).
The exact release asset and its extracted members are vendored, and the
generated TypeScript types and runtime validators are produced from those bytes
by `scripts/generate_console_client.py`. Mutable backend `main` is never a
source.

Default-branch reachability of the signing commit is deliberately not checked.

## Consequences

- The Dashboard trust policy, the attestation document, the release workflow,
  the verifier, and the negative-evidence fixture all change, so the authority
  `packageSha256` moves and the paired backend successor pointer must re-pin it.
- `authority-release.yml` fails closed until an administrator records
  `docs/security/immutable-release-attestation.json` for the exact tag in the
  same reviewed commit as the release. No such file is committed here, because
  no Dashboard release is authorized or prepared.
- Pinning a trusted root trades TUF freshness for offline verification.
  Revocation published after the pin is not observed until the root is
  refreshed, which is a reviewed change because the root is a manifest member.
- The generated client is byte-reproducible from the pinned asset and its export
  surface is pinned, so a backend contract change cannot reach the Console
  without a reviewed lock change. Only the model layer is generated; operation
  binding belongs to the BFF work, and `contracts/operator/v1` travels in the
  archive but is not consumed.
- `softprops/action-gh-release` is no longer used and its pin leaves the
  toolchain baseline.
- `SEC-2026-012` is unaffected. It concerns ruleset-based governance on GitHub
  Free, remains open under its approved waiver, and remains readiness-blocking.

## Alternatives rejected

- **An administration-scoped repository secret.** It restores the literal
  endpoint call, but with `SEC-2026-012` open the workflow-change path is not
  enforced, so a standing admin-read credential becomes a real escalation path.
- **Asserting immutability only after publication.** Simplest, and the published
  flag is the only authoritative signal, but a disabled setting would then be
  discovered after the artifact was signed and its metadata was permanently
  public in Rekor.
- **Verifying with a live TUF fetch instead of a pinned root.** Keeps revocation
  freshness and abandons offline verification, which the frozen policy requires
  and which a release-blocking gate should not depend on network reachability
  for.
- **Generating the client from the backend sibling checkout or from `main`.**
  Rejected because the accepted program design states that mutable `main` bytes
  are not a release contract.
- **Downloading the asset in CI instead of vendoring it.** The Dashboard's
  workflow token cannot read the backend repository, so every pull request would
  either need a standing cross-repository credential or lose the reproducibility
  gate entirely. The asset is vendored and digest-pinned instead, and the
  credentialed re-download runs in a separate manual workflow.
