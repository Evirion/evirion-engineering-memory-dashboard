from __future__ import annotations

import argparse
import hashlib
import io
import json
import tarfile
from pathlib import Path
from typing import Any

from .generate_console_client import (
    ConsoleClientError,
    generate,
    surface_digest,
    verify_contract_bytes,
)
from .verify_artifact_attestation import (
    AttestationPolicyError,
    compute_policy_digest,
    select_artifact_policy,
    validate_attestation_evidence,
)


class ContractLockError(ValueError):
    """Raised when the pinned Console contract no longer matches the lock."""


def _sha256(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def _require(condition: bool, message: str) -> None:
    if not condition:
        raise ContractLockError(message)


def verify_vendored_archive(root: Path, lock: dict[str, Any]) -> None:
    """The vendored tree must be exactly what the pinned archive unpacks to."""
    vendored_root = root / lock["consumption"]["vendoredRoot"]
    archive_path = vendored_root / lock["artifact"]["assetName"]
    _require(archive_path.is_file(), f"pinned archive is missing: {archive_path}")
    payload = archive_path.read_bytes()
    digest = _sha256(payload)
    _require(
        digest == lock["artifact"]["assetSha256"],
        f"pinned archive digest drift: expected {lock['artifact']['assetSha256']}, "
        f"found {digest}",
    )

    unpacked: dict[str, bytes] = {}
    with tarfile.open(fileobj=io.BytesIO(payload), mode="r:gz") as archive:
        for member in archive.getmembers():
            _require(member.isfile(), f"archive member is not a regular file: {member.name}")
            relative = Path(member.name)
            _require(
                not relative.is_absolute() and ".." not in relative.parts,
                f"unsafe archive member: {member.name}",
            )
            _require(member.name not in unpacked, f"duplicate archive member: {member.name}")
            extracted = archive.extractfile(member)
            _require(extracted is not None, f"unreadable archive member: {member.name}")
            unpacked[member.name] = extracted.read()

    tracked = {
        path.relative_to(vendored_root).as_posix(): path
        for path in sorted(vendored_root.rglob("*"))
        if path.is_file() and path != archive_path
    }
    missing = sorted(set(unpacked) - set(tracked))
    _require(not missing, "archive members are not vendored: " + ", ".join(missing))
    extra = sorted(set(tracked) - set(unpacked))
    _require(not extra, "vendored files are not archive members: " + ", ".join(extra))
    for name, expected in unpacked.items():
        _require(
            tracked[name].read_bytes() == expected,
            f"vendored bytes differ from the pinned archive: {name}",
        )


def verify_lock_against_policy(lock: dict[str, Any], policy: dict[str, Any]) -> None:
    policy_id = lock["policyId"]
    artifact_policy = select_artifact_policy(policy, policy_id)
    _require(
        policy["policyDigest"] == compute_policy_digest(policy),
        "trust policy digest does not match its own bytes",
    )
    _require(
        lock["policyDigest"] == policy["policyDigest"],
        "contract lock pins a stale policy digest",
    )
    for field, expected in (
        ("repository", artifact_policy["repository"]),
        ("workflowPath", artifact_policy["workflowPath"]),
        ("oidcIssuer", artifact_policy["oidcIssuer"]),
        ("eventName", artifact_policy["eventName"]),
    ):
        _require(
            lock[field] == expected,
            f"contract lock {field} does not match the {policy_id} policy entry",
        )
    tag = lock["artifact"]["tag"]
    reference = f"refs/tags/{tag}"
    _require(
        reference.startswith(artifact_policy["refPrefix"]),
        "contract lock tag is outside the frozen namespace",
    )
    _require(
        lock["artifact"]["assetName"] == f"{tag}.tar.gz",
        "contract lock asset name does not follow the release tag",
    )
    _require(
        lock["artifact"]["bundleName"] == f"{tag}.sigstore.json",
        "contract lock bundle name does not follow the release tag",
    )
    _require(
        lock["certificateIdentity"]
        == f"https://github.com/{lock['repository']}/{lock['workflowPath']}@{reference}",
        "contract lock certificate identity is not derived from the pinned release",
    )
    _require(
        lock["trustedRootSha256"] == policy["trustedRoot"]["sha256"],
        "contract lock pins a different Sigstore trusted root than the policy",
    )
    _require(
        lock["verifier"]["sha256"] == artifact_policy["verifier"]["sha256"],
        "contract lock pins a different verifier than the policy",
    )
    # The signing tag survives because the release is immutable, not because the
    # commit stayed on the publishing repository's default branch.
    _require(
        lock["releaseCommitReachableFromDefaultBranch"] is False,
        "the contract lock must not claim default-branch reachability",
    )


def verify_recorded_evidence(root: Path, lock: dict[str, Any], policy: dict[str, Any]) -> None:
    evidence = json.loads((root / lock["evidencePath"]).read_text(encoding="utf-8"))
    try:
        validate_attestation_evidence(
            policy,
            evidence,
            expected_policy_id=lock["policyId"],
            expected_subject_sha256=lock["artifact"]["assetSha256"],
            expected_source_commit=lock["sourceCommit"],
            expected_policy_digest=lock["policyDigest"],
            expected_release_tag=lock["artifact"]["tag"],
            expected_release_asset_id=lock["artifact"]["assetId"],
        )
    except AttestationPolicyError as exc:
        raise ContractLockError(f"recorded release evidence is rejected: {exc}") from exc


def verify_generated_client(root: Path, lock: dict[str, Any]) -> str:
    try:
        rendered = generate(lock, root)
    except ConsoleClientError as exc:
        raise ContractLockError(str(exc)) from exc
    output_root = root / lock["consumption"]["generatedClientRoot"]
    for name, source in sorted(rendered.items()):
        path = output_root / name
        _require(path.is_file(), f"generated client file is missing: {name}")
        _require(
            path.read_text(encoding="utf-8") == source,
            f"generated client drift: {name} is not reproducible from the pinned asset",
        )
    tracked = sorted(
        path.relative_to(output_root).as_posix()
        for path in output_root.rglob("*")
        if path.is_file()
    )
    _require(
        tracked == sorted(rendered),
        "generated client contains files the generator does not produce: "
        + ", ".join(sorted(set(tracked) - set(rendered))),
    )
    digest = surface_digest(rendered)
    _require(
        digest == lock["consumption"]["generatedClientSurfaceSha256"],
        "the generated export surface changed, which is a breaking backend change: "
        f"expected {lock['consumption']['generatedClientSurfaceSha256']}, produced {digest}",
    )
    return digest


def _main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--root",
        type=Path,
        default=Path(__file__).resolve().parents[1],
    )
    parser.add_argument(
        "--lock",
        type=Path,
        default=Path("docs/contracts/console-contract-lock.json"),
    )
    parser.add_argument(
        "--policy",
        type=Path,
        default=Path("docs/security/artifact-attestation-policy.json"),
    )
    arguments = parser.parse_args()

    root = arguments.root.resolve()
    lock = json.loads((root / arguments.lock).read_text(encoding="utf-8"))
    policy = json.loads((root / arguments.policy).read_text(encoding="utf-8"))

    verify_lock_against_policy(lock, policy)
    verify_vendored_archive(root, lock)
    try:
        verify_contract_bytes(
            root / lock["consumption"]["vendoredRoot"],
            lock["contract"]["packageSha256"],
        )
    except ConsoleClientError as exc:
        raise ContractLockError(str(exc)) from exc
    verify_recorded_evidence(root, lock, policy)
    surface = verify_generated_client(root, lock)

    print(
        "console contract lock verified: "
        f"{lock['artifact']['tag']} archive {lock['artifact']['assetSha256']} "
        f"packageSha256 {lock['contract']['packageSha256']} surface {surface}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(_main())
