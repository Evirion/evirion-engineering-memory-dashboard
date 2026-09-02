from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


class AttestationPolicyError(ValueError):
    """Raised when signed artifact evidence violates the frozen trust policy."""


SHA256 = re.compile(r"^[0-9a-f]{64}$")
COMMIT = re.compile(r"^[0-9a-f]{40}$")
UTC_INSTANT = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")


def _object(parent: dict[str, Any], key: str) -> dict[str, Any]:
    value = parent.get(key)
    if not isinstance(value, dict):
        raise AttestationPolicyError(f"{key} must be an object")
    return value


def _exact(actual: Any, expected: Any, field: str) -> None:
    if actual != expected:
        raise AttestationPolicyError(f"{field} does not match frozen policy")


def _valid_digest(value: Any, field: str) -> str:
    if not isinstance(value, str) or SHA256.fullmatch(value) is None:
        raise AttestationPolicyError(f"{field} must be a pinned SHA-256")
    return value


def _utc_epoch(value: Any, field: str) -> int:
    if not isinstance(value, str) or UTC_INSTANT.fullmatch(value) is None:
        raise AttestationPolicyError(f"{field} must be a UTC RFC 3339 second instant")
    return int(
        datetime.strptime(value, "%Y-%m-%dT%H:%M:%SZ")
        .replace(tzinfo=timezone.utc)
        .timestamp()
    )


def _positive_int(value: Any, field: str) -> int:
    if not isinstance(value, int) or isinstance(value, bool) or value <= 0:
        raise AttestationPolicyError(f"{field} must be a positive integer")
    return value


def compute_policy_digest(policy: dict[str, Any]) -> str:
    digest_input = {key: value for key, value in policy.items() if key != "policyDigest"}
    canonical = (
        json.dumps(
            digest_input,
            ensure_ascii=False,
            separators=(",", ":"),
            sort_keys=True,
        )
        + "\n"
    ).encode()
    return hashlib.sha256(canonical).hexdigest()


def select_artifact_policy(policy: dict[str, Any], policy_id: str) -> dict[str, Any]:
    artifacts = _object(policy, "artifacts")
    entry = artifacts.get(policy_id)
    if not isinstance(entry, dict):
        raise AttestationPolicyError(f"unknown artifact policy id: {policy_id}")
    return entry


def _validate_immutable_release_evidence(
    policy: dict[str, Any],
    evidence: dict[str, Any],
    *,
    repository: Any,
    expected_release_tag: str,
    published_at: int,
) -> None:
    immutability_policy = _object(policy, "immutableReleaseEvidence")
    if immutability_policy.get("preSigningAdministratorAttestationRequired") is not True:
        raise AttestationPolicyError(
            "policy must require a pre-signing administrator attestation"
        )
    if immutability_policy.get("postPublicationReleaseImmutableRequired") is not True:
        raise AttestationPolicyError(
            "policy must require post-publication release immutability"
        )
    if immutability_policy.get("tagScoped") is not True:
        raise AttestationPolicyError("policy must require a tag-scoped attestation")
    maximum_age = _positive_int(
        immutability_policy.get("maximumAttestationAgeSeconds"),
        "maximumAttestationAgeSeconds",
    )
    maximum_skew = _positive_int(
        immutability_policy.get("maximumClockSkewSeconds"),
        "maximumClockSkewSeconds",
    )

    attestation = _object(evidence, "immutableReleaseAttestation")
    _exact(attestation.get("schemaVersion"), "1.0", "attestation schemaVersion")
    _exact(attestation.get("repository"), repository, "attestation repository")
    _exact(attestation.get("tag"), expected_release_tag, "attestation tag")
    if attestation.get("immutableReleasesEnabled") is not True:
        raise AttestationPolicyError(
            "attestation must state that immutable releases are enabled"
        )
    attested_at = _utc_epoch(attestation.get("attestedAt"), "attestation attestedAt")
    age = published_at - attested_at
    if age > maximum_age:
        raise AttestationPolicyError("administrator attestation is stale")
    if age < -maximum_skew:
        raise AttestationPolicyError(
            "administrator attestation is post-dated beyond the clock-skew allowance"
        )


def validate_attestation_evidence(
    policy: dict[str, Any],
    evidence: dict[str, Any],
    *,
    expected_policy_id: str,
    expected_subject_sha256: str,
    expected_source_commit: str,
    expected_policy_digest: str,
    expected_release_tag: str,
    expected_release_asset_id: int,
) -> None:
    _exact(policy.get("schemaVersion"), "1.0", "policy schemaVersion")
    _exact(evidence.get("schemaVersion"), "1.0", "evidence schemaVersion")
    _exact(evidence.get("policyId"), expected_policy_id, "policyId")
    policy_digest = _valid_digest(policy.get("policyDigest"), "policyDigest")
    _exact(policy_digest, compute_policy_digest(policy), "policyDigest")
    _exact(
        policy_digest,
        _valid_digest(expected_policy_digest, "expected policyDigest"),
        "policyDigest",
    )
    _exact(evidence.get("policyDigest"), policy_digest, "policyDigest")
    _valid_digest(expected_subject_sha256, "expected subject digest")
    if COMMIT.fullmatch(expected_source_commit) is None:
        raise AttestationPolicyError("expected source commit must be a full SHA")
    if not expected_release_tag:
        raise AttestationPolicyError("expected release tag must be non-empty")
    if not isinstance(expected_release_asset_id, int) or expected_release_asset_id <= 0:
        raise AttestationPolicyError(
            "expected release asset ID must be a positive integer"
        )

    artifact_policy = select_artifact_policy(policy, expected_policy_id)
    publication_policy = _object(policy, "publication")
    trusted_root_policy = _object(policy, "trustedRoot")
    subject = _object(evidence, "subject")
    signer = _object(evidence, "signer")
    release = _object(evidence, "release")
    rekor = _object(evidence, "rekor")
    verifier = _object(evidence, "verifier")
    cryptographic = _object(evidence, "cryptographicVerification")
    verifier_policy = _object(artifact_policy, "verifier")

    # The signing tag points at the exact commit that was built. An immutable
    # release keeps that object alive, so no consumer check may require it to be
    # reachable from the publishing repository's default branch.
    if publication_policy.get("releaseCommitReachableFromDefaultBranchRequired") is True:
        raise AttestationPolicyError(
            "this verifier cannot prove default-branch reachability and must not "
            "accept a policy that requires it"
        )

    subject_digest = _valid_digest(subject.get("sha256"), "subject.sha256")
    _exact(subject_digest, expected_subject_sha256, "subject.sha256")
    _exact(subject.get("name"), f"{expected_release_tag}.tar.gz", "subject.name")
    _exact(release.get("assetSha256"), subject_digest, "release.assetSha256")
    _exact(release.get("tag"), expected_release_tag, "release.tag")
    _exact(
        release.get("assetName"),
        subject.get("name"),
        "release.assetName",
    )
    if release.get("immutable") is not True:
        raise AttestationPolicyError("release must be immutable")
    _exact(release.get("assetId"), expected_release_asset_id, "release.assetId")
    if publication_policy.get("githubImmutableReleaseRequired") is not True:
        raise AttestationPolicyError("policy must require GitHub immutable releases")
    maximum_signing_delay = _positive_int(
        publication_policy.get("maximumSigningToReleaseSeconds"),
        "maximumSigningToReleaseSeconds",
    )

    repository = artifact_policy.get("repository")
    workflow_path = artifact_policy.get("workflowPath")
    oidc_issuer = artifact_policy.get("oidcIssuer")
    ref_prefix = artifact_policy.get("refPrefix")
    ref_pattern = artifact_policy.get("refPattern")
    event_name = artifact_policy.get("eventName")
    for value, field in (
        (repository, "artifact.repository"),
        (workflow_path, "artifact.workflowPath"),
        (oidc_issuer, "artifact.oidcIssuer"),
        (ref_prefix, "artifact.refPrefix"),
        (ref_pattern, "artifact.refPattern"),
        (event_name, "artifact.eventName"),
    ):
        if not isinstance(value, str) or not value:
            raise AttestationPolicyError(f"{field} must be non-empty")

    _exact(signer.get("repository"), repository, "signer.repository")
    _exact(signer.get("workflowPath"), workflow_path, "signer.workflowPath")
    _exact(signer.get("oidcIssuer"), oidc_issuer, "signer.oidcIssuer")
    _exact(signer.get("eventName"), event_name, "signer.eventName")
    signer_ref = signer.get("ref")
    if not isinstance(signer_ref, str) or not signer_ref.startswith(ref_prefix):
        raise AttestationPolicyError("signer.ref is outside the frozen tag namespace")
    try:
        matches_ref_pattern = re.fullmatch(ref_pattern, signer_ref) is not None
    except re.error as exc:
        raise AttestationPolicyError("artifact.refPattern is invalid") from exc
    if not matches_ref_pattern:
        raise AttestationPolicyError("signer.ref does not match the frozen tag pattern")
    _exact(signer_ref, f"refs/tags/{expected_release_tag}", "signer.ref")
    _exact(signer.get("commit"), expected_source_commit, "signer.commit")
    if COMMIT.fullmatch(str(signer.get("commit"))) is None:
        raise AttestationPolicyError("signer.commit must be a full SHA")

    expected_identity = (
        f"https://github.com/{repository}/{workflow_path}@{signer_ref}"
    )
    _exact(
        cryptographic.get("certificateIdentity"),
        expected_identity,
        "cryptographicVerification.certificateIdentity",
    )
    if cryptographic.get("bundleVerified") is not True:
        raise AttestationPolicyError("Sigstore bundle was not verified")
    for field in (
        "workflowRepositoryVerified",
        "workflowRefVerified",
        "workflowShaVerified",
        "workflowTriggerVerified",
    ):
        if cryptographic.get(field) is not True:
            raise AttestationPolicyError(f"{field} must be verified from certificate")

    if rekor.get("inclusionProofVerified") is not True:
        raise AttestationPolicyError("Rekor inclusion proof was not verified")
    _valid_digest(rekor.get("uuid"), "Rekor UUID")
    integrated_time = rekor.get("integratedTime")
    published_at = release.get("publishedAt")
    if not isinstance(integrated_time, int) or integrated_time <= 0:
        raise AttestationPolicyError("Rekor integrated time is invalid")
    if not isinstance(published_at, int) or published_at <= 0:
        raise AttestationPolicyError("release published time is invalid")
    if not 0 <= published_at - integrated_time <= maximum_signing_delay:
        raise AttestationPolicyError(
            "Rekor integration time is stale or later than the release"
        )

    _validate_immutable_release_evidence(
        policy,
        evidence,
        repository=repository,
        expected_release_tag=expected_release_tag,
        published_at=published_at,
    )

    _exact(verifier.get("name"), verifier_policy.get("name"), "verifier.name")
    _exact(
        verifier.get("version"),
        verifier_policy.get("version"),
        "verifier.version",
    )
    verifier_digest = _valid_digest(verifier.get("sha256"), "verifier.sha256")
    _exact(verifier_digest, verifier_policy.get("sha256"), "verifier.sha256")
    trusted_root_digest = _valid_digest(
        trusted_root_policy.get("sha256"), "trustedRoot.sha256"
    )
    _exact(
        _valid_digest(verifier.get("trustedRootSha256"), "verifier.trustedRootSha256"),
        trusted_root_digest,
        "verifier.trustedRootSha256",
    )


def _load_object(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise AttestationPolicyError(f"cannot read {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise AttestationPolicyError(f"{path} must contain an object")
    return value


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--policy", type=Path, required=True)
    parser.add_argument("--policy-id", required=True)
    parser.add_argument("--evidence", type=Path, required=True)
    parser.add_argument("--artifact", type=Path, required=True)
    parser.add_argument("--bundle", type=Path, required=True)
    parser.add_argument("--cosign", type=Path, required=True)
    parser.add_argument("--trusted-root", type=Path, required=True)
    parser.add_argument("--source-commit", required=True)
    parser.add_argument("--expected-policy-digest", required=True)
    parser.add_argument("--release-tag", required=True)
    parser.add_argument("--release-asset-id", type=int, required=True)
    arguments = parser.parse_args()

    policy = _load_object(arguments.policy)
    evidence = _load_object(arguments.evidence)
    subject_digest = _sha256(arguments.artifact)
    validate_attestation_evidence(
        policy,
        evidence,
        expected_policy_id=arguments.policy_id,
        expected_subject_sha256=subject_digest,
        expected_source_commit=arguments.source_commit,
        expected_policy_digest=arguments.expected_policy_digest,
        expected_release_tag=arguments.release_tag,
        expected_release_asset_id=arguments.release_asset_id,
    )

    artifact_policy = select_artifact_policy(policy, arguments.policy_id)
    verifier_policy = _object(artifact_policy, "verifier")
    _exact(_sha256(arguments.cosign), verifier_policy.get("sha256"), "cosign binary")
    _exact(
        _sha256(arguments.trusted_root),
        _object(policy, "trustedRoot").get("sha256"),
        "Sigstore trusted root",
    )
    signer = _object(evidence, "signer")
    cryptographic = _object(evidence, "cryptographicVerification")
    # cosign v3 verifies a v0.3 bundle against a trusted root rather than a live
    # TUF fetch. Passing the pinned root is what makes the verification offline.
    command = [
        str(arguments.cosign),
        "verify-blob",
        "--trusted-root",
        str(arguments.trusted_root),
        "--bundle",
        str(arguments.bundle),
        "--certificate-identity",
        str(cryptographic["certificateIdentity"]),
        "--certificate-oidc-issuer",
        str(signer["oidcIssuer"]),
        "--certificate-github-workflow-repository",
        str(artifact_policy["repository"]),
        "--certificate-github-workflow-ref",
        str(signer["ref"]),
        "--certificate-github-workflow-sha",
        arguments.source_commit,
        "--certificate-github-workflow-trigger",
        str(artifact_policy["eventName"]),
        str(arguments.artifact),
    ]
    completed = subprocess.run(command, check=False, capture_output=True, text=True)
    if completed.returncode != 0:
        raise AttestationPolicyError("cosign rejected the artifact bundle")
    print("artifact signature, identity, Rekor inclusion, and release evidence verified")
    return 0


if __name__ == "__main__":
    raise SystemExit(_main())
