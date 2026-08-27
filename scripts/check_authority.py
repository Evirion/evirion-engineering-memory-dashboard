from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any


class AuthorityError(ValueError):
    """Raised when tracked authority bytes do not match their manifest."""


EXCLUDED_PARTS = {
    ".git",
    ".idea",
    ".next",
    "__pycache__",
    "coverage",
    "dist",
    "node_modules",
    "playwright-report",
    "test-results",
}
EXCLUDED_NAMES = {".DS_Store"}
EXCLUDED_SUFFIXES = {".pyc"}


def _sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def _canonical_json(value: Any) -> bytes:
    return (
        json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
        + "\n"
    ).encode()


def _safe_relative_path(value: str) -> Path:
    path = Path(value)
    if path.is_absolute() or ".." in path.parts or value != path.as_posix():
        raise AuthorityError(f"unsafe authority path: {value}")
    return path


def build_manifest(root: Path, paths: list[str]) -> dict[str, Any]:
    if len(paths) != len(set(paths)):
        raise AuthorityError("authority path inventory contains duplicates")

    files: list[dict[str, str]] = []
    for value in sorted(paths):
        relative_path = _safe_relative_path(value)
        file_path = root / relative_path
        if not file_path.is_file():
            raise AuthorityError(f"authority file is missing: {value}")
        files.append(
            {
                "path": relative_path.as_posix(),
                "sha256": _sha256_bytes(file_path.read_bytes()),
            }
        )

    return {
        "schemaVersion": "1.0",
        "algorithm": "sha256",
        "files": files,
        "packageSha256": _sha256_bytes(_canonical_json(files)),
    }


def validate_inventory(
    root: Path,
    inventory: list[str],
    *,
    manifest_path: str = "docs/authority/manifest.json",
) -> None:
    if len(inventory) != len(set(inventory)):
        raise AuthorityError("authority package inventory contains duplicates")
    expected = {_safe_relative_path(value).as_posix() for value in inventory}
    actual: set[str] = set()
    for path in root.rglob("*"):
        relative = path.relative_to(root)
        if EXCLUDED_PARTS.intersection(relative.parts):
            continue
        if path.is_symlink():
            raise AuthorityError(f"repository symlink is forbidden: {relative.as_posix()}")
        if (
            not path.is_file()
            or path.name in EXCLUDED_NAMES
            or path.suffix in EXCLUDED_SUFFIXES
            or relative.as_posix() == manifest_path
        ):
            continue
        actual.add(relative.as_posix())

    unlisted = sorted(actual - expected)
    if unlisted:
        raise AuthorityError(
            "unlisted authority files: " + ", ".join(unlisted)
        )
    missing = sorted(expected - actual)
    if missing:
        raise AuthorityError(
            "authority inventory files are missing: " + ", ".join(missing)
        )


def verify_manifest(root: Path, manifest: dict[str, Any]) -> None:
    if manifest.get("schemaVersion") != "1.0":
        raise AuthorityError("unsupported authority manifest schema")
    if manifest.get("algorithm") != "sha256":
        raise AuthorityError("authority manifest algorithm must be sha256")

    entries = manifest.get("files")
    if not isinstance(entries, list):
        raise AuthorityError("authority manifest files must be a list")

    paths: list[str] = []
    for entry in entries:
        if not isinstance(entry, dict):
            raise AuthorityError("authority manifest entry must be an object")
        path = entry.get("path")
        digest = entry.get("sha256")
        if not isinstance(path, str) or not isinstance(digest, str):
            raise AuthorityError("authority manifest entry is malformed")
        paths.append(path)

    actual = build_manifest(root, paths)
    if actual["files"] != entries:
        for expected, observed in zip(entries, actual["files"], strict=True):
            if expected != observed:
                raise AuthorityError(f"authority digest mismatch: {expected['path']}")
        raise AuthorityError("authority manifest file inventory mismatch")
    if manifest.get("packageSha256") != actual["packageSha256"]:
        raise AuthorityError("authority package digest mismatch")


def _load_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise AuthorityError(f"cannot read JSON {path}: {exc}") from exc


def _main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--root",
        type=Path,
        default=Path(__file__).resolve().parents[1],
    )
    parser.add_argument(
        "--manifest",
        type=Path,
        default=Path("docs/authority/manifest.json"),
    )
    parser.add_argument(
        "--inventory",
        type=Path,
        default=Path("docs/authority/package-files.json"),
    )
    parser.add_argument("--write", action="store_true")
    arguments = parser.parse_args()

    root = arguments.root.resolve()
    manifest_relative = _safe_relative_path(arguments.manifest.as_posix())
    inventory_relative = _safe_relative_path(arguments.inventory.as_posix())
    manifest_path = root / manifest_relative
    inventory = _load_json(root / inventory_relative)
    if not isinstance(inventory, list) or not all(
        isinstance(path, str) for path in inventory
    ):
        raise AuthorityError("authority package inventory must be a string list")
    validate_inventory(
        root,
        inventory,
        manifest_path=manifest_relative.as_posix(),
    )
    if arguments.write:
        manifest = build_manifest(root, inventory)
        manifest_path.parent.mkdir(parents=True, exist_ok=True)
        manifest_path.write_bytes(_canonical_json(manifest))
        print(f"wrote {manifest_relative}: {manifest['packageSha256']}")
        return 0

    manifest = _load_json(manifest_path)
    if not isinstance(manifest, dict):
        raise AuthorityError("authority manifest root must be an object")
    manifest_entries = manifest.get("files")
    manifest_paths = (
        [entry.get("path") for entry in manifest_entries]
        if isinstance(manifest_entries, list)
        and all(isinstance(entry, dict) for entry in manifest_entries)
        else []
    )
    if manifest_paths != sorted(inventory):
        raise AuthorityError("authority manifest does not match package inventory")
    verify_manifest(root, manifest)
    print(f"authority package verified: {manifest['packageSha256']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(_main())
