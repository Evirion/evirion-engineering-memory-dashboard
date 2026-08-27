from __future__ import annotations

import re
from argparse import ArgumentParser
from pathlib import Path
from urllib.parse import unquote, urlsplit


MARKDOWN_LINK = re.compile(r"\[[^\]]*\]\(([^)\s]+)(?:\s+[^)]*)?\)")
WIKI_LINK = re.compile(r"\[\[[^\]]+\]\]")
MACHINE_LOCAL = re.compile(
    r"(?:file://)?/(?:Users|home)/[^/\s)]+/|"
    r"(?:file:///)?[A-Za-z]:[/\\]Users[/\\][^/\\\s)]+[/\\]"
)
EXTERNAL_SCHEMES = {"http", "https", "mailto", "obsidian"}


def _markdown_files(search_roots: list[Path]) -> list[Path]:
    files: set[Path] = set()
    for search_root in search_roots:
        if search_root.is_file() and search_root.suffix == ".md":
            files.add(search_root)
        elif search_root.is_dir():
            files.update(search_root.rglob("*.md"))
    return sorted(files)


def validate_document_tree(root: Path, search_roots: list[Path]) -> list[str]:
    errors: list[str] = []
    for document in _markdown_files(search_roots):
        text = document.read_text(encoding="utf-8")
        display_path = document.relative_to(root).as_posix()

        if MACHINE_LOCAL.search(text):
            errors.append(f"{display_path}: machine-local absolute path")
        if WIKI_LINK.search(text):
            errors.append(f"{display_path}: unresolved Obsidian wiki link")

        for raw_target in MARKDOWN_LINK.findall(text):
            target = raw_target.strip("<>")
            parsed = urlsplit(target)
            if parsed.scheme in EXTERNAL_SCHEMES:
                continue
            if parsed.scheme:
                errors.append(f"{display_path}: unsupported link scheme: {target}")
                continue
            if target.startswith("#"):
                continue

            decoded_path = unquote(parsed.path)
            if not decoded_path:
                continue
            candidate = (document.parent / decoded_path).resolve()
            try:
                candidate.relative_to(root.resolve())
            except ValueError:
                errors.append(f"{display_path}: link escapes repository: {target}")
                continue
            if not candidate.exists():
                errors.append(f"{display_path}: broken link: {target}")

    return sorted(errors)


def _main() -> int:
    parser = ArgumentParser(description=__doc__)
    parser.add_argument(
        "--root",
        type=Path,
        default=Path(__file__).resolve().parents[1],
    )
    arguments = parser.parse_args()
    root = arguments.root.resolve()
    search_roots = [
        root / "docs",
        root / "AGENTS.md",
        root / "README.md",
        root / "SECURITY.md",
    ]
    errors = validate_document_tree(root, search_roots)
    if errors:
        for error in errors:
            print(error)
        return 1
    print("documentation links and paths verified")
    return 0


if __name__ == "__main__":
    raise SystemExit(_main())
