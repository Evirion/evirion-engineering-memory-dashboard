"""Download the pinned Console contract release asset and its Sigstore bundle.

The credential is read from the process environment and is never written to a
file, a log line, an error message, or a repository artifact. Only the release
asset identifiers recorded in the contract lock are requested, so no code path
can reach mutable backend `main`.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any


class ContractDownloadError(RuntimeError):
    """Raised when the pinned release asset cannot be obtained exactly."""


CREDENTIAL_VARIABLE = "CONSOLE_CONTRACT_TOKEN"
API_ROOT = "https://api.github.com"
DOWNLOAD_TIMEOUT_SECONDS = 60


def _credential() -> str:
    token = os.environ.get(CREDENTIAL_VARIABLE, "")
    if not token:
        raise ContractDownloadError(
            f"{CREDENTIAL_VARIABLE} must hold a short-lived contents:read credential"
        )
    return token


def _asset_url(repository: str, asset_id: int) -> str:
    return f"{API_ROOT}/repos/{repository}/releases/assets/{asset_id}"


def download_asset(repository: str, asset_id: int, token: str) -> bytes:
    request = urllib.request.Request(
        _asset_url(repository, asset_id),
        headers={
            "Accept": "application/octet-stream",
            "Authorization": f"Bearer {token}",
            "X-GitHub-Api-Version": "2022-11-28",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=DOWNLOAD_TIMEOUT_SECONDS) as response:
            return response.read()
    except urllib.error.HTTPError as exc:
        raise ContractDownloadError(
            f"release asset {asset_id} was refused with HTTP {exc.code}"
        ) from None
    except urllib.error.URLError:
        raise ContractDownloadError(
            f"release asset {asset_id} could not be reached"
        ) from None


def _write_verified(
    destination: Path,
    payload: bytes,
    expected_sha256: str,
    label: str,
) -> None:
    digest = hashlib.sha256(payload).hexdigest()
    if digest != expected_sha256:
        raise ContractDownloadError(
            f"{label} digest mismatch: expected {expected_sha256}, downloaded {digest}. "
            "Never repair this by accepting the downloaded bytes."
        )
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(payload)


def fetch(lock: dict[str, Any], output_root: Path, token: str) -> list[Path]:
    repository = lock["repository"]
    artifact = lock["artifact"]
    written: list[Path] = []
    for asset_id, name, digest, label in (
        (
            artifact["assetId"],
            artifact["assetName"],
            artifact["assetSha256"],
            "release archive",
        ),
        (
            artifact["bundleAssetId"],
            artifact["bundleName"],
            artifact["bundleSha256"],
            "Sigstore bundle",
        ),
    ):
        destination = output_root / name
        _write_verified(destination, download_asset(repository, asset_id, token), digest, label)
        written.append(destination)
    return written


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
    parser.add_argument("--output", type=Path, required=True)
    arguments = parser.parse_args()

    root = arguments.root.resolve()
    lock = json.loads((root / arguments.lock).read_text(encoding="utf-8"))
    written = fetch(lock, arguments.output.resolve(), _credential())
    for path in written:
        print(f"verified pinned download: {path.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(_main())
