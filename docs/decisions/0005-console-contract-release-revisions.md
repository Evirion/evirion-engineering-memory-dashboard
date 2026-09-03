# ADR-0005: The consumer trust policy mirrors the backend contract revision tag grammar

Status: accepted
Date: 2026-09-03
Owners: EEM-9/03e

## Context

The backend published `console-contract-v1.0.1`, the first release carrying a
tag revision. Backend
[ADR 0014](https://github.com/Evirion/evirion-engineering-memory/blob/main/docs/decisions/0014-contract-release-revisions.md)
decided that grammar: a release tag may carry an optional third component, so
contract `1.0` can publish additively compatible bytes without moving the API
version that every envelope carries and that this repository pins in two places.

This repository could not verify such a release. The frozen
[trust policy](../security/artifact-attestation-policy.json) pinned

```
^refs/tags/console-contract-v[0-9]+\.[0-9]+$
```

for the `console-contract-v1` entry, and
[`verify_artifact_attestation.py`](../../scripts/verify_artifact_attestation.py)
requires `signer.ref` to match it in full. Verifying the published revision
raised `signer.ref does not match the frozen tag pattern`, and because
`check_console_contract_lock` reaches that check through the recorded evidence,
the offline gate refused the release before any consumption question arose.

The refusal was correct for the policy as written and wrong about the world: the
release is signed, immutable, has a valid Rekor inclusion proof, and its bytes
are additively compatible by the backend workflow's own pre-signing comparison.

## Decision

The `console-contract-v1` entry admits an optional revision component:

```
^refs/tags/console-contract-v[0-9]+\.[0-9]+(\.[1-9][0-9]*)?$
```

**The backend release workflow is the source of this grammar and this policy is
a mirror.** The two are written separately, in different languages, in different
repositories. That is a drift risk, so
`test_the_grammar_mirrors_the_backend_release_workflow` compares this
repository's pattern against the literal it is meant to mirror, and a change on
either side that is not made on both fails here.

Every other refusal in the policy is unchanged. The `dashboard-authority-v1`
entry, the verifier pins, the trusted root, the immutability evidence bounds,
the signing-to-release maximum, and the default-branch reachability refusal are
all untouched. The `artifactName` and `bundleName` templates gain the optional
component so they continue to describe the names the policy actually admits.

Widening the pattern moves `policyDigest`, which the contract lock and the
recorded evidence both pin, so all three move in the same commit. The evidence
value is re-observed rather than edited: `console-contract-v1.0` was verified
again, against the amended policy, before its recorded digest changed.

## Consequences

- `console-contract-v1.0` remains verifiable. The widening is strictly additive
  over tag shapes, proved by
  `test_a_version_or_a_revision_tag_is_admitted` and
  `test_every_other_tag_shape_stays_refused`.
- `console-contract-v1.0.0` stays refused, so a first release keeps exactly one
  spelling and one set of bytes keeps exactly one tag. `v1.0.1.1`, `v1`,
  `v1.0-rc1`, `v1.0.`, `v.1` and a leading-zero revision stay refused, and a
  foreign namespace is still refused by `refPrefix` before the pattern runs.
- A consumer still pins one exact tag, asset ID and digest. Nothing here lets
  this repository track "the latest contract 1.0"; the lock names one release.
- The version-coupling hazard the backend recorded is unchanged and is the
  reason this decision exists. A revision keeps `contractVersion` at `1.0`, so
  the generated `isConsoleError` const and the success-envelope guard in
  `src/server/adapters/console-api.ts` are not touched by consuming one.

## Alternatives rejected

- **Check only `refPrefix` and drop the full match.** It would accept
  `refs/tags/console-contract-vanything`. That removes the control rather than
  relaxing it, and the prefix was never intended to carry the grammar.
- **Amend the policy in a separate earlier pull request.** The lock and the
  recorded evidence pin `policyDigest`, so a policy-only change lands a tree
  whose own gate fails, on the default branch rather than on a branch. It would
  also merge a widened trust boundary with nothing published that exercises it.
- **Ask the backend to republish under a two-component tag.** A published
  release is immutable and cannot be replaced, and the version cannot move
  without breaking every pinned consumer. That is the problem ADR 0014 solved.
