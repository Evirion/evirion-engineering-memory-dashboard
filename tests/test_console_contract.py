from __future__ import annotations

import copy
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
from scripts.verify_artifact_attestation import (
    AttestationPolicyError,
    validate_attestation_evidence,
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
    load_inline_payload_schemas,
    load_schemas,
    render_client,
    verify_contract_bytes,
)
from scripts.openapi_components import OpenApiSubsetError, load_component_schemas


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


class ContractRevisionTagGrammarTests(unittest.TestCase):
    """The tag grammar the frozen policy admits, isolated from every other check.

    Mutating only `signer.ref` would prove nothing: the exact-tag comparison
    that runs after the pattern refuses a wrong tag anyway, so the case would
    pass whatever the pattern said. Each candidate therefore rewrites every
    tag-bearing field and the expectation together, leaving the grammar as the
    only thing that can still refuse it.
    """

    TAG_BEARING = (
        ("signer", "ref"),
        ("release", "tag"),
        ("release", "assetName"),
        ("subject", "name"),
        ("immutableReleaseAttestation", "tag"),
        ("cryptographicVerification", "certificateIdentity"),
    )

    def setUp(self) -> None:
        self.policy = _load("docs/security/artifact-attestation-policy.json")
        fixture = _load("docs/security/fixtures/artifact-attestation-negative-cases.json")
        self.artifact = next(
            entry
            for entry in fixture["artifacts"]
            if entry["policyId"] == "console-contract-v1"
        )
        entry = self.policy["artifacts"]["console-contract-v1"]
        self.repository = entry["repository"]
        self.workflow_path = entry["workflowPath"]

    def _validate_as(self, tag: str) -> None:
        evidence = copy.deepcopy(self.artifact["validEvidence"])
        reference = f"refs/tags/{tag}"
        replacements = {
            ("signer", "ref"): reference,
            ("release", "tag"): tag,
            ("release", "assetName"): f"{tag}.tar.gz",
            ("subject", "name"): f"{tag}.tar.gz",
            ("immutableReleaseAttestation", "tag"): tag,
            ("cryptographicVerification", "certificateIdentity"): (
                f"https://github.com/{self.repository}/{self.workflow_path}@{reference}"
            ),
        }
        for (section, field) in self.TAG_BEARING:
            evidence[section][field] = replacements[(section, field)]

        validate_attestation_evidence(
            self.policy,
            evidence,
            expected_policy_id=self.artifact["policyId"],
            expected_subject_sha256=self.artifact["expectedSubjectSha256"],
            expected_source_commit=self.artifact["expectedSourceCommit"],
            expected_policy_digest=self.artifact["expectedPolicyDigest"],
            expected_release_tag=tag,
            expected_release_asset_id=self.artifact["expectedReleaseAssetId"],
        )

    def test_a_version_or_a_revision_tag_is_admitted(self) -> None:
        for tag in (
            "console-contract-v1.0",
            "console-contract-v1.0.1",
            "console-contract-v2.3.17",
        ):
            with self.subTest(tag=tag):
                self._validate_as(tag)

    def test_every_other_tag_shape_stays_refused(self) -> None:
        # `v1.0.0` stays refused because a first release is spelled without a
        # revision, so one set of bytes keeps exactly one tag. The rest are
        # malformed. A foreign namespace is refused by the prefix before the
        # pattern ever runs.
        for tag in (
            "console-contract-v1.0.0",
            "console-contract-v1.0.1.1",
            "console-contract-v1",
            "console-contract-v1.0-rc1",
            "console-contract-v1.0.",
            "console-contract-v.1",
            "console-contract-v1.0.01",
            "other-contract-v1.0",
        ):
            with self.subTest(tag=tag):
                with self.assertRaises(AttestationPolicyError):
                    self._validate_as(tag)

    def test_the_grammar_mirrors_the_backend_release_workflow(self) -> None:
        # Backend ADR 0014 owns this grammar; this repository only mirrors it.
        # The two are written separately, so a literal comparison is what stops
        # them drifting into two different notions of a valid release tag.
        self.assertEqual(
            self.policy["artifacts"]["console-contract-v1"]["refPattern"],
            r"^refs/tags/console-contract-v[0-9]+\.[0-9]+(\.[1-9][0-9]*)?$",
        )


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


def _document(schemas: str) -> str:
    """A contract-shaped document whose only parsed section is the schemas.

    The prose sections carry constructs the reader deliberately refuses inside
    a schema, which is how these tests prove it skips rather than parses them.
    """
    return (
        "openapi: 3.1.2\n"
        "info:\n"
        "  title: Example API, with a comma\n"
        "  version: 1.0\n"
        "paths: {}\n"
        "components:\n"
        "  responses: {}\n"
        "  schemas:\n" + schemas
    )


class OpenApiComponentReaderTests(unittest.TestCase):
    """The reader that lets an inline component be generated rather than typed.

    It is a subset reader by choice, so the cases that must fail matter as much
    as the ones that must parse: a construct it silently mis-parsed would become
    a validator that admits bytes the backend never sends.
    """

    def setUp(self) -> None:
        self.contract = (
            ROOT
            / _load("docs/contracts/console-contract-lock.json")["consumption"][
                "vendoredRoot"
            ]
            / "contracts/console/v1/openapi.yaml"
        ).read_text(encoding="utf-8")

    def test_the_pinned_import_receipt_reads_exactly(self) -> None:
        receipt = load_component_schemas(self.contract)["RepositoryImportReceipt"]

        self.assertEqual(
            receipt["required"], ["contractVersion", "requestId", "data"]
        )
        data = receipt["properties"]["data"]
        self.assertEqual(data["type"], "object")
        self.assertIs(data["additionalProperties"], False)
        self.assertEqual(
            data["required"],
            ["receiptId", "status", "responseCode", "responsePayload"],
        )
        self.assertEqual(data["properties"]["status"]["const"], "completed")
        self.assertEqual(
            data["properties"]["responseCode"]["enum"],
            [
                "REPOSITORY_IMPORT_CREATED",
                "REPOSITORY_IMPORT_APPROVED",
                "REPOSITORY_IMPORT_JOB_RETRIED",
                "REPOSITORY_IMPORT_PAUSED",
                "REPOSITORY_IMPORT_RESUMED",
                "REPOSITORY_IMPORT_RESUME_BLOCKED",
                "REPOSITORY_IMPORT_CANCELLED",
            ],
        )
        self.assertEqual(
            data["properties"]["responseCode"]["x-evirion-unsupported-value"],
            "UNSUPPORTED_SERVER_RESPONSE",
        )
        self.assertEqual(
            data["properties"]["responsePayload"]["$ref"],
            "#/components/schemas/RepositoryImport",
        )

    def test_quoted_scalars_decode_their_escapes(self) -> None:
        # A pattern read as raw YAML text would keep the doubled backslash and
        # compile to a regexp that matches a literal backslash.
        approve = load_component_schemas(self.contract)[
            "RepositoryImportApproveRequest"
        ]

        self.assertEqual(
            approve["properties"]["costBudgetUsd"]["pattern"],
            r"^(0|[1-9][0-9]{0,11})\.[0-9]{6}$",
        )

    def test_nested_sequences_and_mappings_read_structurally(self) -> None:
        consent = load_component_schemas(self.contract)[
            "RepositoryPolicyUpdateRequest"
        ]["properties"]["consent"]

        self.assertEqual(consent["oneOf"][0], {"type": "null"})
        self.assertEqual(consent["oneOf"][1]["properties"]["scope"]["const"], "LIVE_REPOSITORY")

    def test_only_the_schema_subtree_is_parsed(self) -> None:
        # `info.title` carries a comma and a space, which no schema scalar does.
        # Reading it would mean the reader is parsing sections it never uses.
        schemas = load_component_schemas(_document("    Thing:\n      type: string\n"))

        self.assertEqual(schemas, {"Thing": {"type": "string"}})

    def test_comments_and_folded_prose_read_as_the_document_means_them(self) -> None:
        schemas = load_component_schemas(
            _document(
                "    Thing:\n"
                "      # A full line comment is not a mapping entry.\n"
                "      type: string\n"
                "      description: >-\n"
                "        First paragraph continues\n"
                "        on the next line.\n"
                "\n"
                "        Second paragraph.\n"
                "      maxLength: 12\n"
            )
        )

        self.assertEqual(
            schemas["Thing"]["description"],
            "First paragraph continues on the next line.\nSecond paragraph.",
        )
        self.assertEqual(schemas["Thing"]["maxLength"], 12)

    def test_unreviewed_yaml_fails_closed(self) -> None:
        cases = {
            "tab": "\tThing:\n      type: string\n",
            "anchor": "    Thing: &anchor\n      type: string\n",
            "alias": "    Thing:\n      type: *alias\n",
            "literal block": "    Thing:\n      description: |\n        text\n",
            "flow sequence": "    Thing:\n      enum: [ONE, TWO]\n",
            "populated flow mapping": "    Thing:\n      items: {type: string}\n",
            "plain scalar with a colon": "    Thing:\n      title: a: b\n",
            "plain scalar with a space": "    Thing:\n      title: two words\n",
            "duplicate key": "    Thing:\n      type: string\n      type: integer\n",
            "key with no value": "    Thing:\n      type:\n",
            "unexpected indentation": "    Thing:\n      type: string\n       x: 1\n",
            "nested sequence entry": "    Thing:\n      enum:\n        - - ONE\n",
        }

        for label, schemas in cases.items():
            with self.subTest(label=label):
                with self.assertRaises(OpenApiSubsetError):
                    load_component_schemas(_document(schemas))

    def test_a_document_without_component_schemas_fails_closed(self) -> None:
        for label, document in {
            "no components": "openapi: 3.1.2\npaths: {}\n",
            "no schemas": "openapi: 3.1.2\ncomponents:\n  responses: {}\n",
        }.items():
            with self.subTest(label=label):
                with self.assertRaises(OpenApiSubsetError):
                    load_component_schemas(document)


class InlinePayloadProjectionTests(unittest.TestCase):
    """The rule that turns a fully declared response envelope into a payload.

    Four import operations answer with a receipt the contract declares only
    inline, so without this projection the generator emits no type for them and
    every successful mutation is classified as an unsupported server response.
    """

    def setUp(self) -> None:
        self.lock = _load("docs/contracts/console-contract-lock.json")
        self.contract = (
            ROOT / self.lock["consumption"]["vendoredRoot"] / "contracts/console/v1"
        )
        self.schemas = load_schemas(self.contract)

    def _project(self, schemas: str) -> dict[str, Any]:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            (root / "openapi.yaml").write_text(_document(schemas), encoding="utf-8")
            return load_inline_payload_schemas(root, self.schemas)

    def test_the_pinned_contract_projects_only_the_import_receipt(self) -> None:
        projected = load_inline_payload_schemas(self.contract, self.schemas)

        self.assertEqual(list(projected), ["repository-import-receipt.json"])
        payload = projected["repository-import-receipt.json"]
        self.assertEqual(
            payload["required"],
            ["receiptId", "status", "responseCode", "responsePayload"],
        )
        # Rewritten from the component reference, so the generator resolves it
        # to the generated `RepositoryImport` rather than failing on a pointer.
        self.assertEqual(
            payload["properties"]["responsePayload"]["$ref"],
            "repository-import.json",
        )
        self.assertIn("Durable command receipt", payload["description"])

    def test_the_bare_success_envelope_is_not_projected(self) -> None:
        # Forty of forty-one responses reference it, and the payload belongs to
        # the owning operation. Generating a type from it would invent one.
        self.assertIn("SuccessEnvelope", load_component_schemas(
            (self.contract / "openapi.yaml").read_text(encoding="utf-8")
        ))
        self.assertNotIn(
            "success-envelope.json",
            load_inline_payload_schemas(self.contract, self.schemas),
        )

    def test_a_component_that_is_not_an_envelope_is_not_projected(self) -> None:
        projected = self._project(
            "    Thing:\n"
            "      type: object\n"
            "      additionalProperties: false\n"
            "      required:\n"
            "        - id\n"
            "      properties:\n"
            "        id:\n"
            "          type: string\n"
        )

        self.assertEqual(projected, {})

    def test_a_reference_to_an_inline_component_fails_closed(self) -> None:
        with self.assertRaisesRegex(ConsoleClientError, "no contract schema file"):
            self._project(
                "    Thing:\n"
                "      type: string\n"
                "    ThingReceipt:\n"
                "      type: object\n"
                "      additionalProperties: false\n"
                "      required:\n"
                "        - contractVersion\n"
                "        - requestId\n"
                "        - data\n"
                "      properties:\n"
                "        contractVersion:\n"
                "          type: string\n"
                "        requestId:\n"
                "          type: string\n"
                "        data:\n"
                '          $ref: "#/components/schemas/Thing"\n'
            )

    def test_a_component_name_that_does_not_round_trip_fails_closed(self) -> None:
        with self.assertRaisesRegex(ConsoleClientError, "stable schema file name"):
            self._project(
                "    thingReceipt:\n"
                "      type: object\n"
                "      additionalProperties: false\n"
                "      required:\n"
                "        - contractVersion\n"
                "        - requestId\n"
                "        - data\n"
                "      properties:\n"
                "        contractVersion:\n"
                "          type: string\n"
                "        requestId:\n"
                "          type: string\n"
                "        data:\n"
                "          type: string\n"
            )

    def test_a_component_colliding_with_a_schema_file_fails_closed(self) -> None:
        with self.assertRaisesRegex(ConsoleClientError, "collides"):
            self._project(
                "    CommandReceipt:\n"
                "      type: object\n"
                "      additionalProperties: false\n"
                "      required:\n"
                "        - contractVersion\n"
                "        - requestId\n"
                "        - data\n"
                "      properties:\n"
                "        contractVersion:\n"
                "          type: string\n"
                "        requestId:\n"
                "          type: string\n"
                "        data:\n"
                "          type: string\n"
            )

    def test_the_generated_client_carries_the_receipt_and_its_sentinel(self) -> None:
        client = ROOT / self.lock["consumption"]["generatedClientRoot"]
        types = (client / "types.ts").read_text(encoding="utf-8")
        validators = (client / "validators.ts").read_text(encoding="utf-8")
        unsupported = (client / "unsupported-states.ts").read_text(encoding="utf-8")

        self.assertIn("export type RepositoryImportReceipt = {", types)
        self.assertIn("responsePayload: RepositoryImport;", types)
        self.assertIn(
            "export function isRepositoryImportReceipt(value: unknown):", validators
        )
        # The contract annotates this and the generator used to drop it, because
        # it never read the document the annotation lives in.
        self.assertIn(
            '"RepositoryImportReceipt/responseCode": "UNSUPPORTED_SERVER_RESPONSE",',
            unsupported,
        )

    def test_the_entitlement_receipt_cannot_validate_an_import_receipt(self) -> None:
        # The reason a new type was needed: `command-receipt.json` fixes its
        # response codes to the four entitlement ones, so binding an import
        # mutation to it would fail closed on every success.
        entitlement = self.schemas["command-receipt.json"]["properties"]
        codes = set(entitlement["responseCode"]["enum"])

        self.assertEqual(
            codes,
            {
                "REPOSITORY_ENTITLEMENT_ACTIVE",
                "REPOSITORY_ENTITLEMENT_DISABLED",
                "REPOSITORY_ENTITLEMENT_CHANGE_REQUESTED",
                "REPOSITORY_POLICY_UPDATED",
            },
        )


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
