from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path
from typing import Any


class AsvsMatrixError(ValueError):
    """Raised when the Console ASVS ownership matrix is incomplete or drifts."""


ASVS_COMMIT = "5cf9b032440be53ce345ab3c130fda46ba1ce7a2"
ASVS_BLOB = "f7ae2926598c4648ff7614a6968e4c8fd89524bd"
ASVS_PATH = (
    "5.0/docs_en/"
    "OWASP_Application_Security_Verification_Standard_5.0.0_en.flat.json"
)
ASVS_FULL_SOURCE_SHA256 = (
    "8201b20eec2908c3380ac600c91c8ba746346fbb808859366abb232027532311"
)
SELECTED_CHAPTERS = {
    "V1",
    "V3",
    "V4",
    "V6",
    "V7",
    "V8",
    "V9",
    "V10",
    "V12",
    "V13",
    "V14",
    "V15",
    "V16",
}
EXPECTED_UPSTREAM = {
    "repository": "OWASP/ASVS",
    "commit": ASVS_COMMIT,
    "blob": ASVS_BLOB,
    "path": ASVS_PATH,
    "sha256": ASVS_FULL_SOURCE_SHA256,
    "license": "CC BY-SA 4.0",
}
EXPECTED_SELECTION = {
    "chapters": sorted(SELECTED_CHAPTERS),
    "maximumLevel": 2,
}


ASSIGNMENTS = {
    "V1": {
        "primaryOwner": "I01-C",
        "primaryEvidence": "tests/security/xss-corpus.spec.ts",
        "environment": "local-and-staging",
        "verifier": "Dashboard security owner",
        "applicabilityRationale": (
            "The Console renders and transforms untrusted contract data."
        ),
    },
    "V3": {
        "primaryOwner": "C01",
        "primaryEvidence": "tests/security/headers-cache-isolation.spec.ts",
        "environment": "local-and-staging",
        "verifier": "Dashboard security owner",
        "applicabilityRationale": (
            "The Next.js browser surface must enforce client-side security controls."
        ),
    },
    "V4": {
        "primaryOwner": "I01-C",
        "primaryEvidence": "tests/security/web-boundary.spec.ts",
        "environment": "local-and-staging",
        "verifier": "Dashboard security owner",
        "applicabilityRationale": (
            "Every Browser-to-BFF-to-backend request crosses a validated web boundary."
        ),
    },
    "V6": {
        "primaryOwner": "C02",
        "primaryEvidence": "tests/security/auth-session-recovery.spec.ts",
        "environment": "local-and-staging",
        "verifier": "Auth security owner",
        "applicabilityRationale": (
            "Invite-only email OTP and TOTP MFA authenticate Console principals."
        ),
    },
    "V7": {
        "primaryOwner": "C02",
        "primaryEvidence": "tests/security/auth-session-recovery.spec.ts",
        "environment": "local-and-staging",
        "verifier": "Auth security owner",
        "applicabilityRationale": (
            "The application owns server-only session registration and revocation."
        ),
    },
    "V8": {
        "primaryOwner": "I01-C",
        "primaryEvidence": "tests/security/tenant-capability-matrix.spec.ts",
        "environment": "local-and-staging",
        "verifier": "Application security owner",
        "applicabilityRationale": (
            "Every customer route is tenant- and capability-authorized."
        ),
    },
    "V9": {
        "primaryOwner": "C02",
        "primaryEvidence": "tests/security/auth-session-recovery.spec.ts",
        "environment": "local-and-staging",
        "verifier": "Auth security owner",
        "applicabilityRationale": (
            "Supabase JWTs and one-time BFF proofs cross trust boundaries."
        ),
    },
    "V10": {
        "primaryOwner": "C02",
        "primaryEvidence": "tests/security/auth-session-recovery.spec.ts",
        "environment": "local-and-staging",
        "verifier": "Auth security owner",
        "applicabilityRationale": (
            "The server-only HttpOnly BFF token boundary, not browser code, "
            "integrates the identity provider."
        ),
    },
    "V12": {
        "primaryOwner": "I01-C",
        "primaryEvidence": "tests/security/release-surface.spec.ts",
        "environment": "local-and-staging",
        "verifier": "Dashboard security owner",
        "applicabilityRationale": (
            "Static resources, exports, and release assets require bounded handling."
        ),
    },
    "V13": {
        "primaryOwner": "I01-C",
        "primaryEvidence": "tests/security/web-boundary.spec.ts",
        "environment": "local-and-staging",
        "verifier": "Application security owner",
        "applicabilityRationale": (
            "The BFF consumes and exposes versioned HTTP API contracts."
        ),
    },
    "V14": {
        "primaryOwner": "C01",
        "primaryEvidence": "tests/contract/supply-chain-policy.test.ts",
        "environment": "local-and-ci",
        "verifier": "Release security owner",
        "applicabilityRationale": (
            "The Console requires hardened build, configuration, and dependency policy."
        ),
    },
    "V15": {
        "primaryOwner": "I01-C",
        "primaryEvidence": "tests/security/business-logic.spec.ts",
        "environment": "local-and-staging",
        "verifier": "Product security owner",
        "applicabilityRationale": (
            "Entitlement, consent, review, and retry journeys require abuse testing."
        ),
    },
    "V16": {
        "primaryOwner": "I01-B",
        "primaryEvidence": "test_console_security_events_live.py",
        "environment": "local-and-staging",
        "verifier": "Platform security owner",
        "applicabilityRationale": (
            "Security events span Dashboard correlation and backend audit ownership."
        ),
    },
}


def _canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def _sha256(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def _status_source(root: Path) -> dict[str, Any]:
    """Recorded status per ASVS row, or nothing when none has been recorded.

    EEM-9/07 found every row sitting at `planned` because the matrix synthesised
    a case name such as `asvs_v6_1_1` that exists in no suite, and a Python one
    could never be a pytest node at all. Evidence now names the file that proves
    a row, and status comes from here rather than from a literal, so a row can
    only leave `planned` when someone records the command that observed it.
    """

    path = root / "docs/security/asvs-status.json"
    if not path.is_file():
        return {}
    document = _load_object(path)
    rows = document.get("rows")
    if not isinstance(rows, dict):
        raise AsvsMatrixError("asvs-status.json must carry a rows object")
    return rows


def build_asvs_matrix(
    source_requirements: list[dict[str, Any]],
    selected_chapters: set[str],
    assignments: dict[str, dict[str, str]],
    recorded_status: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    recorded_status = recorded_status or {}
    rows: list[dict[str, Any]] = []
    seen: set[str] = set()
    eligible_chapters: set[str] = set()
    for source in source_requirements:
        chapter = source.get("chapter_id")
        if chapter not in selected_chapters:
            continue
        assignment = assignments.get(chapter)
        if assignment is None:
            raise AsvsMatrixError(f"missing ASVS assignment for {chapter}")
        try:
            level = int(source["L"])
            requirement_id = str(source["req_id"])
            description = str(source["req_description"])
        except (KeyError, TypeError, ValueError) as exc:
            raise AsvsMatrixError(f"malformed ASVS source row in {chapter}") from exc
        if level < 1:
            raise AsvsMatrixError(f"invalid ASVS level in {chapter}")
        if level > 2:
            continue
        eligible_chapters.add(chapter)
        if requirement_id in seen:
            raise AsvsMatrixError(f"duplicate ASVS requirement {requirement_id}")
        seen.add(requirement_id)
        evidence = assignment.get("primaryEvidence")
        required_fields = (
            "primaryOwner",
            "primaryEvidence",
            "environment",
            "verifier",
            "applicabilityRationale",
        )
        if not evidence or any(not assignment.get(field) for field in required_fields):
            raise AsvsMatrixError(f"incomplete ASVS assignment for {chapter}")
        rows.append(
            {
                "id": requirement_id,
                "chapter": chapter,
                "level": level,
                "description": description,
                "applicability": "applicable",
                "applicabilityRationale": assignment["applicabilityRationale"],
                "primaryOwner": assignment["primaryOwner"],
                "primaryEvidence": evidence,
                "environment": assignment["environment"],
                "verifier": assignment["verifier"],
                "status": recorded_status.get(requirement_id, {}).get("status", "planned"),
            }
        )

    missing_chapters = sorted(selected_chapters - eligible_chapters)
    if missing_chapters:
        raise AsvsMatrixError(
            f"ASVS source is missing chapters: {', '.join(missing_chapters)}"
        )
    return sorted(rows, key=lambda row: [int(part) for part in row["id"][1:].split(".")])


def _load_object(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise AsvsMatrixError(f"cannot read {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise AsvsMatrixError(f"{path} must contain an object")
    return value


def validate_source_metadata(source: dict[str, Any]) -> None:
    if source.get("schemaVersion") != "1.0":
        raise AsvsMatrixError("vendored ASVS source metadata schema drift")
    if source.get("upstream") != EXPECTED_UPSTREAM:
        raise AsvsMatrixError("vendored ASVS upstream metadata drift")
    if source.get("selection") != EXPECTED_SELECTION:
        raise AsvsMatrixError("vendored ASVS selection metadata drift")
    if not isinstance(source.get("requirements"), list):
        raise AsvsMatrixError("vendored ASVS source requirements must be a list")


def _selected_source(requirements: list[dict[str, Any]]) -> list[dict[str, Any]]:
    selected: list[dict[str, Any]] = []
    for requirement in requirements:
        if requirement.get("chapter_id") not in SELECTED_CHAPTERS:
            continue
        try:
            if int(requirement["L"]) <= 2:
                selected.append(requirement)
        except (KeyError, TypeError, ValueError) as exc:
            raise AsvsMatrixError("malformed upstream ASVS level") from exc
    return selected


def _import_upstream(path: Path) -> dict[str, Any]:
    source_bytes = path.read_bytes()
    if _sha256(source_bytes) != ASVS_FULL_SOURCE_SHA256:
        raise AsvsMatrixError("upstream ASVS source digest drift")
    source = json.loads(source_bytes)
    requirements = source.get("requirements")
    if not isinstance(requirements, list):
        raise AsvsMatrixError("upstream ASVS requirements must be a list")
    return {
        "schemaVersion": "1.0",
        "upstream": EXPECTED_UPSTREAM,
        "selection": EXPECTED_SELECTION,
        "requirements": _selected_source(requirements),
    }


def _matrix_payload(source: dict[str, Any], root: Path) -> dict[str, Any]:
    validate_source_metadata(source)
    requirements = source.get("requirements")
    if not isinstance(requirements, list):
        raise AsvsMatrixError("vendored ASVS requirements must be a list")
    rows = build_asvs_matrix(
        requirements, SELECTED_CHAPTERS, ASSIGNMENTS, _status_source(root)
    )
    if any(row["id"] == "V10.1.1" for row in rows):
        for row in rows:
            if row["id"] == "V10.1.1":
                row["controlBoundary"] = (
                    "Supabase access and refresh tokens remain only in host-scoped "
                    "__Host- cookies with HttpOnly, Secure, SameSite=Lax, Path=/, "
                    "and no Domain; browser JavaScript never receives them."
                )
    else:
        raise AsvsMatrixError("ASVS V10.1.1 is missing")
    requirement_digest = _sha256(
        _canonical_json(requirements).encode()
    )
    return {
        "schemaVersion": "1.0",
        "standard": "OWASP ASVS 5.0.0 Level 2",
        "sourceRequirementSha256": requirement_digest,
        "rowCount": len(rows),
        "rows": rows,
    }


def _main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--root",
        type=Path,
        default=Path(__file__).resolve().parents[1],
    )
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--import-upstream", type=Path)
    arguments = parser.parse_args()
    root = arguments.root.resolve()
    source_path = root / "docs/security/asvs-v5.0.0-l2-source.json"
    matrix_path = root / "docs/security/asvs-v5.0.0-l2-console-evidence.yaml"

    if arguments.import_upstream is not None:
        if not arguments.write:
            raise AsvsMatrixError("--import-upstream requires --write")
        source = _import_upstream(arguments.import_upstream)
        source_path.parent.mkdir(parents=True, exist_ok=True)
        source_path.write_text(_canonical_json(source), encoding="utf-8")
    else:
        source = _load_object(source_path)

    matrix = _matrix_payload(source, root)
    rendered = _canonical_json(matrix)
    if arguments.write:
        matrix_path.write_text(rendered, encoding="utf-8")
        print(f"wrote {matrix['rowCount']} Console ASVS Level 2 rows")
        return 0

    if matrix_path.read_text(encoding="utf-8") != rendered:
        raise AsvsMatrixError("ASVS evidence matrix drift; regenerate it")
    print(f"ASVS evidence matrix verified: {matrix['rowCount']} rows")
    return 0


if __name__ == "__main__":
    raise SystemExit(_main())
