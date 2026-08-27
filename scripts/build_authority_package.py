from __future__ import annotations

import argparse
import gzip
import json
import tarfile
from pathlib import Path
from typing import Any

from .check_authority import AuthorityError, verify_manifest


class AuthorityPackageError(ValueError):
    """Raised when deterministic authority packaging cannot proceed safely."""


def _load_manifest(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise AuthorityPackageError(f"cannot read authority manifest: {exc}") from exc
    if not isinstance(value, dict):
        raise AuthorityPackageError("authority manifest root must be an object")
    return value


def _safe_member(root: Path, relative_value: str) -> Path:
    relative = Path(relative_value)
    if (
        relative.is_absolute()
        or ".." in relative.parts
        or relative.as_posix() != relative_value
    ):
        raise AuthorityPackageError(f"unsafe authority package member: {relative_value}")
    candidate = root / relative
    current = root
    for part in relative.parts:
        current = current / part
        if current.is_symlink():
            raise AuthorityPackageError(
                f"authority package member traverses a symlink: {relative_value}"
            )
    if not candidate.is_file():
        raise AuthorityPackageError(
            f"authority package member is not a regular file: {relative_value}"
        )
    return candidate


def build_authority_archive(
    root: Path,
    manifest_path: Path,
    output_path: Path,
) -> None:
    root = root.resolve()
    manifest_path = manifest_path.resolve()
    try:
        manifest_relative = manifest_path.relative_to(root).as_posix()
    except ValueError as exc:
        raise AuthorityPackageError("manifest must be inside repository root") from exc
    manifest = _load_manifest(manifest_path)
    try:
        verify_manifest(root, manifest)
    except AuthorityError as exc:
        raise AuthorityPackageError(str(exc)) from exc
    entries = manifest.get("files")
    if not isinstance(entries, list):
        raise AuthorityPackageError("authority manifest files must be a list")

    members = [manifest_relative]
    for entry in entries:
        if not isinstance(entry, dict) or not isinstance(entry.get("path"), str):
            raise AuthorityPackageError("authority manifest entry is malformed")
        members.append(entry["path"])
    if len(members) != len(set(members)):
        raise AuthorityPackageError("authority package member inventory has duplicates")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("wb") as raw_output:
        with gzip.GzipFile(
            filename="",
            mode="wb",
            fileobj=raw_output,
            compresslevel=9,
            mtime=0,
        ) as gzip_output:
            with tarfile.open(
                fileobj=gzip_output,
                mode="w",
                format=tarfile.USTAR_FORMAT,
            ) as archive:
                for relative_value in sorted(members):
                    source = _safe_member(root, relative_value)
                    data = source.read_bytes()
                    info = tarfile.TarInfo(relative_value)
                    info.size = len(data)
                    info.mode = 0o644
                    info.uid = 0
                    info.gid = 0
                    info.uname = ""
                    info.gname = ""
                    info.mtime = 0
                    archive.addfile(info, fileobj=_BytesReader(data))


class _BytesReader:
    def __init__(self, value: bytes) -> None:
        self._value = value
        self._offset = 0

    def read(self, size: int = -1) -> bytes:
        if size < 0:
            size = len(self._value) - self._offset
        start = self._offset
        self._offset = min(len(self._value), self._offset + size)
        return self._value[start : self._offset]


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
    parser.add_argument("--output", type=Path, required=True)
    arguments = parser.parse_args()
    root = arguments.root.resolve()
    build_authority_archive(
        root,
        root / arguments.manifest,
        arguments.output.resolve(),
    )
    print(f"wrote deterministic authority package: {arguments.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(_main())
