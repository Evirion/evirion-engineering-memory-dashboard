"""Verify the pinned backend Auth settings against the backend sibling.

CI verifies the Dashboard policy against the pinned values in
``docs/contracts/backend-auth-config-lock.json`` alone, because no Dashboard
workflow token can read the backend repository. This script closes the other
half locally: it re-reads the backend at the exact commit the attestation-
verified Console contract lock records and proves the pinned bytes and derived
settings still match.

It reads the sibling with ``git show`` and never mutates it.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path
from typing import Any


class AuthParityError(ValueError):
    """Raised when the pinned backend Auth settings no longer match."""


def _read_at_commit(backend: Path, commit: str, path: str) -> bytes:
    result = subprocess.run(
        ["git", "-C", str(backend), "show", f"{commit}:{path}"],
        capture_output=True,
        check=False,
    )
    if result.returncode != 0:
        raise AuthParityError(
            f"cannot read {path} at {commit[:8]}: {result.stderr.decode().strip()}"
        )
    return result.stdout


def _section(config: str, name: str) -> str:
    pattern = re.compile(rf"^\[{re.escape(name)}\]$(.*?)(?=^\[|\Z)", re.MULTILINE | re.DOTALL)
    match = pattern.search(config)
    if match is None:
        raise AuthParityError(f"missing [{name}] section in backend Auth configuration")
    return match.group(1)


def _value(section: str, key: str) -> str:
    match = re.search(rf"^{re.escape(key)}\s*=\s*(.+)$", section, re.MULTILINE)
    if match is None:
        raise AuthParityError(f"missing key {key} in backend Auth configuration")
    return match.group(1).strip()


def observed_settings(config: str) -> dict[str, Any]:
    auth = _section(config, "auth")
    email = _section(config, "auth.email")
    sms = _section(config, "auth.sms")
    totp = _section(config, "auth.mfa.totp")

    return {
        "signupEnabled": _value(auth, "enable_signup") == "true",
        "anonymousSignInsEnabled": _value(auth, "enable_anonymous_sign_ins") == "true",
        "smsSignupEnabled": _value(sms, "enable_signup") == "true",
        "smsConfirmationsEnabled": _value(sms, "enable_confirmations") == "true",
        "totpEnrollEnabled": _value(totp, "enroll_enabled") == "true",
        "totpVerifyEnabled": _value(totp, "verify_enabled") == "true",
        "jwtExpirySeconds": int(_value(auth, "jwt_expiry")),
        "otpExpirySeconds": int(_value(email, "otp_expiry")),
        "otpLength": int(_value(email, "otp_length")),
        "otpMaxFrequency": _value(email, "max_frequency").strip('"'),
        "siteUrl": _value(auth, "site_url").strip('"'),
        "additionalRedirectUrls": json.loads(_value(auth, "additional_redirect_urls")),
    }


def verify(root: Path, backend: Path) -> str:
    lock = json.loads(
        (root / "docs/contracts/backend-auth-config-lock.json").read_text(encoding="utf-8")
    )
    contract = json.loads(
        (root / "docs/contracts/console-contract-lock.json").read_text(encoding="utf-8")
    )

    commit = lock["source"]["commit"]
    if commit != contract["sourceCommit"]:
        raise AuthParityError(
            "the pinned Auth commit must equal the attestation-verified contract source commit"
        )

    for entry in lock["source"]["files"]:
        observed = hashlib.sha256(_read_at_commit(backend, commit, entry["path"])).hexdigest()
        if observed != entry["sha256"]:
            raise AuthParityError(
                f"{entry['path']} digest drifted: expected {entry['sha256']}, found {observed}"
            )

    config = _read_at_commit(backend, commit, "supabase/config.toml").decode("utf-8")
    expected = lock["expectedLocalAuthConfiguration"]
    observed = observed_settings(config)

    drift = sorted(key for key, value in expected.items() if observed.get(key) != value)
    if drift:
        raise AuthParityError("backend Auth settings drifted: " + ", ".join(drift))

    # Public signup must be closed no matter which key a future edit touches.
    if observed["signupEnabled"] or observed["anonymousSignInsEnabled"]:
        raise AuthParityError("public signup or anonymous sign-in is enabled in the backend")

    return commit


def _main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--backend", type=Path, required=True)
    arguments = parser.parse_args()

    commit = verify(arguments.root.resolve(), arguments.backend.resolve())
    print(f"backend Auth parity verified at {commit[:8]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(_main())
