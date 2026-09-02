from __future__ import annotations

import copy
import hashlib
import json
import re
import tarfile
import tempfile
import unittest
from pathlib import Path
from typing import Any
from unittest.mock import patch

from scripts.build_authority_package import (
    AuthorityPackageError,
    build_authority_archive,
)
from scripts.check_authority import (
    AuthorityError,
    build_manifest,
    validate_inventory,
    verify_manifest,
)
from scripts.check_docs import validate_document_tree
from scripts.generate_asvs_matrix import (
    AsvsMatrixError,
    build_asvs_matrix,
    validate_source_metadata,
)
from scripts.generate_security_controls import (
    SecurityControlError,
    build_security_controls,
)
from scripts.generate_acceptance_map import (
    AcceptanceMapError,
    build_acceptance_rows,
    extract_owner_map,
)
from scripts.migrate_authority_sources import (
    MigrationError,
    SourceSpec,
    migrate_sources,
    transform_obsidian_note,
)
from scripts.scan_tracked_secrets import scan_files
from scripts.verify_artifact_attestation import (
    AttestationPolicyError,
    compute_policy_digest,
    validate_attestation_evidence,
)


PAGE_FILES = frozenset({"page.tsx", "page.ts", "page.jsx", "page.js"})
ROUTE_HANDLER_FILES = frozenset({"route.tsx", "route.ts", "route.jsx", "route.js"})


def resolve_app_router_url(segments: tuple[str, ...]) -> str | None:
    """Resolve App Router directory segments to the URL Next.js actually serves.

    Returns `None` when the segments are not routable. A parallel-route slot is
    rejected rather than skipped, because it changes resolution in a way the
    reviewed route inventory cannot express.
    """
    parts: list[str] = []
    for segment in segments:
        if segment.startswith("(") and segment.endswith(")"):
            continue
        if segment.startswith("_"):
            return None
        if segment.startswith("@"):
            raise ValueError(f"unsupported parallel route slot: {segment}")
        if segment.startswith("[[") and segment.endswith("]]"):
            parts.append(":" + segment[2:-2].removeprefix("...") + "*")
            continue
        if segment.startswith("[") and segment.endswith("]"):
            inner = segment[1:-1]
            if inner.startswith("..."):
                parts.append(":" + inner[3:] + "*")
            else:
                parts.append(":" + inner)
            continue
        parts.append(segment)
    return "/" + "/".join(parts)


def collect_app_router_routes(application: Path) -> tuple[list[str], list[str]]:
    """Return the sorted page URLs and route-handler URLs served from `src/app`."""
    pages: set[str] = set()
    handlers: set[str] = set()
    for path in sorted(application.rglob("*")):
        if not path.is_file():
            continue
        is_page = path.name in PAGE_FILES
        if not is_page and path.name not in ROUTE_HANDLER_FILES:
            continue
        url = resolve_app_router_url(path.relative_to(application).parts[:-1])
        if url is None:
            continue
        (pages if is_page else handlers).add(url)
    return sorted(pages), sorted(handlers)


def matches_frozen_path(path: str, frozen: list[str]) -> bool:
    for entry in frozen:
        if entry.endswith("/*"):
            if path.startswith(entry[: -len("*")]) and path != entry[: -len("/*")]:
                return True
        elif path == entry:
            return True
    return False


class AppRouterResolutionTests(unittest.TestCase):
    def test_groups_parameters_and_private_folders_resolve_like_next(self) -> None:
        cases = {
            (): "/",
            ("auth", "sign-in"): "/auth/sign-in",
            ("(console)", "onboarding"): "/onboarding",
            ("(auth)", "sign-in"): "/sign-in",
            ("memory", "[knowledgeObjectId]"): "/memory/:knowledgeObjectId",
            ("docs", "[...slug]"): "/docs/:slug*",
            ("shop", "[[...filters]]"): "/shop/:filters*",
            ("_internal", "page"): None,
        }

        for segments, expected in cases.items():
            with self.subTest(segments=segments):
                self.assertEqual(resolve_app_router_url(segments), expected)

    def test_parallel_route_slot_is_rejected(self) -> None:
        with self.assertRaisesRegex(ValueError, "parallel route slot"):
            resolve_app_router_url(("dashboard", "@analytics"))

    def test_a_route_group_that_swallows_a_frozen_prefix_is_detectable(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            application = Path(temporary_directory)
            (application / "(auth)/sign-in").mkdir(parents=True)
            (application / "(auth)/sign-in/page.tsx").write_text("x\n", encoding="utf-8")
            (application / "api/auth/logout").mkdir(parents=True)
            (application / "api/auth/logout/route.ts").write_text("x\n", encoding="utf-8")

            pages, handlers = collect_app_router_routes(application)

            self.assertEqual(pages, ["/sign-in"])
            self.assertNotIn("/auth/sign-in", pages)
            self.assertEqual(handlers, ["/api/auth/logout"])

    def test_frozen_wildcard_matches_only_paths_beneath_it(self) -> None:
        frozen = ["/auth/*", "/onboarding"]

        self.assertTrue(matches_frozen_path("/auth/sign-in", frozen))
        self.assertTrue(matches_frozen_path("/auth/mfa/enroll", frozen))
        self.assertTrue(matches_frozen_path("/onboarding", frozen))
        self.assertFalse(matches_frozen_path("/auth", frozen))
        self.assertFalse(matches_frozen_path("/authorize", frozen))
        self.assertFalse(matches_frozen_path("/settings/sessions", frozen))


class AcceptanceMapTests(unittest.TestCase):
    def test_explicit_and_implicit_acceptance_rows_keep_stable_ordinals(self) -> None:
        requirements = """\
### AUTH-001 — Invite only

The application is invite only.

**Acceptance:**

- Unknown users cannot sign up.
- Revoked invitations cannot be accepted.

### BR-001 — No unentitled work

An unentitled repository creates no work.
"""
        owners = {
            "AUTH-001": {
                "primaryOwner": "B02",
                "primaryEvidence": "test_auth.py::test_invite_only",
            },
            "BR-001": {
                "primaryOwner": "B05",
                "primaryEvidence": "test_entitlement.py::test_zero_work",
            },
        }

        rows = build_acceptance_rows(requirements, owners)

        self.assertEqual(
            [row["id"] for row in rows],
            ["AUTH-001.A1", "AUTH-001.A2", "BR-001.A1"],
        )
        self.assertEqual(rows[0]["primaryOwner"], "B02")
        self.assertEqual(rows[1]["case"], "AUTH-001.A2")
        self.assertEqual(rows[2]["primaryEvidence"], "test_entitlement.py::test_zero_work")

    def test_missing_owner_fails_closed(self) -> None:
        requirements = """\
### AUTH-001 — Invite only

The application is invite only.
"""

        with self.assertRaisesRegex(AcceptanceMapError, "AUTH-001"):
            build_acceptance_rows(requirements, {})

    def test_implicit_row_stops_at_next_peer_or_parent_heading(self) -> None:
        requirements = """\
### NFR-OPS-001 — Rollback

Rollback is forward-only.

## Release checklist

- This is not part of NFR-OPS-001.
"""
        owners = {
            "NFR-OPS-001": {
                "primaryOwner": "I01-B",
                "primaryEvidence": "test_rollback.py::test_forward_only",
            }
        }

        rows = build_acceptance_rows(requirements, owners)

        self.assertEqual(rows[0]["text"], "Rollback is forward-only.")

    def test_owner_map_is_extracted_from_frozen_traceability_rows(self) -> None:
        implementation_plan = """\
| ID | Primary PR | Primary executable evidence |
|---|---|---|
| `G-001` | I01-C | `tests/e2e/free.spec.ts::goal_safe` |
| `AUTH-001` | B02 | `test_auth.py::test_invite_only` |
"""

        owners = extract_owner_map(implementation_plan)

        self.assertEqual(
            owners,
            {
                "AUTH-001": {
                    "primaryOwner": "B02",
                    "primaryEvidence": "test_auth.py::test_invite_only",
                },
                "G-001": {
                    "primaryOwner": "I01-C",
                    "primaryEvidence": "tests/e2e/free.spec.ts::goal_safe",
                },
            },
        )

    def test_repository_map_includes_every_p01_bootstrap_acceptance_row(self) -> None:
        root = Path(__file__).resolve().parents[1]
        payload = json.loads(
            (root / "docs/requirements/acceptance-map.yaml").read_text()
        )
        bootstrap_rows = [
            row for row in payload["rows"] if row["id"].startswith("P01-A")
        ]

        self.assertEqual(
            [row["id"] for row in bootstrap_rows],
            [f"P01-A{ordinal:03d}" for ordinal in range(1, 14)],
        )
        governance = next(row for row in bootstrap_rows if row["id"] == "P01-A008")
        self.assertIn("SEC-2026-012", governance["text"])


class AuthorityManifestTests(unittest.TestCase):
    def test_manifest_is_deterministic_and_detects_changed_bytes(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            (root / "docs").mkdir()
            (root / "docs" / "a.md").write_text("alpha\n", encoding="utf-8")
            (root / "docs" / "b.md").write_text("beta\n", encoding="utf-8")

            manifest = build_manifest(root, ["docs/b.md", "docs/a.md"])

            self.assertEqual(
                [entry["path"] for entry in manifest["files"]],
                ["docs/a.md", "docs/b.md"],
            )
            verify_manifest(root, manifest)

            (root / "docs" / "b.md").write_text("changed\n", encoding="utf-8")
            with self.assertRaisesRegex(AuthorityError, "docs/b.md"):
                verify_manifest(root, manifest)

    def test_inventory_must_cover_every_repository_file_except_manifest(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            (root / ".git").mkdir()
            (root / ".git/config").write_text("ignored\n", encoding="utf-8")
            (root / "docs/authority").mkdir(parents=True)
            (root / "docs/a.md").write_text("alpha\n", encoding="utf-8")
            (root / "docs/authority/manifest.json").write_text(
                "{}\n",
                encoding="utf-8",
            )

            validate_inventory(root, ["docs/a.md"])

            (root / "docs/unlisted.md").write_text("drift\n", encoding="utf-8")
            with self.assertRaisesRegex(AuthorityError, "unlisted"):
                validate_inventory(root, ["docs/a.md"])

    @staticmethod
    def _application_tree(root: Path) -> None:
        (root / "docs/authority").mkdir(parents=True)
        (root / "src/app").mkdir(parents=True)
        (root / "docs/a.md").write_text("alpha\n", encoding="utf-8")
        (root / "package.json").write_text("{}\n", encoding="utf-8")
        (root / "src/app/page.tsx").write_text("export default () => null\n", encoding="utf-8")
        (root / "docs/authority/manifest.json").write_text("{}\n", encoding="utf-8")

    def test_allowlisted_application_source_is_tracked_outside_the_package(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            self._application_tree(root)

            validate_inventory(
                root,
                ["docs/a.md"],
                allowlist=["package.json", "src/**"],
            )

    def test_path_in_neither_package_nor_allowlist_still_fails(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            self._application_tree(root)
            (root / "next.config.ts").write_text("export default {}\n", encoding="utf-8")

            with self.assertRaisesRegex(AuthorityError, r"unlisted authority files: next\.config\.ts"):
                validate_inventory(
                    root,
                    ["docs/a.md"],
                    allowlist=["package.json", "src/**"],
                )

    def test_path_in_both_package_and_allowlist_fails(self) -> None:
        for inventory, allowlist, expected in (
            (["docs/a.md", "package.json"], ["package.json", "src/**"], "package.json"),
            (
                ["docs/a.md", "package.json", "src/app/page.tsx"],
                ["package.json", "src/**"],
                "src/app/page.tsx",
            ),
        ):
            with self.subTest(expected=expected):
                with tempfile.TemporaryDirectory() as temporary_directory:
                    root = Path(temporary_directory)
                    self._application_tree(root)

                    with self.assertRaisesRegex(
                        AuthorityError, "both packaged and allowlisted"
                    ):
                        validate_inventory(root, inventory, allowlist=allowlist)

    def test_allowlist_pattern_matching_nothing_fails(self) -> None:
        for allowlist in (
            ["package.json", "src/**", "playwright.config.ts"],
            ["package.json", "src/**", "tools/local-tls/**"],
        ):
            with self.subTest(allowlist=allowlist):
                with tempfile.TemporaryDirectory() as temporary_directory:
                    root = Path(temporary_directory)
                    self._application_tree(root)

                    with self.assertRaisesRegex(
                        AuthorityError, "non-package allowlist patterns match nothing"
                    ):
                        validate_inventory(root, ["docs/a.md"], allowlist=allowlist)

    def test_local_tool_output_and_env_files_never_reach_the_gate(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            self._application_tree(root)
            for directory in (".venv/lib", ".local/certificates", "tools/security/.venv"):
                (root / directory).mkdir(parents=True)
                (root / directory / "artifact").write_text("local\n", encoding="utf-8")
            for name in (".env", ".env.local", ".env.production.local"):
                (root / name).write_text("SECRET=x\n", encoding="utf-8")

            validate_inventory(
                root,
                ["docs/a.md"],
                allowlist=["package.json", "src/**"],
            )

    def test_a_tracked_env_example_must_still_be_declared(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            self._application_tree(root)
            (root / ".env.example").write_text("SUPABASE_URL=\n", encoding="utf-8")

            with self.assertRaisesRegex(AuthorityError, r"unlisted authority files: \.env\.example"):
                validate_inventory(
                    root,
                    ["docs/a.md"],
                    allowlist=["package.json", "src/**"],
                )

    def test_allowlist_rejects_unsafe_or_duplicate_patterns(self) -> None:
        for allowlist in (
            ["../outside"],
            ["/etc/passwd"],
            ["../outside/**"],
            ["package.json", "package.json"],
        ):
            with self.subTest(allowlist=allowlist):
                with tempfile.TemporaryDirectory() as temporary_directory:
                    root = Path(temporary_directory)
                    self._application_tree(root)

                    with self.assertRaises(AuthorityError):
                        validate_inventory(root, ["docs/a.md"], allowlist=allowlist)


class AuthorityPackageTests(unittest.TestCase):
    def test_archive_is_deterministic_and_contains_only_manifest_inventory(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            (root / "docs/authority").mkdir(parents=True)
            (root / "docs/a.md").write_text("alpha\n", encoding="utf-8")
            (root / "docs/b.md").write_text("beta\n", encoding="utf-8")
            manifest = build_manifest(root, ["docs/b.md", "docs/a.md"])
            (root / "docs/authority/manifest.json").write_text(
                json.dumps(manifest),
                encoding="utf-8",
            )
            first = root / "first.tar.gz"
            second = root / "second.tar.gz"

            build_authority_archive(root, root / "docs/authority/manifest.json", first)
            (root / "docs/a.md").touch()
            build_authority_archive(root, root / "docs/authority/manifest.json", second)

            self.assertEqual(first.read_bytes(), second.read_bytes())
            with tarfile.open(first, mode="r:gz") as archive:
                members = archive.getmembers()
            self.assertEqual(
                [member.name for member in members],
                [
                    "docs/a.md",
                    "docs/authority/manifest.json",
                    "docs/b.md",
                ],
            )
            self.assertTrue(all(member.mode == 0o644 for member in members))
            self.assertTrue(all(member.mtime == 0 for member in members))

    def test_archive_rejects_unsafe_manifest_member(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            manifest_path = root / "manifest.json"
            manifest_path.write_text(
                json.dumps(
                    {
                        "schemaVersion": "1.0",
                        "algorithm": "sha256",
                        "files": [{"path": "../outside", "sha256": "a" * 64}],
                        "packageSha256": "b" * 64,
                    }
                ),
                encoding="utf-8",
            )

            with self.assertRaises(AuthorityPackageError):
                build_authority_archive(root, manifest_path, root / "archive.tar.gz")


class DocumentationTests(unittest.TestCase):
    def test_relative_and_retained_obsidian_links_are_allowed(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            (root / "docs").mkdir()
            (root / "docs" / "a.md").write_text(
                "[Local](b.md)\n"
                "[Retained](obsidian://open?vault=Obsidian%20Vault&file=x)\n",
                encoding="utf-8",
            )
            (root / "docs" / "b.md").write_text("# B\n", encoding="utf-8")

            self.assertEqual(validate_document_tree(root, [root / "docs"]), [])

    def test_broken_and_machine_local_links_fail(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            (root / "docs").mkdir()
            (root / "docs" / "a.md").write_text(
                "[Missing](missing.md)\n"
                "![Missing image](missing.png)\n"
                "[Local](file:///Users/example/private.md)\n"
                "[Script](javascript:alert)\n"
                "[Embedded](data:text/plain,unsafe)\n",
                encoding="utf-8",
            )

            errors = validate_document_tree(root, [root / "docs"])

            self.assertTrue(any("missing.md" in error for error in errors))
            self.assertTrue(any("missing.png" in error for error in errors))
            self.assertTrue(any("machine-local" in error for error in errors))
            self.assertEqual(
                sum("unsupported link scheme" in error for error in errors),
                3,
            )


class SecretScanTests(unittest.TestCase):
    def test_private_key_and_provider_token_are_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            safe = root / "safe.md"
            unsafe = root / "unsafe.env"
            safe.write_text("No credentials here.\n", encoding="utf-8")
            unsafe.write_text(
                ("-" * 5)
                + "BEGIN PRIVATE KEY"
                + ("-" * 5)
                + "\n"
                + "OPENAI_API_KEY="
                + "sk-"
                + ("x" * 32)
                + "\n",
                encoding="utf-8",
            )

            errors = scan_files(root, [safe, unsafe])

            self.assertEqual(
                {error.rsplit("possible ", 1)[-1] for error in errors},
                {"private-key", "provider-token", "sensitive-environment-value"},
            )
            self.assertEqual(scan_files(root, [safe]), [])


class AuthorityMigrationTests(unittest.TestCase):
    def test_obsidian_links_become_repository_or_retained_links(self) -> None:
        source = """\
---
status: accepted
---

# Requirements

[[EEM - Design Partner Console architecture]]
[[EEM - OWASP-аудит и модель угроз]]
"""
        transformed = transform_obsidian_note(
            source,
            destination=Path("docs/product/design-partner-console-requirements.md"),
            source_fallback="10 Evirion/test-source.md",
            source_sha256="a" * 64,
        )

        self.assertIn(
            "../architecture/design-partner-console.md",
            transformed,
        )
        self.assertIn("obsidian://open?vault=Obsidian%20Vault", transformed)
        self.assertIn("source SHA-256: `", transformed)
        self.assertNotIn("[[", transformed)

    def test_machine_local_source_path_is_rejected(self) -> None:
        with self.assertRaisesRegex(MigrationError, "machine-local"):
            transform_obsidian_note(
                "# Source\nfile:///Users/example/private.md\n",
                destination=Path("docs/product/source.md"),
                source_fallback="10 Evirion/source.md",
                source_sha256="a" * 64,
            )

    def test_late_source_failure_leaves_all_destinations_unchanged(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            vault = root / "vault"
            backend = root / "backend"
            dashboard = root / "dashboard"
            vault.mkdir()
            backend.mkdir()
            dashboard.mkdir()
            first_source = b"# First\n"
            (vault / "first.md").write_bytes(first_source)
            (vault / "second.md").write_text("# Second\n", encoding="utf-8")
            sources = (
                SourceSpec(
                    source="first.md",
                    destination="docs/first.md",
                    sha256=hashlib.sha256(first_source).hexdigest(),
                    source_kind="obsidian",
                ),
                SourceSpec(
                    source="second.md",
                    destination="docs/second.md",
                    sha256="a" * 64,
                    source_kind="obsidian",
                ),
            )

            with patch("scripts.migrate_authority_sources.SOURCES", sources):
                with self.assertRaisesRegex(MigrationError, "source digest drift"):
                    migrate_sources(vault, backend, dashboard)

            self.assertFalse((dashboard / "docs/first.md").exists())


class RepositoryBootstrapFilesTests(unittest.TestCase):
    def setUp(self) -> None:
        self.root = Path(__file__).resolve().parents[1]

    def test_required_governance_and_authority_files_exist(self) -> None:
        required = [
            ".github/CODEOWNERS",
            ".github/workflows/authority-integrity.yml",
            ".github/workflows/authority-release.yml",
            ".github/workflows/console-contract-attestation.yml",
            ".gitignore",
            "AGENTS.md",
            "README.md",
            "SECURITY.md",
            "docs/README.md",
            "docs/architecture/console-route-inventory.json",
            "docs/architecture/console-ui-conventions.md",
            "docs/architecture/design-partner-console.md",
            "docs/architecture/design-partner-console-program-design.md",
            "docs/architecture/toolchain-baseline.json",
            "docs/authority/non-package-paths.json",
            "docs/contracts/console-contract-lock.json",
            "docs/contracts/console-contract-v1.0-evidence.json",
            "docs/decisions/0001-two-repository-contract-boundary.md",
            (
                "docs/decisions/"
                "0002-console-contract-consumption-and-immutability-evidence.md"
            ),
            (
                "docs/decisions/"
                "0003-application-source-boundary-and-route-contract.md"
            ),
            "docs/decisions/0004-console-lint-and-format-toolchain.md",
            "docs/decisions/README.md",
            "docs/plans/active/README.md",
            (
                "docs/plans/active/"
                "eem-9-design-partner-console-dashboard-and-certification.md"
            ),
            "docs/plans/design-partner-console-implementation.md",
            "docs/product/design-partner-console-requirements.md",
            "docs/requirements/acceptance-map.yaml",
            "docs/requirements/ownership.json",
            "docs/requirements/source-disposition.yaml",
            "docs/security/ASVS-NOTICE.md",
            "docs/security/artifact-attestation.md",
            "docs/security/artifact-attestation-policy.json",
            "docs/security/asvs-v5.0.0-l2-console-evidence.yaml",
            "docs/security/asvs-v5.0.0-l2-source.json",
            "docs/security/console-security-controls.yaml",
            "docs/security/repository-governance-evidence.json",
            "docs/security/sigstore-trusted-root.json",
            "generated/console-contract/v1/index.ts",
            "vendor/console-contract-v1.0/console-contract-v1.0.tar.gz",
        ]

        missing = [path for path in required if not (self.root / path).is_file()]

        self.assertEqual(missing, [])

    def test_non_package_allowlist_is_sorted_and_disjoint_from_the_package(self) -> None:
        inventory = json.loads(
            (self.root / "docs/authority/package-files.json").read_text(encoding="utf-8")
        )
        allowlist = json.loads(
            (
                self.root / "docs/authority/non-package-paths.json"
            ).read_text(encoding="utf-8")
        )

        self.assertIsInstance(allowlist, list)
        self.assertTrue(all(isinstance(pattern, str) for pattern in allowlist))
        self.assertEqual(allowlist, sorted(allowlist))
        self.assertEqual(len(allowlist), len(set(allowlist)))

        exact = {pattern for pattern in allowlist if not pattern.endswith("/**")}
        prefixes = tuple(
            pattern[: -len("**")] for pattern in allowlist if pattern.endswith("/**")
        )
        packaged = set(inventory)
        self.assertEqual(sorted(packaged & exact), [])
        self.assertEqual(
            sorted(path for path in packaged if path.startswith(prefixes)),
            [],
        )

    def test_initial_license_and_first_ignore_rule_are_preserved(self) -> None:
        license_digest = hashlib.sha256((self.root / "LICENSE").read_bytes()).hexdigest()
        self.assertEqual(
            license_digest,
            "c71d239df91726fc519c6eb72d318ec65820627232b2f796219e87dcf35d0ab4",
        )
        self.assertEqual(
            (self.root / ".gitignore").read_text(encoding="utf-8").splitlines()[0],
            ".idea/",
        )

    def test_workflow_actions_are_full_sha_pinned(self) -> None:
        baseline = json.loads(
            (
                self.root / "docs/architecture/toolchain-baseline.json"
            ).read_text(encoding="utf-8")
        )
        for workflow_name in (
            "authority-integrity.yml",
            "authority-release.yml",
            "console-contract-attestation.yml",
        ):
            workflow = (
                self.root / ".github/workflows" / workflow_name
            ).read_text(encoding="utf-8")
            action_refs = re.findall(r"uses:\s*([^@\s]+)@([^\s#]+)", workflow)
            self.assertTrue(action_refs)
            for action, reference in action_refs:
                with self.subTest(workflow=workflow_name, action=action):
                    self.assertRegex(reference, r"^[0-9a-f]{40}$")
                    self.assertEqual(reference, baseline["actions"][action]["commit"])

    def test_release_workflow_fails_closed_before_publication(self) -> None:
        workflow = (
            self.root / ".github/workflows/authority-release.yml"
        ).read_text(encoding="utf-8")

        for required in (
            "id-token: write",
            "persist-credentials: false",
            "docs/security/immutable-release-attestation.json",
            'MAXIMUM_ATTESTATION_AGE_SECONDS: "86400"',
            'MAXIMUM_CLOCK_SKEW_SECONDS: "300"',
            "no administrator attestation for this exact tag; refusing to sign",
            "administrator attestation is stale or post-dated; refusing to sign",
            'gh release view "$GITHUB_REF_NAME"',
            ".immutable == true",
            "cmp",
            "python3 -m scripts.build_authority_package",
            "python3 -m scripts.check_console_contract_lock",
            "^dashboard-authority-v[0-9]+\\.[0-9]+\\.[0-9]+$",
            "cosign sign-blob",
            "release already exists; replacement is forbidden",
        ):
            with self.subTest(required=required):
                self.assertIn(required, workflow)

        # The endpoint requires admin read access that no workflow token can
        # hold, so depending on it again would forbid publication permanently.
        self.assertNotIn("immutable-releases\n", workflow)
        self.assertNotIn("repos/$GITHUB_REPOSITORY/immutable-releases", workflow)
        self.assertNotIn("--method PATCH", workflow)
        self.assertNotIn("pull_request_target", workflow)

        attestation_gate = workflow.index("refusing to sign")
        signing = workflow.index("cosign sign-blob")
        draft_create = workflow.index("gh release create")
        draft_verify = workflow.index(".draft == true")
        publish = workflow.index("--draft=false")
        published_immutability = workflow.index(".immutable == true")
        self.assertLess(attestation_gate, signing)
        self.assertLess(signing, draft_create)
        self.assertLess(draft_create, draft_verify)
        self.assertLess(draft_verify, publish)
        self.assertLess(publish, published_immutability)

    def test_no_workflow_requires_release_commit_reachability(self) -> None:
        for workflow_path in sorted((self.root / ".github/workflows").glob("*.yml")):
            with self.subTest(workflow=workflow_path.name):
                workflow = workflow_path.read_text(encoding="utf-8")
                for forbidden in ("merge-base", "--is-ancestor", "branch --contains"):
                    self.assertNotIn(forbidden, workflow)


class CrossRepositoryAuthorityTests(unittest.TestCase):
    def setUp(self) -> None:
        self.root = Path(__file__).resolve().parents[1]

    def test_task_catalog_and_mandatory_retained_sources_are_complete(self) -> None:
        catalog = (
            self.root / "docs/plans/active/README.md"
        ).read_text(encoding="utf-8")
        plan = (
            self.root
            / "docs/plans/active/"
            "eem-9-design-partner-console-dashboard-and-certification.md"
        ).read_text(encoding="utf-8")

        for ordinal in range(1, 11):
            self.assertIn(f"EEM-9/{ordinal:02d}", catalog)
        for source in (
            "EEM - OWASP-аудит и модель угроз",
            "EEM - Полный runbook запуска и эксплуатации",
        ):
            self.assertIn(source, plan)

    def test_task_catalog_aliases_match_the_controlling_plan(self) -> None:
        catalog = (
            self.root / "docs/plans/active/README.md"
        ).read_text(encoding="utf-8")
        plan = (
            self.root
            / "docs/plans/active/"
            "eem-9-design-partner-console-dashboard-and-certification.md"
        ).read_text(encoding="utf-8")

        plan_aliases = dict(
            re.findall(
                r"^### EEM-9/(\d{2}).*?`(EEM-9/\d{2}-[a-z0-9-]+)`",
                plan,
                flags=re.MULTILINE,
            )
        )
        catalog_matches = re.findall(
            r"`Start (EEM-9/(\d{2})-[a-z0-9-]+)",
            catalog,
        )
        catalog_aliases = {
            ordinal: alias
            for alias, ordinal in catalog_matches
        }

        self.assertEqual(set(plan_aliases), {f"{ordinal:02d}" for ordinal in range(1, 11)})
        self.assertEqual(catalog_aliases, plan_aliases)

    def test_frozen_global_lock_input_matches_merged_prerequisite(self) -> None:
        lock_input = json.loads(
            (
                self.root / "docs/authority/eem3-global-lock-input.json"
            ).read_text(encoding="utf-8")
        )

        self.assertEqual(
            lock_input["backend"]["commit"],
            "b23f6ba2b11f583b61200cec63500a782992f1f0",
        )
        self.assertEqual(
            lock_input["manifest"]["sha256"],
            "ff422f622d60f43e41bb78e77a01c665b0dd100b80b701f71296c88486956f8d",
        )
        self.assertEqual(lock_input["verification"]["catalogAttestationTests"], 10)
        self.assertFalse(lock_input["contract"]["newLowerRankAfterHigherAllowed"])
        ranks = lock_input["rankOrder"]
        self.assertEqual(
            ranks,
            [
                "0a.1",
                "0a.2",
                "0b.1",
                "0b.2",
                "1a",
                "1b",
                "1c",
                "2a",
                "2b",
                "3",
                "4",
                "5",
                "6",
                "7",
                "8a",
                "8b",
                "9",
                "10",
                "11a",
                "11b",
                "11c",
                "11d",
                "11e",
                "11f",
                "11g",
                "11h",
                "11i",
                "12a",
                "12b",
                "13",
                "14",
                "15",
                "16a",
                "16b",
                "16c",
                "16d",
                "16e",
            ],
        )

    def test_auth_session_and_transport_baseline_is_frozen(self) -> None:
        baseline = json.loads(
            (
                self.root / "docs/architecture/toolchain-baseline.json"
            ).read_text(encoding="utf-8")
        )

        self.assertEqual(
            baseline["authSession"],
            {
                "absoluteApplicationSession": "8h",
                "concurrentSessionMaximum": 3,
                "dangerousOperationReauthentication": "10m",
                "emailOtpLifetime": "10m",
                "idleExpiry": "30m-visible-tab-human-activity",
                "idleWarning": "5m",
                "jwtLifetime": "15m",
                "oldestSessionReplacementNoticeRequired": True,
                "otpResendCooldown": "60s",
                "touchCoalescing": "1m",
            },
        )
        self.assertEqual(
            baseline["cookieBudget"],
            {
                "aggregateRequestCookieHeaderBytes": 8192,
                "aggregateResponseSetCookieHeaderBytes": 16384,
                "logicalCookieChunkMaximum": 4,
                "logicalCookieChunkValueBytes": 3072,
                "overflowBehavior": "fail-closed-with-cookie-budget-error",
            },
        )
        self.assertEqual(
            baseline["hosting"]["localHttpsOrigin"],
            "https://console.evirion.test:3443",
        )
        self.assertEqual(baseline["hosting"]["trustedProxyHops"], 1)
        self.assertIn(
            "Supabase refresh token",
            baseline["serverBrowserBoundary"]["browserForbidden"],
        )
        self.assertIn(
            "__Host- prefix",
            baseline["serverBrowserBoundary"]["cookieAttributes"],
        )

    def test_governance_waiver_stays_open_and_readiness_blocking(self) -> None:
        evidence = json.loads(
            (
                self.root / "docs/security/repository-governance-evidence.json"
            ).read_text(encoding="utf-8")
        )
        finding = evidence["finding"]

        self.assertEqual(finding["id"], "SEC-2026-012")
        self.assertEqual(finding["status"], "open")
        self.assertTrue(finding["enforcementWaiverApproved"])
        self.assertTrue(finding["readinessBlocking"])
        self.assertEqual(evidence["observations"]["rulesets"]["httpStatus"], 403)
        # Immutable releases were enabled for EEM-9/01b. SEC-2026-012 is about
        # ruleset governance and stays open regardless.
        self.assertEqual(
            evidence["observations"]["immutableReleases"]["result"],
            "enabled",
        )

    def test_dashboard_never_contains_a_supabase_project(self) -> None:
        # The six sibling EEM-9/01 prohibitions expired when EEM-9/02 created the
        # runtime. This one is permanent: the backend owns the database, so a
        # Supabase project here would be a second source of truth. ADR-0003.
        self.assertFalse((self.root / "supabase").exists())

    def test_app_router_urls_are_exactly_the_reviewed_present_set(self) -> None:
        inventory = json.loads(
            (
                self.root / "docs/architecture/console-route-inventory.json"
            ).read_text(encoding="utf-8")
        )
        application = self.root / "src/app"

        self.assertTrue(
            application.is_dir(),
            "the Console scaffold must exist from EEM-9/02 C01 onwards",
        )

        pages, handlers = collect_app_router_routes(application)

        # Resolving URLs, not folder names: a route group that swallows the
        # /auth prefix renders correctly and silently breaks a frozen contract.
        self.assertEqual(pages, sorted(entry["path"] for entry in inventory["present"]))
        self.assertEqual(
            sorted(url for url in handlers if not url.startswith("/api/")),
            [],
        )

    def test_every_present_route_is_frozen_or_declared_with_an_owner(self) -> None:
        inventory = json.loads(
            (
                self.root / "docs/architecture/console-route-inventory.json"
            ).read_text(encoding="utf-8")
        )
        frozen = inventory["frozenPaths"]
        declared = {entry["path"]: entry for entry in inventory["declaredRoutes"]}

        self.assertEqual(
            sorted(frozen),
            sorted(
                [
                    "/auth/*",
                    "/memory",
                    "/memory/:knowledgeObjectId",
                    "/onboarding",
                    "/processing",
                    "/repositories",
                    "/repositories/:repositoryId",
                    "/repositories/:repositoryId/import",
                    "/repositories/:repositoryId/memory",
                    "/repositories/:repositoryId/pull-requests/:prNumber",
                    "/settings/github",
                    "/settings/members",
                    "/settings/usage",
                ]
            ),
        )

        for path, entry in declared.items():
            with self.subTest(declared=path):
                self.assertFalse(
                    matches_frozen_path(path, frozen),
                    "a route already covered by the freeze must not be declared",
                )
                self.assertTrue(entry.get("owner"))
                self.assertTrue(entry.get("rationale"))

        for entry in inventory["present"]:
            path = entry["path"]
            with self.subTest(present=path):
                self.assertTrue(entry.get("owner"))
                self.assertTrue(
                    matches_frozen_path(path, frozen) or path in declared,
                    f"{path} is neither frozen nor declared with an owner",
                )


class AsvsMatrixTests(unittest.TestCase):
    def test_selected_level_two_rows_receive_unique_evidence_cases(self) -> None:
        source = [
            {
                "chapter_id": "V1",
                "chapter_name": "Encoding",
                "section_id": "V1.1",
                "section_name": "Canonicalization",
                "req_id": "V1.1.1",
                "req_description": "Canonicalize input once.",
                "L": "2",
            },
            {
                "chapter_id": "V2",
                "chapter_name": "Validation",
                "section_id": "V2.1",
                "section_name": "Excluded",
                "req_id": "V2.1.1",
                "req_description": "Excluded chapter.",
                "L": "1",
            },
        ]
        assignments = {
            "V1": {
                "primaryOwner": "I01-C",
                "primaryEvidence": "tests/security/xss-corpus.spec.ts",
                "environment": "local-and-staging",
                "verifier": "Dashboard security owner",
                "applicabilityRationale": "Console renders untrusted backend data.",
            }
        }

        rows = build_asvs_matrix(source, {"V1"}, assignments)

        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["id"], "V1.1.1")
        self.assertEqual(
            rows[0]["primaryEvidence"],
            "tests/security/xss-corpus.spec.ts::asvs_v1_1_1",
        )

    def test_missing_chapter_assignment_fails_closed(self) -> None:
        source = [
            {
                "chapter_id": "V1",
                "chapter_name": "Encoding",
                "section_id": "V1.1",
                "section_name": "Canonicalization",
                "req_id": "V1.1.1",
                "req_description": "Canonicalize input once.",
                "L": "1",
            }
        ]

        with self.assertRaisesRegex(AsvsMatrixError, "V1"):
            build_asvs_matrix(source, {"V1"}, {})

    def test_selected_chapter_without_level_two_rows_fails_closed(self) -> None:
        source = [
            {
                "chapter_id": "V1",
                "chapter_name": "Encoding",
                "section_id": "V1.1",
                "section_name": "Canonicalization",
                "req_id": "V1.1.1",
                "req_description": "Level three only.",
                "L": "3",
            }
        ]
        assignments = {
            "V1": {
                "primaryOwner": "I01-C",
                "primaryEvidence": "tests/security/xss-corpus.spec.ts",
                "environment": "local-and-staging",
                "verifier": "Dashboard security owner",
                "applicabilityRationale": "Console renders untrusted backend data.",
            }
        }

        with self.assertRaisesRegex(AsvsMatrixError, "V1"):
            build_asvs_matrix(source, {"V1"}, assignments)

    def test_vendored_source_metadata_is_exactly_pinned(self) -> None:
        root = Path(__file__).resolve().parents[1]
        source = json.loads(
            (
                root / "docs/security/asvs-v5.0.0-l2-source.json"
            ).read_text(encoding="utf-8")
        )
        validate_source_metadata(source)
        source["upstream"]["commit"] = "f" * 40

        with self.assertRaisesRegex(AsvsMatrixError, "metadata"):
            validate_source_metadata(source)


class SecurityControlTests(unittest.TestCase):
    def test_plan_rows_materialize_with_separate_owner_and_evidence(self) -> None:
        plan = """\
| Stable row | Threat/control family | Required prevention | One primary owner/evidence | Secondary contributors |
|---|---|---|---|---|
| `SEC-WEB-001` | Access control | Live membership | Dashboard `EEM-9/07`: `tests/security/tenant.spec.ts` | Backend tests |
"""
        assignments = {
            "SEC-WEB-001": {
                "primaryOwner": "EEM-9/07",
                "primaryEvidence": "tests/security/tenant.spec.ts",
                "environment": "local-and-staging",
                "verifier": "Application security owner",
            }
        }

        rows = build_security_controls(plan, assignments)

        self.assertEqual(rows[0]["id"], "SEC-WEB-001")
        self.assertEqual(rows[0]["primaryOwner"], "EEM-9/07")
        self.assertEqual(rows[0]["primaryEvidence"], "tests/security/tenant.spec.ts")

    def test_missing_security_row_assignment_fails_closed(self) -> None:
        plan = """\
| `SEC-WEB-001` | Access control | Live membership | Owner | Contributor |
"""

        with self.assertRaisesRegex(SecurityControlError, "SEC-WEB-001"):
            build_security_controls(plan, {})

    def test_assignment_evidence_must_match_the_accepted_plan_row(self) -> None:
        plan = """\
| `SEC-WEB-001` | Access control | Live membership | Dashboard `EEM-9/07`: `tests/security/tenant.spec.ts` | Backend tests |
"""
        assignments = {
            "SEC-WEB-001": {
                "primaryOwner": "EEM-9/07",
                "primaryEvidence": "tests/security/different.spec.ts",
                "environment": "local-and-staging",
                "verifier": "Application security owner",
            }
        }

        with self.assertRaisesRegex(SecurityControlError, "evidence"):
            build_security_controls(plan, assignments)

    def test_repository_security_map_preserves_all_stable_rows_and_waiver(self) -> None:
        root = Path(__file__).resolve().parents[1]
        payload = json.loads(
            (root / "docs/security/console-security-controls.yaml").read_text()
        )

        self.assertEqual(
            [row["id"] for row in payload["rows"]],
            [f"SEC-WEB-{ordinal:03d}" for ordinal in range(1, 13)],
        )
        supply_chain = next(
            row for row in payload["rows"] if row["id"] == "SEC-WEB-007"
        )
        self.assertEqual(supply_chain["relatedFinding"], "SEC-2026-012")
        self.assertEqual(supply_chain["findingStatus"], "open")


def apply_negative_case(evidence: dict[str, Any], case: dict[str, Any]) -> dict[str, Any]:
    changed = copy.deepcopy(evidence)
    target = changed
    for part in case["path"][:-1]:
        target = target[part]
    if case.get("remove"):
        del target[case["path"][-1]]
    else:
        target[case["path"][-1]] = case["value"]
    return changed


class ArtifactAttestationPolicyTests(unittest.TestCase):
    def setUp(self) -> None:
        self.policy = {
            "schemaVersion": "1.0",
            "artifacts": {
                "dashboard-authority-v1": {
                    "repository": "Evirion/evirion-engineering-memory-dashboard",
                    "workflowPath": ".github/workflows/authority-release.yml",
                    "refPrefix": "refs/tags/dashboard-authority-v",
                    "refPattern": (
                        r"^refs/tags/dashboard-authority-v[0-9]+\.[0-9]+\.[0-9]+$"
                    ),
                    "eventName": "push",
                    "oidcIssuer": "https://token.actions.githubusercontent.com",
                    "verifier": {
                        "name": "cosign",
                        "version": "v3.1.3",
                        "sha256": "b" * 64,
                    },
                }
            },
            "immutableReleaseEvidence": {
                "maximumAttestationAgeSeconds": 86400,
                "maximumClockSkewSeconds": 300,
                "postPublicationReleaseImmutableRequired": True,
                "preSigningAdministratorAttestationRequired": True,
                "tagScoped": True,
            },
            "publication": {
                "githubImmutableReleaseRequired": True,
                "maximumSigningToReleaseSeconds": 3600,
                "releaseCommitReachableFromDefaultBranchRequired": False,
            },
            "trustedRoot": {"sha256": "a" * 64},
        }
        self.policy["policyDigest"] = compute_policy_digest(self.policy)
        self.evidence = {
            "schemaVersion": "1.0",
            "policyId": "dashboard-authority-v1",
            "policyDigest": self.policy["policyDigest"],
            "subject": {
                "name": "dashboard-authority-v1.0.0.tar.gz",
                "sha256": "c" * 64,
            },
            "signer": {
                "repository": "Evirion/evirion-engineering-memory-dashboard",
                "workflowPath": ".github/workflows/authority-release.yml",
                "ref": "refs/tags/dashboard-authority-v1.0.0",
                "commit": "d" * 40,
                "eventName": "push",
                "oidcIssuer": "https://token.actions.githubusercontent.com",
            },
            "release": {
                "tag": "dashboard-authority-v1.0.0",
                "assetId": 1234,
                "assetName": "dashboard-authority-v1.0.0.tar.gz",
                "immutable": True,
                "assetSha256": "c" * 64,
                "publishedAt": 1787840300,
            },
            "immutableReleaseAttestation": {
                "schemaVersion": "1.0",
                "repository": "Evirion/evirion-engineering-memory-dashboard",
                "tag": "dashboard-authority-v1.0.0",
                "immutableReleasesEnabled": True,
                "attestedAt": "2026-08-27T14:08:20Z",
                "observedBy": "repository-administrator",
            },
            "rekor": {
                "uuid": "e" * 64,
                "integratedTime": 1787840000,
                "inclusionProofVerified": True,
            },
            "verifier": {
                "name": "cosign",
                "version": "v3.1.3",
                "sha256": "b" * 64,
                "trustedRootSha256": "a" * 64,
            },
            "cryptographicVerification": {
                "bundleVerified": True,
                "certificateIdentity": (
                    "https://github.com/Evirion/"
                    "evirion-engineering-memory-dashboard/"
                    ".github/workflows/authority-release.yml@"
                    "refs/tags/dashboard-authority-v1.0.0"
                ),
                "workflowRepositoryVerified": True,
                "workflowRefVerified": True,
                "workflowShaVerified": True,
                "workflowTriggerVerified": True,
            },
        }

    def _validate(
        self,
        *,
        policy: dict[str, object] | None = None,
        evidence: dict[str, object] | None = None,
        expected_policy_digest: str | None = None,
    ) -> None:
        selected_policy = policy or self.policy
        validate_attestation_evidence(
            selected_policy,
            evidence or self.evidence,
            expected_policy_id="dashboard-authority-v1",
            expected_subject_sha256="c" * 64,
            expected_source_commit="d" * 40,
            expected_policy_digest=(
                expected_policy_digest or self.policy["policyDigest"]
            ),
            expected_release_tag="dashboard-authority-v1.0.0",
            expected_release_asset_id=1234,
        )

    def test_exact_attestation_evidence_is_accepted(self) -> None:
        self._validate()

    def test_every_trust_substitution_is_rejected(self) -> None:
        mutations = {
            "replaced asset": ("release", "assetSha256", "f" * 64),
            "mutable release": ("release", "immutable", False),
            "wrong release tag": ("release", "tag", "dashboard-authority-v2.0.0"),
            "wrong release asset id": ("release", "assetId", 4321),
            "wrong release asset name": ("release", "assetName", "other.tar.gz"),
            "wrong repository": ("signer", "repository", "Other/repository"),
            "wrong workflow": ("signer", "workflowPath", ".github/workflows/other.yml"),
            "wrong ref": ("signer", "ref", "refs/heads/main"),
            "wrong trigger": ("signer", "eventName", "pull_request_target"),
            "wrong issuer": ("signer", "oidcIssuer", "https://issuer.invalid"),
            "wrong digest": ("subject", "sha256", "f" * 64),
            "stale policy": ("root", "policyDigest", "f" * 64),
            "unregistered artifact": ("root", "policyId", "console-contract-v1"),
            "unpinned verifier": ("verifier", "sha256", ""),
            "unpinned trusted root": ("verifier", "trustedRootSha256", ""),
            "missing inclusion proof": ("rekor", "inclusionProofVerified", False),
            "malformed Rekor UUID": ("rekor", "uuid", "not-a-uuid"),
            "stale Rekor evidence": ("rekor", "integratedTime", 1780000000),
            "stale attestation": (
                "immutableReleaseAttestation",
                "attestedAt",
                "2026-08-25T00:00:00Z",
            ),
            "post-dated attestation": (
                "immutableReleaseAttestation",
                "attestedAt",
                "2026-08-27T14:30:00Z",
            ),
            "attestation for another tag": (
                "immutableReleaseAttestation",
                "tag",
                "dashboard-authority-v2.0.0",
            ),
            "unverified workflow sha": (
                "cryptographicVerification",
                "workflowShaVerified",
                False,
            ),
        }

        for label, (section, key, value) in mutations.items():
            with self.subTest(label=label):
                changed = copy.deepcopy(self.evidence)
                if section == "root":
                    changed[key] = value
                else:
                    changed[section][key] = value
                with self.assertRaises(AttestationPolicyError):
                    self._validate(evidence=changed)

    def test_missing_administrator_attestation_is_rejected(self) -> None:
        changed = copy.deepcopy(self.evidence)
        del changed["immutableReleaseAttestation"]

        with self.assertRaises(AttestationPolicyError):
            self._validate(evidence=changed)

    def test_absent_release_immutable_field_is_rejected(self) -> None:
        changed = copy.deepcopy(self.evidence)
        del changed["release"]["immutable"]

        with self.assertRaisesRegex(AttestationPolicyError, "immutable"):
            self._validate(evidence=changed)

    def test_policy_requiring_default_branch_reachability_is_refused(self) -> None:
        changed_policy = copy.deepcopy(self.policy)
        changed_policy["publication"][
            "releaseCommitReachableFromDefaultBranchRequired"
        ] = True
        changed_policy["policyDigest"] = compute_policy_digest(changed_policy)
        changed_evidence = copy.deepcopy(self.evidence)
        changed_evidence["policyDigest"] = changed_policy["policyDigest"]

        with self.assertRaisesRegex(AttestationPolicyError, "reachability"):
            self._validate(
                policy=changed_policy,
                evidence=changed_evidence,
                expected_policy_digest=changed_policy["policyDigest"],
            )

    def test_policy_content_change_requires_new_policy_digest(self) -> None:
        changed_policy = copy.deepcopy(self.policy)
        changed_policy["artifacts"]["dashboard-authority-v1"]["repository"] = (
            "Other/repository"
        )
        changed_policy["policyDigest"] = compute_policy_digest(changed_policy)
        changed_evidence = copy.deepcopy(self.evidence)
        changed_evidence["signer"]["repository"] = "Other/repository"
        changed_evidence["policyDigest"] = changed_policy["policyDigest"]
        changed_evidence["cryptographicVerification"]["certificateIdentity"] = (
            "https://github.com/Other/repository/"
            ".github/workflows/authority-release.yml@"
            "refs/tags/dashboard-authority-v1.0.0"
        )

        with self.assertRaisesRegex(AttestationPolicyError, "policyDigest"):
            self._validate(
                policy=changed_policy,
                evidence=changed_evidence,
                expected_policy_digest=self.policy["policyDigest"],
            )

    def test_fixture_shape_is_json_serializable(self) -> None:
        json.dumps({"policy": self.policy, "evidence": self.evidence})

    def test_repository_policy_fixture_rejects_every_required_negative(self) -> None:
        root = Path(__file__).resolve().parents[1]
        policy = json.loads(
            (root / "docs/security/artifact-attestation-policy.json").read_text()
        )
        fixture = json.loads(
            (
                root
                / "docs/security/fixtures/artifact-attestation-negative-cases.json"
            ).read_text()
        )
        self.assertEqual(policy["policyDigest"], compute_policy_digest(policy))
        self.assertEqual(
            sorted(artifact["policyId"] for artifact in fixture["artifacts"]),
            sorted(policy["artifacts"]),
        )

        required_new_cases = {
            "absent-release-immutable-field",
            "immutable-release-attestation-for-another-tag",
            "missing-immutable-release-attestation",
            "post-dated-immutable-release-attestation",
            "stale-immutable-release-attestation",
        }
        for artifact in fixture["artifacts"]:
            expectations = {
                "expected_policy_id": artifact["policyId"],
                "expected_subject_sha256": artifact["expectedSubjectSha256"],
                "expected_source_commit": artifact["expectedSourceCommit"],
                "expected_policy_digest": artifact["expectedPolicyDigest"],
                "expected_release_tag": artifact["expectedReleaseTag"],
                "expected_release_asset_id": artifact["expectedReleaseAssetId"],
            }
            with self.subTest(artifact=artifact["policyId"]):
                validate_attestation_evidence(
                    policy, artifact["validEvidence"], **expectations
                )
                identifiers = {case["id"] for case in artifact["negativeCases"]}
                self.assertEqual(len(identifiers), len(artifact["negativeCases"]))
                self.assertTrue(required_new_cases.issubset(identifiers))
            for case in artifact["negativeCases"]:
                with self.subTest(artifact=artifact["policyId"], case=case["id"]):
                    changed = apply_negative_case(artifact["validEvidence"], case)
                    with self.assertRaises(AttestationPolicyError):
                        validate_attestation_evidence(policy, changed, **expectations)

    def test_published_console_contract_evidence_is_accepted(self) -> None:
        root = Path(__file__).resolve().parents[1]
        policy = json.loads(
            (root / "docs/security/artifact-attestation-policy.json").read_text()
        )
        lock = json.loads(
            (root / "docs/contracts/console-contract-lock.json").read_text()
        )
        evidence = json.loads((root / lock["evidencePath"]).read_text())

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


if __name__ == "__main__":
    unittest.main()
