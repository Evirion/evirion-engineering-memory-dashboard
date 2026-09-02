from __future__ import annotations

import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from typing import Any
from unittest.mock import patch

from scripts.check_console_contract_lock import (
    ContractLockError,
    verify_generated_client,
    verify_lock_against_policy,
    verify_recorded_evidence,
    verify_vendored_archive,
)
from scripts.fetch_console_contract import (
    CREDENTIAL_VARIABLE,
    ContractDownloadError,
    fetch,
    _credential,
)
from scripts.generate_console_client import (
    ConsoleClientError,
    generate,
    render_client,
    verify_contract_bytes,
)


ROOT = Path(__file__).resolve().parents[1]
PROVENANCE = {
    "archiveSha256": "9" * 64,
    "assetId": 1,
    "assetName": "console-contract-v1.0.tar.gz",
    "contractVersion": "1.0",
    "packageSha256": "5" * 64,
    "releaseTag": "console-contract-v1.0",
    "repository": "Evirion/evirion-engineering-memory",
    "sourceCommit": "2" * 40,
}


def _load(relative: str) -> dict[str, Any]:
    return json.loads((ROOT / relative).read_text(encoding="utf-8"))


class ConsoleContractLockTests(unittest.TestCase):
    def setUp(self) -> None:
        self.lock = _load("docs/contracts/console-contract-lock.json")
        self.policy = _load("docs/security/artifact-attestation-policy.json")

    def test_lock_pins_the_published_release_exactly(self) -> None:
        self.assertEqual(self.lock["repository"], "Evirion/evirion-engineering-memory")
        self.assertEqual(
            self.lock["workflowPath"],
            ".github/workflows/console-contract-release.yml",
        )
        self.assertEqual(
            self.lock["sourceCommit"],
            "20cd3b60ba4b067277e960ede99d508cf0bef70a",
        )
        self.assertEqual(self.lock["artifact"]["tag"], "console-contract-v1.0")
        self.assertEqual(
            self.lock["artifact"]["assetName"], "console-contract-v1.0.tar.gz"
        )
        self.assertEqual(self.lock["artifact"]["assetId"], 540908882)
        self.assertEqual(
            self.lock["artifact"]["assetSha256"],
            "9d562738bd315aeeb3294c5c30332f7c1155eacf1182d3f493ef804156be1039",
        )
        self.assertEqual(self.lock["artifact"]["bundleAssetId"], 540908884)
        self.assertEqual(
            self.lock["artifact"]["bundleSha256"],
            "146dea292b98c9b0302ea6191a2cf27d45f9c72b66ea2027f2e129f51a7488f7",
        )
        self.assertEqual(
            self.lock["certificateIdentity"],
            "https://github.com/Evirion/evirion-engineering-memory/"
            ".github/workflows/console-contract-release.yml"
            "@refs/tags/console-contract-v1.0",
        )
        self.assertTrue(self.lock["release"]["immutable"])

    def test_console_contract_content_is_unchanged(self) -> None:
        self.assertEqual(self.lock["contract"]["contractVersion"], "1.0")
        self.assertEqual(
            self.lock["contract"]["packageSha256"],
            "53da9379428d8f34b7e674805019244e85ed89a7cd6f0e1d9b4a2a79b23d6b6c",
        )
        verify_contract_bytes(
            ROOT / self.lock["consumption"]["vendoredRoot"],
            self.lock["contract"]["packageSha256"],
        )

    def test_lock_agrees_with_the_frozen_trust_policy(self) -> None:
        verify_lock_against_policy(self.lock, self.policy)
        self.assertIn("console-contract-v1", self.policy["artifacts"])
        self.assertIn("dashboard-authority-v1", self.policy["artifacts"])
        backend = self.policy["artifacts"]["console-contract-v1"]
        self.assertEqual(backend["repository"], "Evirion/evirion-engineering-memory")
        self.assertEqual(backend["refPrefix"], "refs/tags/console-contract-v")
        self.assertEqual(
            backend["workflowPath"],
            ".github/workflows/console-contract-release.yml",
        )
        self.assertEqual(
            backend["verifier"],
            self.policy["artifacts"]["dashboard-authority-v1"]["verifier"],
        )

    def test_default_branch_reachability_is_not_required(self) -> None:
        self.assertFalse(self.lock["releaseCommitReachableFromDefaultBranch"])
        self.assertFalse(
            self.policy["publication"][
                "releaseCommitReachableFromDefaultBranchRequired"
            ]
        )

        claimed_reachable = dict(self.lock)
        claimed_reachable["releaseCommitReachableFromDefaultBranch"] = True
        with self.assertRaisesRegex(ContractLockError, "reachability"):
            verify_lock_against_policy(claimed_reachable, self.policy)

    def test_vendored_bytes_are_exactly_the_pinned_archive(self) -> None:
        verify_vendored_archive(ROOT, self.lock)

    def test_recorded_release_evidence_is_accepted(self) -> None:
        verify_recorded_evidence(ROOT, self.lock, self.policy)

    def test_generated_client_is_reproducible_from_the_pinned_asset(self) -> None:
        self.assertEqual(
            verify_generated_client(ROOT, self.lock),
            self.lock["consumption"]["generatedClientSurfaceSha256"],
        )

    def test_generated_client_records_its_provenance(self) -> None:
        index = (
            ROOT / self.lock["consumption"]["generatedClientRoot"] / "index.ts"
        ).read_text(encoding="utf-8")

        for pinned in (
            self.lock["artifact"]["assetSha256"],
            self.lock["contract"]["packageSha256"],
            self.lock["sourceCommit"],
            self.lock["artifact"]["tag"],
        ):
            self.assertIn(pinned, index)

    def test_stale_lock_digest_is_rejected(self) -> None:
        stale = json.loads(json.dumps(self.lock))
        stale["policyDigest"] = "f" * 64
        with self.assertRaisesRegex(ContractLockError, "stale policy digest"):
            verify_lock_against_policy(stale, self.policy)

    def test_replaced_archive_bytes_are_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            vendored = root / self.lock["consumption"]["vendoredRoot"]
            vendored.mkdir(parents=True)
            (vendored / self.lock["artifact"]["assetName"]).write_bytes(b"replaced")

            with self.assertRaisesRegex(ContractLockError, "digest drift"):
                verify_vendored_archive(root, self.lock)


class ConsoleClientGenerationTests(unittest.TestCase):
    def _render(self, schema: dict[str, Any]) -> dict[str, str]:
        return render_client({"example.json": schema}, PROVENANCE)

    def test_nullable_union_and_enum_render_as_closed_types(self) -> None:
        rendered = self._render(
            {
                "type": "object",
                "additionalProperties": False,
                "required": ["mode"],
                "properties": {
                    "mode": {"type": "string", "enum": ["OFF", "SOURCE_ONLY"]},
                    "resolvedAt": {
                        "oneOf": [
                            {"type": "null"},
                            {"type": "string", "format": "date-time"},
                        ]
                    },
                },
            }
        )

        self.assertIn('mode: "OFF" | "SOURCE_ONLY";', rendered["types.ts"])
        self.assertIn("resolvedAt?: string | null;", rendered["types.ts"])
        self.assertIn(
            'hasOnlyKeys(object0, ["mode", "resolvedAt"])', rendered["validators.ts"]
        )
        self.assertIn('isOneOf(object0["mode"], ["OFF", "SOURCE_ONLY"])', rendered["validators.ts"])

    def test_documented_unsupported_values_are_exported(self) -> None:
        rendered = self._render(
            {
                "type": "object",
                "additionalProperties": False,
                "required": ["status"],
                "properties": {
                    "status": {
                        "type": "string",
                        "enum": ["ACTIVE", "UNSUPPORTED"],
                        "x-evirion-unsupported-value": "UNSUPPORTED",
                    }
                },
            }
        )

        self.assertIn(
            '"Example/status": "UNSUPPORTED",', rendered["unsupported-states.ts"]
        )

    def test_unreviewed_contract_constructs_fail_closed(self) -> None:
        cases = {
            "unsupported keyword": {"type": "string", "contentEncoding": "base64"},
            "open object with properties": {
                "type": "object",
                "properties": {"a": {"type": "string"}},
            },
            "non-nullable oneOf": {
                "oneOf": [{"type": "string"}, {"type": "integer"}]
            },
            "unsupported format": {"type": "string", "format": "hostname"},
            "undeclared required property": {
                "type": "object",
                "additionalProperties": False,
                "required": ["missing"],
                "properties": {"a": {"type": "string"}},
            },
        }

        for label, schema in cases.items():
            with self.subTest(label=label):
                with self.assertRaises(ConsoleClientError):
                    self._render(schema)

    def test_a_schema_shadowing_a_global_type_fails_closed(self) -> None:
        with self.assertRaisesRegex(ConsoleClientError, "shadow"):
            render_client({"request.json": {"type": "string"}}, PROVENANCE)

    def test_contract_member_digest_drift_fails_closed(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            contract = root / "contracts/console/v1"
            contract.mkdir(parents=True)
            (contract / "openapi.yaml").write_text("openapi: 3.1.2\n", encoding="utf-8")
            (contract / "manifest.json").write_text(
                json.dumps(
                    {
                        "algorithm": "sha256",
                        "contractVersion": "1.0",
                        "files": [
                            {
                                "path": "contracts/console/v1/openapi.yaml",
                                "sha256": "a" * 64,
                            }
                        ],
                        "packageSha256": "b" * 64,
                        "schemaVersion": "1.0",
                    }
                ),
                encoding="utf-8",
            )

            with self.assertRaisesRegex(ConsoleClientError, "digest drift"):
                verify_contract_bytes(root, "b" * 64)

    def test_generation_refuses_a_lock_with_a_different_package_digest(self) -> None:
        lock = _load("docs/contracts/console-contract-lock.json")
        lock["contract"]["packageSha256"] = "0" * 64

        with self.assertRaisesRegex(ConsoleClientError, "contract lock"):
            generate(lock, ROOT)


class ContractDownloadTests(unittest.TestCase):
    def setUp(self) -> None:
        self.lock = _load("docs/contracts/console-contract-lock.json")

    def test_credential_is_read_only_from_the_environment(self) -> None:
        with patch.dict("os.environ", {CREDENTIAL_VARIABLE: ""}, clear=False):
            with self.assertRaisesRegex(ContractDownloadError, CREDENTIAL_VARIABLE):
                _credential()
        with patch.dict("os.environ", {CREDENTIAL_VARIABLE: "token"}, clear=False):
            self.assertEqual(_credential(), "token")

    def test_the_credential_is_never_written_beside_the_download(self) -> None:
        archive = (
            ROOT
            / self.lock["consumption"]["vendoredRoot"]
            / self.lock["artifact"]["assetName"]
        ).read_bytes()
        bundle = b'{"mediaType":"test"}'
        lock = json.loads(json.dumps(self.lock))
        lock["artifact"]["bundleSha256"] = hashlib.sha256(bundle).hexdigest()
        payloads = {
            self.lock["artifact"]["assetId"]: archive,
            self.lock["artifact"]["bundleAssetId"]: bundle,
        }

        with tempfile.TemporaryDirectory() as temporary_directory:
            output = Path(temporary_directory)
            with patch(
                "scripts.fetch_console_contract.download_asset",
                lambda repository, asset_id, token: payloads[asset_id],
            ):
                written = fetch(lock, output, "super-secret-token")

            self.assertEqual(
                sorted(path.name for path in written),
                sorted(
                    [
                        self.lock["artifact"]["assetName"],
                        self.lock["artifact"]["bundleName"],
                    ]
                ),
            )
            for path in output.rglob("*"):
                if path.is_file():
                    self.assertNotIn(b"super-secret-token", path.read_bytes())

    def test_a_downloaded_digest_mismatch_writes_nothing(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            output = Path(temporary_directory)
            with patch(
                "scripts.fetch_console_contract.download_asset",
                lambda repository, asset_id, token: b"replaced",
            ):
                with self.assertRaisesRegex(ContractDownloadError, "digest mismatch"):
                    fetch(self.lock, output, "token")

            self.assertEqual(list(output.rglob("*")), [])


class ContractAttestationWorkflowTests(unittest.TestCase):
    def setUp(self) -> None:
        self.workflow = (
            ROOT / ".github/workflows/console-contract-attestation.yml"
        ).read_text(encoding="utf-8")

    def test_verification_uses_a_short_lived_credential_and_the_pinned_root(
        self,
    ) -> None:
        for required in (
            "contents: read",
            "secrets.CONSOLE_CONTRACT_TOKEN",
            "python3 -m scripts.fetch_console_contract",
            "--trusted-root docs/security/sigstore-trusted-root.json",
            "--policy-id",
            "python3 -m scripts.check_console_contract_lock",
        ):
            with self.subTest(required=required):
                self.assertIn(required, self.workflow)

    def test_integrity_workflow_fails_on_contract_or_client_drift(self) -> None:
        integrity = (
            ROOT / ".github/workflows/authority-integrity.yml"
        ).read_text(encoding="utf-8")

        self.assertIn("python3 -m scripts.check_console_contract_lock", integrity)
        self.assertIn("python3 -m scripts.generate_console_client", integrity)
        self.assertIn("git diff --exit-code -- generated", integrity)


if __name__ == "__main__":
    unittest.main()
