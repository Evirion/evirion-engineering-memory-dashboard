from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path
from typing import Any


class SecurityControlError(ValueError):
    """Raised when a stable Console security row is missing or drifts."""


SECURITY_ROW = re.compile(
    r"^\|\s*`?(?P<id>SEC-WEB-\d{3})`?\s*\|\s*"
    r"(?P<family>.*?)\s*\|\s*"
    r"(?P<prevention>.*?)\s*\|\s*"
    r"(?P<source_owner>.*?)\s*\|\s*"
    r"(?P<contributors>.*?)\s*\|$",
    re.MULTILINE,
)
ASSIGNMENTS = {
    "SEC-WEB-001": {
        "primaryOwner": "EEM-9/07",
        "primaryEvidence": "tests/security/tenant-capability-matrix.spec.ts",
        "environment": "local-and-staging",
        "verifier": "Application security owner",
    },
    "SEC-WEB-002": {
        "primaryOwner": "EEM-9/02",
        "primaryEvidence": "tests/security/auth-session-recovery.spec.ts",
        "environment": "local-and-staging",
        "verifier": "Auth security owner",
    },
    "SEC-WEB-003": {
        "primaryOwner": "EEM-9/02",
        "primaryEvidence": "tests/security/csrf-origin.spec.ts",
        "environment": "local-and-staging",
        "verifier": "Application security owner",
    },
    "SEC-WEB-004": {
        "primaryOwner": "EEM-9/07",
        "primaryEvidence": "tests/security/xss-corpus.spec.ts",
        "environment": "local-and-staging",
        "verifier": "Application security owner",
    },
    "SEC-WEB-005": {
        "primaryOwner": "EEM-9/02",
        "primaryEvidence": "tests/security/redirect-url-boundary.spec.ts",
        "environment": "local-and-staging",
        "verifier": "Application security owner",
    },
    "SEC-WEB-006": {
        "primaryOwner": "EEM-9/02-C01",
        "primaryEvidence": "tests/security/headers-cache-isolation.spec.ts",
        "environment": "local-and-staging",
        "verifier": "Dashboard security owner",
    },
    "SEC-WEB-007": {
        "primaryOwner": "EEM-9/02-C01",
        "primaryEvidence": "tests/contract/supply-chain-policy.test.ts",
        "environment": "local-and-ci",
        "verifier": "Release security owner",
    },
    "SEC-WEB-008": {
        "primaryOwner": "EEM-9/07",
        "primaryEvidence": "tests/security/release-surface.spec.ts",
        "environment": "local-and-staging",
        "verifier": "Release security owner",
    },
    "SEC-WEB-009": {
        "primaryOwner": "EEM-9/07",
        "primaryEvidence": "tests/security/abuse-bounds.spec.ts",
        "environment": "local-and-staging",
        "verifier": "Application security owner",
    },
    "SEC-WEB-010": {
        "primaryOwner": "backend-EEM-9/07",
        "primaryEvidence": (
            "services/model-orchestration/tests/database/"
            "test_console_free_business_logic_live.py"
        ),
        "environment": "local-and-staging",
        "verifier": "Backend security owner",
    },
    "SEC-WEB-011": {
        "primaryOwner": "backend-EEM-9/07",
        "primaryEvidence": (
            "services/model-orchestration/tests/database/"
            "test_console_security_events_live.py"
        ),
        "environment": "local-and-staging",
        "verifier": "Platform security owner",
    },
    "SEC-WEB-012": {
        "primaryOwner": "EEM-9/09",
        "primaryEvidence": (
            "docs/security/evidence/independent-full-platform-report.json"
        ),
        "environment": "authorized-staging-and-independent-retest",
        "verifier": "Independent security owner",
    },
}


def build_security_controls(
    plan_text: str,
    assignments: dict[str, dict[str, str]],
) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    seen: set[str] = set()
    for match in SECURITY_ROW.finditer(plan_text):
        row_id = match.group("id")
        if row_id in seen:
            raise SecurityControlError(f"duplicate security row {row_id}")
        seen.add(row_id)
        assignment = assignments.get(row_id)
        if assignment is None:
            raise SecurityControlError(f"missing assignment for {row_id}")
        required_fields = (
            "primaryOwner",
            "primaryEvidence",
            "environment",
            "verifier",
        )
        if any(not assignment.get(field) for field in required_fields):
            raise SecurityControlError(f"incomplete assignment for {row_id}")
        source_owner = match.group("source_owner")
        evidence_name = Path(assignment["primaryEvidence"]).name
        if row_id != "SEC-WEB-012" and evidence_name not in source_owner:
            raise SecurityControlError(
                f"primary evidence for {row_id} does not match accepted plan row"
            )
        owner_parts = assignment["primaryOwner"].removeprefix("backend-").split("-C", 1)
        if owner_parts[0] not in source_owner:
            raise SecurityControlError(
                f"primary owner for {row_id} does not match accepted plan row"
            )
        if len(owner_parts) == 2 and f"C{owner_parts[1]}" not in source_owner:
            raise SecurityControlError(
                f"primary owner slice for {row_id} does not match accepted plan row"
            )
        row = {
            "id": row_id,
            "threatControlFamily": match.group("family"),
            "requiredPrevention": match.group("prevention"),
            "sourcePrimaryOwnerEvidence": source_owner,
            "secondaryContributors": match.group("contributors"),
            **assignment,
            "status": "planned",
        }
        if row_id == "SEC-WEB-007":
            row["relatedFinding"] = "SEC-2026-012"
            row["findingStatus"] = "open"
            row["enforcementWaiver"] = "bootstrap-only"
        rows.append(row)

    if not rows:
        raise SecurityControlError("no SEC-WEB rows found")
    unknown_assignments = sorted(set(assignments) - seen)
    if unknown_assignments:
        raise SecurityControlError(
            "assignments reference missing rows: " + ", ".join(unknown_assignments)
        )
    return sorted(rows, key=lambda row: row["id"])


def _canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


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
    source_path = (
        root
        / "docs/plans/active/"
        "eem-9-design-partner-console-dashboard-and-certification.md"
    )
    output_path = root / "docs/security/console-security-controls.yaml"
    rows = build_security_controls(
        source_path.read_text(encoding="utf-8"),
        ASSIGNMENTS,
    )
    payload = {
        "schemaVersion": "1.0",
        "source": source_path.relative_to(root).as_posix(),
        "sourceSha256": hashlib.sha256(source_path.read_bytes()).hexdigest(),
        "rowCount": len(rows),
        "rows": rows,
    }
    rendered = _canonical_json(payload)
    if arguments.write:
        output_path.write_text(rendered, encoding="utf-8")
        print(f"wrote {len(rows)} stable Console security controls")
        return 0
    if output_path.read_text(encoding="utf-8") != rendered:
        raise SecurityControlError("Console security control map drift; regenerate it")
    print(f"Console security controls verified: {len(rows)} rows")
    return 0


if __name__ == "__main__":
    raise SystemExit(_main())
