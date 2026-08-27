from __future__ import annotations

import argparse
import hashlib
import os
import re
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import quote


class MigrationError(ValueError):
    """Raised when an accepted source cannot be migrated without ambiguity."""


BACKEND_COMMIT = "b23f6ba2b11f583b61200cec63500a782992f1f0"
MACHINE_LOCAL = re.compile(r"(?:file://)?/(?:Users|home)/[^/\s)]+/")
WIKI_LINK = re.compile(r"\[\[([^\]|]+)(?:\|([^\]]+))?\]\]")


@dataclass(frozen=True)
class SourceSpec:
    source: str
    destination: str
    sha256: str
    source_kind: str


SOURCES = (
    SourceSpec(
        source="10 Evirion/01 Products/EEM - Design Partner Console requirements.md",
        destination="docs/product/design-partner-console-requirements.md",
        sha256="832cc5bf8352d8995598b4256c451dd54fb333683a206c93533dbe4b6e195fd4",
        source_kind="obsidian",
    ),
    SourceSpec(
        source="10 Evirion/Architecture/EEM - Design Partner Console architecture.md",
        destination="docs/architecture/design-partner-console.md",
        sha256="6b011bfb49d1aa8c0bf7c03474b9ef2990a9902305fcaa1d9688fcf21044ba58",
        source_kind="obsidian",
    ),
    SourceSpec(
        source="10 Evirion/Roadmaps/EEM - Design Partner Console implementation plan.md",
        destination="docs/plans/design-partner-console-implementation.md",
        sha256="ab026e23a4a49c13e304adee9d86819f96291970accae71dea08a6c2f5155e41",
        source_kind="obsidian",
    ),
    SourceSpec(
        source="docs/plans/active/eem-9-design-partner-console-dashboard-and-certification.md",
        destination=(
            "docs/plans/active/"
            "eem-9-design-partner-console-dashboard-and-certification.md"
        ),
        sha256="44ac0c4ebe4030cbf24028a3092c35e6ca38d45b52c92d92cd25a2330d16ea97",
        source_kind="backend",
    ),
    SourceSpec(
        source=(
            "docs/superpowers/specs/"
            "2026-08-25-design-partner-console-program-design.md"
        ),
        destination="docs/architecture/design-partner-console-program-design.md",
        sha256="5caa5e785ea625c210d9cd7cbc72e07b00e854c5ea90cbeb276d6792d653ce6d",
        source_kind="backend",
    ),
)


OBSIDIAN_FALLBACKS = {
    "EEM - Design Partner Console requirements": (
        "10 Evirion/01 Products/EEM - Design Partner Console requirements.md"
    ),
    "EEM - Design Partner Console architecture": (
        "10 Evirion/Architecture/EEM - Design Partner Console architecture.md"
    ),
    "EEM - Design Partner Console implementation plan": (
        "10 Evirion/Roadmaps/EEM - Design Partner Console implementation plan.md"
    ),
    "EEM - OWASP-аудит и модель угроз": (
        "10 Evirion/Architecture/EEM - OWASP-аудит и модель угроз.md"
    ),
    "EEM - Полный runbook запуска и эксплуатации": (
        "10 Evirion/Architecture/EEM - Полный runbook запуска и эксплуатации.md"
    ),
}


DASHBOARD_LINKS = {
    "EEM - Design Partner Console requirements": (
        "docs/product/design-partner-console-requirements.md"
    ),
    "EEM - Design Partner Console architecture": (
        "docs/architecture/design-partner-console.md"
    ),
    "EEM - Design Partner Console implementation plan": (
        "docs/plans/design-partner-console-implementation.md"
    ),
}


BACKEND_LINKS = {
    "Evirion Engineering Memory": "",
    "EEM - Архитектура базы данных": (
        "services/model-orchestration/SUPABASE_DATABASE_ARCHITECTURE.md"
    ),
    "EEM - Модель Organization и Repository": (
        "docs/architecture/organization-repository-model.md"
    ),
    "EEM - Сценарии PR Watcher и Backfill": (
        "services/model-orchestration/BACKFILL_RUNBOOK.md"
    ),
}


def _sha256(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def _relative_link(destination: Path, target: str) -> str:
    return Path(os.path.relpath(target, start=destination.parent)).as_posix()


def _obsidian_uri(fallback: str) -> str:
    return (
        "obsidian://open?vault=Obsidian%20Vault&file="
        f"{quote(fallback, safe='')}"
    )


def _wiki_replacement(destination: Path, match: re.Match[str]) -> str:
    title = match.group(1)
    label = match.group(2) or title
    if title in DASHBOARD_LINKS:
        return f"[{label}]({_relative_link(destination, DASHBOARD_LINKS[title])})"
    if title in BACKEND_LINKS:
        target = BACKEND_LINKS[title]
        url = (
            "https://github.com/Evirion/evirion-engineering-memory/"
            f"blob/{BACKEND_COMMIT}/{target}"
        )
        return f"[{label}]({url})"
    if title in OBSIDIAN_FALLBACKS:
        return f"[{label}]({_obsidian_uri(OBSIDIAN_FALLBACKS[title])})"
    raise MigrationError(f"unmapped Obsidian link: {title}")


def _insert_source_header(text: str, header: str) -> str:
    lines = text.splitlines()
    insertion = 0
    if lines and lines[0] == "---":
        try:
            insertion = lines.index("---", 1) + 1
        except ValueError as exc:
            raise MigrationError("unterminated YAML frontmatter") from exc
    lines[insertion:insertion] = ["", header, ""]
    return "\n".join(lines).rstrip() + "\n"


def _correct_current_evidence(text: str, source_fallback: str) -> str:
    if source_fallback.endswith("Design Partner Console requirements.md"):
        old = """\
> [!info] Статус и граница authority
> Пакет требований утверждён пользователем 2026-08-25. Это временная
> Obsidian-спецификация, подготовленная по состоянию
> `evirion-engineering-memory` на 2026-08-24.
> EEM-9/01 переносит её в `Evirion/evirion-engineering-memory-dashboard` как
> version-controlled specification; до этого portable program design
> `docs/superpowers/specs/2026-08-25-design-partner-console-program-design.md`
> и source-controlled EEM-4/EEM-6–9 active plans в backend repository владеют
> requirements/architecture summary, task scope, dependencies и DoD.
>
> Текущий код, executable tests и migrations остаются authority для уже
> реализованного поведения. Эта заметка предлагает целевое
> поведение Design Partner Console, но сама по себе не означает, что оно уже
> реализовано, развёрнуто или сертифицировано."""
        new = """\
> [!info] Accepted Dashboard authority transfer
> Пакет требований утверждён пользователем 2026-08-25 и перенесён в
> `Evirion/evirion-engineering-memory-dashboard` под EEM-9/01. Эта repository
> copy становится detailed authority только на exact Dashboard commit и
> authority-package digest после последовательного merge Dashboard PR и
> backend stable-pointer PR. До обоих merge portable program design и
> source-controlled EEM-4/EEM-6–9 active plans в backend repository остаются
> cross-repository authority.
>
> Текущий код, executable tests и migrations остаются authority для уже
> реализованного поведения. Этот документ задаёт target behavior, но сам по
> себе не означает, что Console реализована, развёрнута или сертифицирована."""
        if text.count(old) != 1:
            raise MigrationError("requirements authority boundary drifted")
        return text.replace(old, new)

    if source_fallback.endswith("Design Partner Console architecture.md"):
        authority = """\
> [!info] Accepted temporary Obsidian architecture package
> Архитектура утверждена пользователем 2026-08-25 и временно хранится в
> Obsidian. EEM-9/01 переносит её в
> `Evirion/evirion-engineering-memory-dashboard` для version-controlled
> ADR/spec review. До переноса portable program design
> `docs/superpowers/specs/2026-08-25-design-partner-console-program-design.md`
> и source-controlled EEM-4/EEM-6–9 active plans владеют architecture summary,
> task scope, dependencies и DoD.
> После EEM-9/01 digest-pinned Dashboard copy этой архитектуры становится
> detailed authority; OWASP note и operations runbook остаются обязательными
> для EEM-9/07–10 до отдельного migration/pointer.
>
> Она не открывает paid, deployment, migration или production gate."""
        transferred_authority = """\
> [!info] Accepted Dashboard architecture transfer
> Архитектура утверждена пользователем 2026-08-25 и перенесена в
> `Evirion/evirion-engineering-memory-dashboard` под EEM-9/01 для
> version-controlled ADR/spec review. Она становится detailed authority только
> на exact Dashboard commit и authority-package digest после последовательного
> merge Dashboard PR и backend stable-pointer PR. Portable program design и
> backend EEM-4/EEM-6–8 plans сохраняют свои contributor boundaries.
> OWASP note и operations runbook остаются обязательными для EEM-9/07–10 до
> отдельного migration/pointer.
>
> Этот transfer не открывает paid, deployment, migration или production gate."""
        old = """\
> [!warning] EEM-9/01 prerequisite
> Backend EEM-3/12 merged in PR #23 at
> `8c2c2194a06ccea2bf69754eaf041b0d8758d832`. EEM-3/13 global lock-order
> remediation is implemented and locally verified on its separate branch, but
> its PR is not yet merged and migration 30 is not remotely applied. EEM-9/01
> remains paused until that PR merges, backend `main` is updated, and the
> merged migration plus catalog/trigger/FK attestation are verified. No
> Dashboard product files are authorized from the prerequisite branch."""
        new = """\
> [!success] EEM-9/01 prerequisite verified
> Backend EEM-3/13 merged in PR #24 at
> `b23f6ba2b11f583b61200cec63500a782992f1f0`. The merged tree equals the
> reviewed branch tree and the 10-test PostgreSQL 17 catalog/trigger/FK
> attestation passes. Migration 30 remains unapplied remotely and no runtime,
> deployment, provider, paid, or customer-data action is authorized."""
        if text.count(authority) != 1 or text.count(old) != 1:
            raise MigrationError("architecture prerequisite block drifted")
        boundary = """\
If the selected adapter chunks cookies, every chunk retains the `__Host-`
attributes; rotation/logout clears stale chunks. P01 freezes browser/proxy
cookie and response-header budgets, and oversize state fails closed.
P01 also freezes canonical local/staging/production origins, TLS termination and
trusted-proxy normalization. Local browser/E2E and DAST use a pinned HTTPS
origin and preserve production `__Host-`/`Secure` attributes; development never
falls back to weaker session cookies."""
        frozen_boundary = """\
If the selected adapter chunks cookies, every chunk retains the `__Host-`
attributes; rotation/logout clears stale chunks. P01 freezes each chunk value at
3072 bytes maximum, at most four chunks per logical cookie, the aggregate
request `Cookie` header at 8192 bytes, and aggregate response `Set-Cookie`
headers at 16384 bytes. Oversize or excess-chunk state fails closed before
session or domain mutation.

P01 freezes canonical origin as one exact HTTPS origin supplied by the signed
deployment manifest. The local HTTPS origin is
`https://console.evirion.test:3443`; staging and production stay
unprovisioned and fail startup until their separately reviewed release
manifests provide exact origins. TLS 1.2 or newer terminates at one trusted edge
hop. The edge strips inbound `Forwarded`/`X-Forwarded-*`, then writes canonical
values; the application trusts those values only from the configured proxy
network and otherwise uses the direct request. Auth/session responses remain
force-dynamic, `private, no-store`, with hosting cache TTL zero. Local
browser/E2E and DAST preserve production `__Host-`/`Secure` attributes;
development never falls back to weaker session cookies."""
        if text.count(boundary) != 1:
            raise MigrationError("architecture cookie/origin boundary drifted")
        return (
            text.replace(authority, transferred_authority)
            .replace(old, new)
            .replace(boundary, frozen_boundary)
        )

    if source_fallback.endswith("Design Partner Console implementation plan.md"):
        old_preflight = """\
- [ ] Reconcile current evidence: GitHub PR #12, which delivered EEM-3 subtask
  PR 05, is merged at `a4ae37b62a949367e2813859afae00fba84ef00f`.
  EEM-3 subtasks PR 06–12 and free staging recertification remain incomplete;
  current repository HANDOFF/ROADMAP wording is synchronized to that state and
  must still be verified against Git."""
        new_preflight = """\
- [x] Reconcile current evidence: EEM-3/12 is merged, deployed, and free
  source-only staging-certified through PR #23. EEM-3/13 is merged through
  PR #24 at `b23f6ba2b11f583b61200cec63500a782992f1f0`; its reviewed tree and
  merged tree are identical and its PostgreSQL 17 lock attestation passes.
  Migration 30 remains unapplied remotely."""
        old_p01 = """\
EEM-3/12 is merged as backend PR #23 at
`8c2c2194a06ccea2bf69754eaf041b0d8758d832`; EEM-3/13 is implemented and
locally verified but not yet merged. Its local gate replayed 30 migrations,
passed 295 pgTAP assertions and 341 database tests, and produced runtime
fingerprint
`5974d4b04834a585a786e1245b324411cdc4798b066b136203b6ac46eaf6b294`.
Do not treat that branch as `main` or start Dashboard work from it."""
        new_p01 = """\
EEM-3/12 is merged as backend PR #23 at
`8c2c2194a06ccea2bf69754eaf041b0d8758d832`. EEM-3/13 is merged as backend
PR #24 at `b23f6ba2b11f583b61200cec63500a782992f1f0`; its reviewed and merged
trees are identical. Its local gate replayed 30 migrations, passed 295 pgTAP
assertions and 341 database tests, produced runtime fingerprint
`5974d4b04834a585a786e1245b324411cdc4798b066b136203b6ac46eaf6b294`, and
the merged 10-test PostgreSQL 17 lock attestation passes."""
        versions = """\
Library, Playwright and automated accessibility/security checks. Exact package
versions are selected from stable supported releases and pinned at
implementation preflight."""
        pinned_versions = """\
Library, Playwright and automated accessibility/security checks. P01 pins the
bootstrap baseline in `docs/architecture/toolchain-baseline.json`: Node
`24.20.0` LTS, pnpm `11.24.0`, Next.js `16.3.3`, TypeScript `7.0.2`, React
`19.2.8`, `@supabase/ssr` `0.12.5`, `@supabase/supabase-js` `2.112.4`, Vitest
`4.1.11`, Playwright `1.62.1`, PostgreSQL `17`, and Cosign `3.1.3`. Runtime
lockfiles remain owned by the later scaffold task."""
        if (
            text.count(old_preflight) != 1
            or text.count(old_p01) != 1
            or text.count(versions) != 1
        ):
            raise MigrationError("implementation-plan EEM-3 evidence drifted")
        return (
            text.replace(old_preflight, new_preflight)
            .replace(old_p01, new_p01)
            .replace(versions, pinned_versions)
        )

    return text


def transform_obsidian_note(
    text: str,
    *,
    destination: Path,
    source_fallback: str,
    source_sha256: str,
) -> str:
    if MACHINE_LOCAL.search(text):
        raise MigrationError("source contains a machine-local absolute path")
    if re.fullmatch(r"[0-9a-f]{64}", source_sha256) is None:
        raise MigrationError("source digest must be SHA-256")

    corrected = _correct_current_evidence(text, source_fallback)
    linked = WIKI_LINK.sub(
        lambda match: _wiki_replacement(destination, match),
        corrected,
    )
    header = "\n".join(
        (
            "> [!NOTE] Accepted source snapshot",
            "> Migrated for EEM-9/01 from the accepted 2026-08-25 package.",
            f"> Vault-relative source: `{source_fallback}`.",
            f"> Original source SHA-256: `{source_sha256}`.",
            "> The repository copy is authoritative after the paired EEM-9/01 merges.",
            "> Retained security and operations sources:",
            "> `10 Evirion/Architecture/EEM - OWASP-аудит и модель угроз.md` and",
            "> `10 Evirion/Architecture/EEM - Полный runbook запуска и эксплуатации.md`.",
        )
    )
    return _insert_source_header(linked, header)


def _transform_backend_source(text: str, spec: SourceSpec) -> str:
    if MACHINE_LOCAL.search(text):
        raise MigrationError("backend source contains a machine-local absolute path")

    if spec.source.endswith("eem-9-design-partner-console-dashboard-and-certification.md"):
        old = """\
Status: planned; architecture package accepted 2026-08-25; this plan is
temporarily source-controlled in `evirion-engineering-memory`. EEM-9/01 is
paused until the separately implemented and locally verified EEM-3/13
global-lock PR is merged, backend `main` is updated, and its migration plus
attestation are reverified."""
        new = """\
Status: active; architecture package accepted 2026-08-25; Dashboard authority
transfer is in progress under EEM-9/01. Backend EEM-3/13 merged in PR #24 at
`b23f6ba2b11f583b61200cec63500a782992f1f0`; the reviewed tree matches the
merged tree and its PostgreSQL 17 lock attestation passes."""
        if text.count(old) != 1:
            raise MigrationError("backend EEM-9 status block drifted")
        text = text.replace(old, new)
        text = text.replace(
            "../../superpowers/specs/2026-08-25-design-partner-console-program-design.md",
            "../../architecture/design-partner-console-program-design.md",
        )
        for name in (
            "eem-4-customer-access-and-tenant-isolation.md",
            "eem-6-repository-entitlements-and-github-control.md",
            "eem-7-paid-call-authorization-and-customer-operations.md",
            "eem-8-customer-safe-api-review-and-lifecycle.md",
        ):
            text = text.replace(
                f"({name})",
                "("
                "https://github.com/Evirion/evirion-engineering-memory/"
                f"blob/{BACKEND_COMMIT}/docs/plans/active/{name}"
                ")",
            )
    else:
        text = text.replace(
            "../../plans/active/eem-9-design-partner-console-dashboard-and-certification.md",
            "../plans/active/eem-9-design-partner-console-dashboard-and-certification.md",
        )
        for name in (
            "eem-4-customer-access-and-tenant-isolation.md",
            "eem-6-repository-entitlements-and-github-control.md",
            "eem-7-paid-call-authorization-and-customer-operations.md",
            "eem-8-customer-safe-api-review-and-lifecycle.md",
        ):
            text = text.replace(
                f"(../../plans/active/{name})",
                "("
                "https://github.com/Evirion/evirion-engineering-memory/"
                f"blob/{BACKEND_COMMIT}/docs/plans/active/{name}"
                ")",
            )

    header = "\n".join(
        (
            "> Dashboard authority transfer source",
            f"> Backend source commit: `{BACKEND_COMMIT}`.",
            f"> Original source path: `{spec.source}`.",
            f"> Original source SHA-256: `{spec.sha256}`.",
        )
    )
    return _insert_source_header(text, header)


def migrate_sources(vault_root: Path, backend_root: Path, dashboard_root: Path) -> None:
    prepared: list[tuple[Path, str]] = []
    for spec in SOURCES:
        source_root = vault_root if spec.source_kind == "obsidian" else backend_root
        source_path = source_root / spec.source
        source_bytes = source_path.read_bytes()
        actual_digest = _sha256(source_bytes)
        if actual_digest != spec.sha256:
            raise MigrationError(
                f"source digest drift for {spec.source}: {actual_digest}"
            )
        text = source_bytes.decode()
        destination = Path(spec.destination)
        if spec.source_kind == "obsidian":
            migrated = transform_obsidian_note(
                text,
                destination=destination,
                source_fallback=spec.source,
                source_sha256=spec.sha256,
            )
        else:
            migrated = _transform_backend_source(text, spec)
        target = dashboard_root / destination
        prepared.append((target, migrated))

    for target, migrated in prepared:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(migrated, encoding="utf-8")
        print(f"migrated {target.relative_to(dashboard_root)}")


def _main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--vault-root", type=Path, required=True)
    parser.add_argument("--backend-root", type=Path, required=True)
    parser.add_argument(
        "--dashboard-root",
        type=Path,
        default=Path(__file__).resolve().parents[1],
    )
    arguments = parser.parse_args()
    migrate_sources(
        arguments.vault_root.resolve(),
        arguments.backend_root.resolve(),
        arguments.dashboard_root.resolve(),
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(_main())
