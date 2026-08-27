# Authority and contract artifact attestation

Status: policy frozen for EEM-9/01; no artifact has been published.

## Trust boundary

Authority and later backend contract packages are deterministic, content-
addressed archives. A GitHub Actions tag workflow signs exact package bytes
keylessly through GitHub OIDC, public Fulcio, and public Rekor. Consumers trust
only evidence that matches the frozen
[machine-readable policy](artifact-attestation-policy.json).

Public Rekor receives signature metadata, signer identity, timestamps, and
digests. It must never receive requirements contents, customer/source payloads,
model responses, credentials, secrets, or private generated runtime output.

## Protected publication

The release workflow:

1. accepts only `dashboard-authority-v*` tag refs;
2. verifies that the tag resolves to the checked-out full source commit;
3. reruns documentation, acceptance, ASVS, workflow, and authority checks;
4. builds the archive twice with fixed path order, metadata, owner, group, and
   timestamp, then requires identical SHA-256 values;
5. requires repository immutable-release evidence before publication;
6. signs the exact archive with pinned Cosign through GitHub OIDC;
7. creates the release without replacing an existing tag or asset;
8. publishes the Sigstore bundle containing Rekor proof and records release
   asset IDs/digests, source commit, and immutable status in the payload-free
   workflow summary. The policy separately pins workflow identity, policy
   digest, and verifier.

Action references and the Linux Cosign binary are pinned by full digest. A
workflow edit changes the certificate identity and authority package manifest,
so it requires normal review plus regenerated immutable evidence.

The repository is currently private on GitHub Free. API evidence shows ruleset
enforcement is unavailable and immutable releases are not enabled.
`SEC-2026-012` therefore remains open. The workflow calls the dedicated
immutable-release policy endpoint before signing or publishing and must fail
closed while that check is unavailable or false. Local package construction
and negative policy tests are permitted.

## Consumer verification

Consumers must receive the expected source commit, release archive SHA-256,
policy digest, release tag, and release asset ID from an independent, tracked
pointer. This archive digest is distinct from the authority manifest's
`packageSha256` content-set digest. They then:

1. download the exact release asset by repository, tag, asset name, and asset
   ID with a short-lived minimum-scope credential;
2. hash the asset and compare the independently pinned digest;
3. hash the pinned Cosign binary and compare the policy;
4. run offline `cosign verify-blob` against the supplied Sigstore bundle, exact
   certificate identity, GitHub Actions issuer, repository, tag ref, source
   commit, and `push` trigger claims;
5. verify Rekor inclusion, a valid log UUID, and signing-to-release time within
   the frozen one-hour maximum;
6. extract only after all checks pass, rejecting links, traversal, unexpected
   members, duplicate paths, and manifest drift;
7. record the verified repository, commit, package digest, policy digest,
   release identity, and verification time.

No mismatch may be repaired by downloading `main`, accepting a newer artifact,
rewriting the expected digest, or regenerating the consumer pointer.

## Required negative evidence

The executable fixture rejects:

- replaced asset bytes or asset digest;
- mutable/unproved release evidence;
- wrong repository, workflow, tag namespace, source commit, or OIDC issuer;
- wrong release tag/asset identity, subject digest, stale policy, or stale
  Rekor-to-release time;
- unpinned verifier;
- missing Rekor inclusion proof;
- an unverified Sigstore bundle.

Any such event is a security incident. Preserve evidence, stop rollout, revoke
the affected pointer or release through a new append-only record, and never
silently replace historical bytes.
