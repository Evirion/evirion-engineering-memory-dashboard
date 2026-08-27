from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path
from typing import Any


class AcceptanceMapError(ValueError):
    """Raised when a requirement row has no unique frozen owner."""


REQUIREMENT_HEADING = re.compile(
    r"^(?P<marks>#{3,6})\s+"
    r"(?P<id>(?:G|J|AUTH|GH|ENT|REPO|BF|MEM|KD|REV|LIFE|PR|PROC|SET|OPS|"
    r"MET|BR|NFR-[A-Z]+)-\d{3})\b.*$",
    re.MULTILINE,
)
MARKDOWN_HEADING = re.compile(r"^(?P<marks>#{1,6})\s+.+$", re.MULTILINE)
REQUIREMENT_ID = re.compile(
    r"^(?:G|J|AUTH|GH|ENT|REPO|BF|MEM|KD|REV|LIFE|PR|PROC|SET|OPS|MET|BR|"
    r"NFR-[A-Z]+)-\d{3}$"
)
ACCEPTANCE_HEADING = re.compile(r"^\*{0,2}Acceptance:\*{0,2}\s*$", re.MULTILINE)
BULLET = re.compile(r"^-\s+(?P<text>.+(?:\n(?: {2,}|\t).+)*)", re.MULTILINE)
TRACEABILITY_ROW = re.compile(
    r"^\|\s*`?(?P<id>[^`|]+)`?\s*\|\s*"
    r"(?P<owner>[^|]+?)\s*\|\s*(?P<evidence>[^|]+?)\s*\|",
    re.MULTILINE,
)
BOOTSTRAP_ROW_ID = re.compile(r"^\|\s*`(?P<id>P01-A\d{3})`\s*\|", re.MULTILINE)
BOOTSTRAP_ACCEPTANCE = (
    (
        "P01-A001",
        "Exact merged backend prerequisite and preserved initial Dashboard history.",
        "P01-dashboard",
        (
            "tests.test_bootstrap_contract.RepositoryBootstrapFilesTests."
            "test_initial_license_and_first_ignore_rule_are_preserved"
        ),
    ),
    (
        "P01-A002",
        "Accepted authority notes migrate with exact source digests and safe links.",
        "P01-dashboard",
        "scripts.migrate_authority_sources::migrate_sources",
    ),
    (
        "P01-A003",
        "Every product acceptance row has one immutable primary owner and test.",
        "P01-dashboard",
        "scripts.generate_acceptance_map::build_acceptance_rows",
    ),
    (
        "P01-A004",
        "Every selected ASVS Level 2 row has one owner, evidence, environment, "
        "verifier, and applicability rationale.",
        "P01-dashboard",
        "scripts.generate_asvs_matrix::build_asvs_matrix",
    ),
    (
        "P01-A005",
        "Authority documentation has no broken, deleted, escaping, unresolved-wiki, "
        "or machine-local link.",
        "P01-dashboard",
        "scripts.check_docs::validate_document_tree",
    ),
    (
        "P01-A006",
        "Authority manifest and package are deterministic and immutable by digest.",
        "P01-dashboard",
        (
            "tests.test_bootstrap_contract.AuthorityPackageTests."
            "test_archive_is_deterministic_and_contains_only_manifest_inventory"
        ),
    ),
    (
        "P01-A007",
        "Replaced asset, mutable release, wrong identity/ref/digest, stale policy, "
        "and unpinned verifier fail closed.",
        "P01-dashboard",
        (
            "tests.test_bootstrap_contract.ArtifactAttestationPolicyTests."
            "test_repository_policy_fixture_rejects_every_required_negative"
        ),
    ),
    (
        "P01-A008",
        "Repository controls record the approved bootstrap waiver while "
        "SEC-2026-012 remains open and readiness-blocking.",
        "P01-dashboard",
        (
            "tests.test_bootstrap_contract.CrossRepositoryAuthorityTests."
            "test_governance_waiver_stays_open_and_readiness_blocking"
        ),
    ),
    (
        "P01-A009",
        "Auth/session, server-only token, cookie/header, origin, proxy, TLS, "
        "recovery, and no-store boundaries are frozen.",
        "P01-dashboard",
        (
            "tests.test_bootstrap_contract.CrossRepositoryAuthorityTests."
            "test_auth_session_and_transport_baseline_is_frozen"
        ),
    ),
    (
        "P01-A010",
        "Merged EEM-3 global lock graph and catalog digests remain non-contradictory.",
        "P01-backend",
        (
            "tests.test_bootstrap_contract.CrossRepositoryAuthorityTests."
            "test_frozen_global_lock_input_matches_merged_prerequisite"
        ),
    ),
    (
        "P01-A011",
        "Backend stable pointer binds the exact merged Dashboard commit, manifest "
        "path, and authority package digest.",
        "P01-backend",
        (
            "services/model-orchestration/tests/unit/"
            "test_dashboard_authority_pointer.py::test_exact_dashboard_pointer"
        ),
    ),
    (
        "P01-A012",
        "Both repositories expose the same EEM-9/01 through EEM-9/10 catalog and "
        "mandatory reading-map locators.",
        "P01-backend",
        (
            "services/model-orchestration/tests/unit/"
            "test_dashboard_authority_pointer.py::test_catalog_and_reading_map"
        ),
    ),
    (
        "P01-A013",
        "Bootstrap creates no Dashboard runtime or remote/paid/customer-data change.",
        "P01-dashboard",
        (
            "tests.test_bootstrap_contract.CrossRepositoryAuthorityTests."
            "test_no_dashboard_runtime_scaffold_exists_in_bootstrap"
        ),
    ),
)


def _normalize_block(value: str) -> str:
    return " ".join(line.strip() for line in value.strip().splitlines())


def _requirement_blocks(requirements_text: str) -> list[tuple[str, str]]:
    matches = list(REQUIREMENT_HEADING.finditer(requirements_text))
    blocks: list[tuple[str, str]] = []
    seen: set[str] = set()
    for match in matches:
        requirement_id = match.group("id")
        if requirement_id in seen:
            raise AcceptanceMapError(f"duplicate requirement: {requirement_id}")
        seen.add(requirement_id)
        requirement_level = len(match.group("marks"))
        end = len(requirements_text)
        for heading in MARKDOWN_HEADING.finditer(requirements_text, match.end()):
            if len(heading.group("marks")) <= requirement_level:
                end = heading.start()
                break
        blocks.append((requirement_id, requirements_text[match.end() : end]))
    return blocks


def _acceptance_texts(body: str) -> list[str]:
    acceptance = ACCEPTANCE_HEADING.search(body)
    if acceptance is None:
        normalized = _normalize_block(body)
        if not normalized:
            raise AcceptanceMapError("implicit acceptance statement is empty")
        return [normalized]

    acceptance_body = body[acceptance.end() :]
    texts = [_normalize_block(match.group("text")) for match in BULLET.finditer(acceptance_body)]
    if not texts:
        raise AcceptanceMapError("explicit Acceptance block has no bullets")
    return texts


def _strip_code_ticks(value: str) -> str:
    stripped = value.strip()
    if stripped.startswith("`") and stripped.endswith("`"):
        return stripped[1:-1]
    return stripped


def extract_owner_map(implementation_plan: str) -> dict[str, dict[str, str]]:
    owners: dict[str, dict[str, str]] = {}
    for match in TRACEABILITY_ROW.finditer(implementation_plan):
        requirement_id = _strip_code_ticks(match.group("id"))
        if REQUIREMENT_ID.fullmatch(requirement_id) is None:
            continue
        owner = _strip_code_ticks(match.group("owner"))
        evidence = _strip_code_ticks(match.group("evidence"))
        entry = {
            "primaryOwner": owner,
            "primaryEvidence": evidence,
        }
        existing = owners.get(requirement_id)
        if existing is not None and existing != entry:
            raise AcceptanceMapError(
                f"conflicting owner rows for {requirement_id}"
            )
        owners[requirement_id] = entry
    if not owners:
        raise AcceptanceMapError("no frozen traceability owner rows found")
    return dict(sorted(owners.items()))


def build_acceptance_rows(
    requirements_text: str,
    owners: dict[str, dict[str, str]],
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    blocks = _requirement_blocks(requirements_text)
    if not blocks:
        raise AcceptanceMapError("no stable requirement headings found")

    for requirement_id, body in blocks:
        owner = owners.get(requirement_id)
        if owner is None:
            raise AcceptanceMapError(f"missing owner for {requirement_id}")
        primary_owner = owner.get("primaryOwner")
        primary_evidence = owner.get("primaryEvidence")
        if not primary_owner or not primary_evidence:
            raise AcceptanceMapError(f"incomplete owner for {requirement_id}")

        for ordinal, text in enumerate(_acceptance_texts(body), start=1):
            row_id = f"{requirement_id}.A{ordinal}"
            rows.append(
                {
                    "id": row_id,
                    "requirementId": requirement_id,
                    "case": row_id,
                    "text": text,
                    "primaryOwner": primary_owner,
                    "primaryEvidence": primary_evidence,
                }
            )

    unknown_owners = sorted(set(owners) - {requirement_id for requirement_id, _ in blocks})
    if unknown_owners:
        raise AcceptanceMapError(
            f"owners reference unknown requirements: {', '.join(unknown_owners)}"
        )
    return rows


def bootstrap_acceptance_rows(contract_text: str) -> list[dict[str, str]]:
    source_ids = [match.group("id") for match in BOOTSTRAP_ROW_ID.finditer(contract_text)]
    expected_ids = [row_id for row_id, _, _, _ in BOOTSTRAP_ACCEPTANCE]
    if source_ids != expected_ids:
        raise AcceptanceMapError(
            "EEM-9/01 bootstrap acceptance table does not match frozen row inventory"
        )
    return [
        {
            "id": row_id,
            "requirementId": "EEM-9/01",
            "case": row_id,
            "text": text,
            "primaryOwner": owner,
            "primaryEvidence": evidence,
        }
        for row_id, text, owner, evidence in BOOTSTRAP_ACCEPTANCE
    ]


def _canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def _load_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise AcceptanceMapError(f"cannot read JSON {path}: {exc}") from exc


def _main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--root",
        type=Path,
        default=Path(__file__).resolve().parents[1],
    )
    parser.add_argument("--write", action="store_true")
    arguments = parser.parse_args()
    root = arguments.root.resolve()
    requirements_path = root / "docs/product/design-partner-console-requirements.md"
    implementation_path = root / "docs/plans/design-partner-console-implementation.md"
    bootstrap_path = root / "docs/plans/eem-9-01-bootstrap-contract.md"
    owners_path = root / "docs/requirements/ownership.json"
    output_path = root / "docs/requirements/acceptance-map.yaml"

    requirements_text = requirements_path.read_text(encoding="utf-8")
    extracted_owners = extract_owner_map(
        implementation_path.read_text(encoding="utf-8")
    )
    if arguments.write:
        owners_path.parent.mkdir(parents=True, exist_ok=True)
        owners_path.write_text(_canonical_json(extracted_owners), encoding="utf-8")
    owners = _load_json(owners_path)
    if not isinstance(owners, dict) or owners != extracted_owners:
        raise AcceptanceMapError("ownership map drift; regenerate it")
    product_rows = build_acceptance_rows(requirements_text, owners)
    bootstrap_rows = bootstrap_acceptance_rows(
        bootstrap_path.read_text(encoding="utf-8")
    )
    rows = product_rows + bootstrap_rows
    payload = {
        "schemaVersion": "1.0",
        "source": requirements_path.relative_to(root).as_posix(),
        "sourceSha256": hashlib.sha256(requirements_path.read_bytes()).hexdigest(),
        "bootstrapSource": bootstrap_path.relative_to(root).as_posix(),
        "bootstrapSourceSha256": hashlib.sha256(
            bootstrap_path.read_bytes()
        ).hexdigest(),
        "productRowCount": len(product_rows),
        "bootstrapRowCount": len(bootstrap_rows),
        "rowCount": len(rows),
        "rows": rows,
    }
    rendered = _canonical_json(payload)

    if arguments.write:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(rendered, encoding="utf-8")
        print(f"wrote {len(rows)} stable acceptance rows")
        return 0

    if output_path.read_text(encoding="utf-8") != rendered:
        raise AcceptanceMapError("acceptance map drift; regenerate it")
    print(f"acceptance map verified: {len(rows)} rows")
    return 0


if __name__ == "__main__":
    raise SystemExit(_main())
