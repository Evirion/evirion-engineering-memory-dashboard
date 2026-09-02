from __future__ import annotations

import argparse
import re
from pathlib import Path


SECRET_PATTERNS = {
    "private-key": re.compile(
        r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"
    ),
    "github-token": re.compile(r"\bgh[pousr]_[A-Za-z0-9]{30,}\b"),
    "provider-token": re.compile(r"\bsk-[A-Za-z0-9_-]{20,}\b"),
    "aws-access-key": re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    "credentialed-postgres-dsn": re.compile(
        r"\bpostgres(?:ql)?://[^:/\s]+:[^@/\s]+@"
    ),
    "sensitive-environment-value": re.compile(
        r"(?:ANTHROPIC_API_KEY|OPENAI_API_KEY|SUPABASE_SERVICE_ROLE_KEY|"
        r"GITHUB_TOKEN)\s*[:=]\s*['\"]?"
        r"(?!\$\{\{|<|REDACTED|example)[A-Za-z0-9_./+=-]{20,}"
    ),
}
# Mirrors scripts/check_authority.py. Installed dependencies and generated
# output are not tracked repository content, and scanning them reports another
# project's documentation as this repository's secret.
EXCLUDED_PARTS = {
    ".git",
    ".idea",
    ".local",
    ".next",
    ".venv",
    "__pycache__",
    "coverage",
    "dist",
    "node_modules",
    "playwright-report",
    "test-results",
}
EXCLUDED_SUFFIXES = {".pyc", ".png", ".jpg", ".jpeg", ".gif", ".webp"}


def scan_files(root: Path, files: list[Path]) -> list[str]:
    errors: list[str] = []
    for path in sorted(files):
        try:
            text = path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue
        try:
            display_path = path.relative_to(root).as_posix()
        except ValueError:
            display_path = path.as_posix()
        for rule, pattern in SECRET_PATTERNS.items():
            if pattern.search(text):
                errors.append(f"{display_path}: possible {rule}")
    return errors


def _repository_files(root: Path) -> list[Path]:
    return [
        path
        for path in root.rglob("*")
        if path.is_file()
        and not EXCLUDED_PARTS.intersection(path.relative_to(root).parts)
        and path.suffix.lower() not in EXCLUDED_SUFFIXES
    ]


def _main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--root",
        type=Path,
        default=Path(__file__).resolve().parents[1],
    )
    arguments = parser.parse_args()
    root = arguments.root.resolve()
    errors = scan_files(root, _repository_files(root))
    if errors:
        for error in errors:
            print(error)
        return 1
    print("repository secret patterns verified")
    return 0


if __name__ == "__main__":
    raise SystemExit(_main())
