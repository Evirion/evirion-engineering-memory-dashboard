# Authority and contract artifact attestation

Status: policy amended 2026-09-03 for EEM-9/03e. Two artifacts are published and
one is consumed: the backend Console contract releases `console-contract-v1.0`
and `console-contract-v1.0.1`, of which the revision is the one this repository
pins. No `dashboard-authority-v*` artifact has been published.

## Trust boundary

Authority and backend contract packages are deterministic, content-addressed
archives. A GitHub Actions tag workflow signs exact package bytes keylessly
through GitHub OIDC, public Fulcio, and public Rekor. Consumers trust only
evidence that matches the frozen
[machine-readable policy](artifact-attestation-policy.json), which now carries
one entry per artifact: `dashboard-authority-v1` produced here, and
`console-contract-v1` consumed from `Evirion/evirion-engineering-memory`.

Public Rekor receives signature metadata, signer identity, timestamps, and
digests. It must never receive requirements contents, customer/source payloads,
model responses, credentials, secrets, or private generated runtime output.

## Protected publication

The release workflow:

1. accepts only its own frozen tag namespace;
2. verifies that the tag resolves to the checked-out full source commit;
3. requires a tracked, tag-scoped administrator attestation of repository
   immutable-release policy before anything is signed;
4. reruns the frozen verification suite for the repository;
5. builds the archive twice with fixed path order, metadata, owner, group, and
   timestamp, then requires identical SHA-256 values;
6. refuses to replace an existing release for the tag;
7. signs the exact archive with pinned Cosign through GitHub OIDC and requires a
   Rekor inclusion proof with a checkpoint and a positive integrated time;
8. creates the release as a draft, attaches both assets, and matches the
   uploaded archive digest against the signed digest while the release is still
   mutable;
9. publishes the draft and only then requires `immutable == true` on the release
   object together with an asset inventory identical to the draft's;
10. records release asset IDs/digests, source commit, attested immutability
    time, and observed immutability in the payload-free workflow summary. The
    policy separately pins workflow identity, policy digest, trusted root, and
    verifier.

Action references and the Linux Cosign binary are pinned by full digest. A
workflow edit changes the certificate identity and authority package manifest,
so it requires normal review plus regenerated immutable evidence.

### Why immutability is proved this way

`repos/{owner}/{repo}/immutable-releases` is documented as requiring admin read
access. The GitHub Actions `permissions:` surface has no `administration` scope,
so an ephemeral workflow token can never satisfy it under any configuration.
Backend run
[33611371573](https://github.com/Evirion/evirion-engineering-memory/actions/runs/33611371573)
proved this rather than assuming it, stopping at that exact call with
`Resource not accessible by integration (HTTP 403)` before anything was built,
signed, or published.

Earlier text in this document required the workflow to call that endpoint and
fail closed while the answer was unavailable. Taken literally, that forbade
publication permanently in both repositories. Backend
[ADR 0013](https://github.com/Evirion/evirion-engineering-memory/blob/main/docs/decisions/0013-immutable-release-evidence-before-signing.md)
replaced it for the backend and attributed the Dashboard correction to the
successor pointer; both defective files are owned here, so they are corrected
here and the pointer re-pins the result. See
[ADR 0002](../decisions/0002-console-contract-consumption-and-immutability-evidence.md).

Two checks now stand in its place, and neither is sufficient alone:

- **Before signing**, a tracked administrator attestation at
  `docs/security/immutable-release-attestation.json` must declare schema version
  `1.0`, this repository, `immutableReleasesEnabled: true`, and the exact tag
  being released. Its `observedAt` must be no older than 24 hours and not
  post-dated by more than 300 seconds of clock skew. It is tag-scoped by
  construction, so it cannot be reused for a later release, and it must be
  committed in the same reviewed change that carries the release. It never
  contains a token, a response header, or a personal identifier; `observedBy` is
  a role.
- **After publishing**, `immutable == true` is required on the release object
  itself. That field is readable with `contents` permission, is produced by
  GitHub rather than by us, and is the authoritative statement that this
  specific release is immutable. It closes the window between the
  administrator's observation and the run.

An administration-scoped repository secret was rejected. It would restore the
literal endpoint call, but `SEC-2026-012` is open, so the workflow-change path
is not enforced by rulesets or required review, and a standing admin-read
credential behind an unenforced change path is a real escalation path.

### Governance state

The repository is private on GitHub Free. API evidence shows ruleset enforcement
is unavailable, so `SEC-2026-012` remains open under its approved waiver and
remains readiness-blocking. That finding is about branch and workflow governance
and is unrelated to the immutability correction above. Repository
immutable-release policy is now enabled on both repositories, verified by an
administrator-authenticated read that returns
`{"enabled": true, "enforced_by_owner": false}`.

### A contract release tag may carry a revision

The `console-contract-v1` entry admits an optional third tag component:

```
^refs/tags/console-contract-v[0-9]+\.[0-9]+(\.[1-9][0-9]*)?$
```

Backend
[ADR 0014](https://github.com/Evirion/evirion-engineering-memory/blob/main/docs/decisions/0014-contract-release-revisions.md)
owns that grammar, because the publishing workflow enforces it before signing;
this policy mirrors it so a consumer can verify what the backend can publish.
The revision identifies the publication, never the API, so a revision leaves
`contractVersion` alone and a consumer's pinned envelope guards keep matching.

`console-contract-v1.0.0` stays refused, so a first release is spelled without a
revision and one set of bytes keeps exactly one tag. A revision is only valid for
bytes the backend workflow already proved additive against the published
predecessor of the same version.

This widens which tags may be verified. It does not widen anything else, and it
does not let a consumer follow a version: the lock still names one exact tag,
asset ID and digest. See
[ADR-0002](../decisions/0002-console-contract-consumption-and-immutability-evidence.md)
and
[ADR-0005](../decisions/0005-console-contract-release-revisions.md).

### Release tags are not required to be reachable

Both published contract releases tag a branch commit that the squash merge did
not place on backend `main`: `console-contract-v1.0` at `20cd3b60` and
`console-contract-v1.0.1` at `2458f333`. Each object survives because an
immutable release locks its tag. Reachability from a default branch is therefore
not evidence of anything and must not be added as a check; the policy records
`releaseCommitReachableFromDefaultBranchRequired: false` and the verifier
refuses a policy that sets it true.

## Consumer verification

Consumers must receive the expected source commit, release archive SHA-256,
policy digest, release tag, and release asset ID from an independent, tracked
pointer. In this repository that pointer is
[`docs/contracts/console-contract-lock.json`](../contracts/console-contract-lock.json).
This archive digest is distinct from the contract manifest's `packageSha256`
content-set digest. Consumers then:

1. download the exact release asset by repository, tag, asset name, and asset
   ID with a short-lived minimum-scope credential that lives only in the process
   environment;
2. hash the asset and compare the independently pinned digest;
3. hash the pinned Cosign binary and the pinned Sigstore trusted root and
   compare the policy;
4. run `cosign verify-blob` with the pinned trusted root and no network access
   against the supplied Sigstore bundle, exact certificate identity, GitHub
   Actions issuer, repository, tag ref, source commit, and `push` trigger
   claims;
5. verify Rekor inclusion, a valid log UUID, and signing-to-release time within
   the frozen one-hour maximum;
6. verify the tag-scoped administrator attestation and the published release's
   `immutable` flag;
7. extract only after all checks pass, rejecting links, traversal, unexpected
   members, duplicate paths, and manifest drift;
8. record the verified repository, commit, package digest, policy digest,
   release identity, and verification time.

Cosign v3 verifies a v0.3 Sigstore bundle against a trusted root rather than the
deprecated `--offline` flag, and it fetches that root over the network unless
one is supplied. Offline verification therefore requires the pinned
[trusted root](sigstore-trusted-root.json), materialized once through the
Sigstore TUF client and pinned by digest in the policy. Refreshing it is a
reviewed change, because it is a frozen manifest member.

No mismatch may be repaired by downloading `main`, accepting a newer artifact,
rewriting the expected digest, or regenerating the consumer pointer.

## Required negative evidence

The executable fixture covers every artifact entry and rejects:

- replaced asset bytes or asset digest;
- a release whose `immutable` field is false or absent;
- wrong repository, workflow, tag namespace, source commit, or OIDC issuer;
- a tag outside the admitted grammar, including a `.0` revision, a fourth
  component, a missing minor, a trailing separator, a leading-zero revision, and
  a pre-release suffix;
- wrong release tag/asset identity, subject digest, unregistered policy id,
  stale policy, or stale Rekor-to-release time;
- an unpinned verifier or an unpinned trusted root;
- missing Rekor inclusion proof;
- an unverified Sigstore bundle;
- a missing administrator attestation;
- an administrator attestation older than 24 hours;
- an administrator attestation post-dated beyond the 300-second clock-skew
  allowance;
- an administrator attestation naming a different tag or a different
  repository, or denying that immutable releases are enabled.

Any such event is a security incident. Preserve evidence, stop rollout, revoke
the affected pointer or release through a new append-only record, and never
silently replace historical bytes.
