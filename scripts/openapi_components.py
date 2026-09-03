"""Read the ``components.schemas`` subtree of the pinned OpenAPI document.

The Console client is generated from ``schemas/*.json``. Four historical-import
operations answer with ``RepositoryImportReceipt``, which the contract declares
inline in ``openapi.yaml`` and in no schema file, so the generator never saw it
and emitted neither a type nor a validator for it. Those bytes are a manifest
member and are digest-verified before this module is given them, so the type can
still be generated from the signed contract rather than hand-written. It only
has to be read.

The repository's Python gate is standard-library only and deliberately so, which
is why this module accepts the exact subset the frozen contract uses instead of
taking a YAML dependency: block mappings, block sequences of scalars, plain and
double-quoted scalars, ``>-`` folded scalars, the empty flow mapping and full
line comments. Every other construct raises. A later contract that introduces
one therefore fails the generator loudly instead of being parsed into something
subtly wrong.
"""

from __future__ import annotations

import json
import re
from typing import Any


class OpenApiSubsetError(ValueError):
    """Raised when the document uses YAML this reader is not reviewed for."""


# Keys in the frozen contract are unquoted and include `$ref` and the
# `x-evirion-` extension family, so the leading character may be a dollar and
# the body may carry hyphens and dots.
_KEY = re.compile(r"^(?P<key>[A-Za-z_$][A-Za-z0-9_$.-]*):(?P<rest>.*)$")
_INTEGER = re.compile(r"^-?(?:0|[1-9][0-9]*)$")
# Deliberately narrow. Every plain scalar in the pinned contract is a single
# token, so admitting spaces or colons here would let an ambiguous line through
# as text rather than raising on syntax this reader has not been reviewed for.
_PLAIN = re.compile(r"^[A-Za-z0-9_][A-Za-z0-9_./-]*$")
_FOLDED = ">-"
_EMPTY_MAPPING = "{}"


def _indentation(line: str) -> int:
    return len(line) - len(line.lstrip(" "))


def _is_significant(line: str) -> bool:
    stripped = line.strip()
    return bool(stripped) and not stripped.startswith("#")


class _Cursor:
    """A line cursor that reports positions as the document numbers them."""

    def __init__(self, lines: list[str]) -> None:
        self._lines = lines
        self.index = 0

    def peek(self) -> tuple[int, str, int] | None:
        """The next significant line as indentation, text and line number."""
        index = self.index
        while index < len(self._lines) and not _is_significant(self._lines[index]):
            index += 1
        if index >= len(self._lines):
            return None
        line = self._lines[index]
        return _indentation(line), line.strip(), index + 1

    def advance(self) -> None:
        while self.index < len(self._lines) and not _is_significant(
            self._lines[self.index]
        ):
            self.index += 1
        self.index += 1

    def skip_block(self, parent_indentation: int) -> None:
        """Advance past everything nested under the line just consumed.

        Skipping is purely by indentation, so a section this reader does not
        parse cannot influence it. Block scalar content is always more indented
        than its key, so it is skipped with the rest of the block.
        """
        while self.index < len(self._lines):
            line = self._lines[self.index]
            if line.strip() and _indentation(line) <= parent_indentation:
                break
            self.index += 1

    def take_folded(self, parent_indentation: int) -> str:
        """Consume a ``>-`` block and fold it the way YAML defines.

        Lines inside one paragraph join with a space and a blank line becomes a
        newline. ``>-`` also strips the trailing break, which falls out of
        joining rather than appending.
        """
        collected: list[str] = []
        while self.index < len(self._lines):
            line = self._lines[self.index]
            if line.strip() and _indentation(line) <= parent_indentation:
                break
            collected.append(line.strip())
            self.index += 1

        paragraphs: list[str] = []
        current: list[str] = []
        for entry in collected:
            if entry:
                current.append(entry)
            elif current:
                paragraphs.append(" ".join(current))
                current = []
        if current:
            paragraphs.append(" ".join(current))
        return "\n".join(paragraphs)


def _scalar(text: str, line_number: int) -> Any:
    if text.startswith('"'):
        try:
            value = json.loads(text)
        except json.JSONDecodeError as exc:
            raise OpenApiSubsetError(
                f"line {line_number}: unreadable quoted scalar {text!r}"
            ) from exc
        if not isinstance(value, str):
            raise OpenApiSubsetError(f"line {line_number}: quoted scalar is not a string")
        return value
    if text in {"true", "false"}:
        return text == "true"
    if _INTEGER.fullmatch(text):
        return int(text)
    if _PLAIN.fullmatch(text):
        return text
    raise OpenApiSubsetError(f"line {line_number}: unsupported scalar {text!r}")


def _parse_sequence(cursor: _Cursor, indentation: int) -> list[Any]:
    items: list[Any] = []
    while True:
        position = cursor.peek()
        if position is None:
            break
        line_indentation, text, line_number = position
        if line_indentation < indentation or not text.startswith("- "):
            break
        if line_indentation > indentation:
            raise OpenApiSubsetError(
                f"line {line_number}: unexpected indentation inside a sequence"
            )
        cursor.advance()
        entry = text[2:]
        match = _KEY.match(entry)
        if match is None:
            items.append(_scalar(entry.strip(), line_number))
            continue
        # A mapping entry opens on the dash line, so its remaining keys sit at
        # the column the first key starts in, two past the dash.
        entry_indentation = indentation + 2
        first = _parse_value(cursor, entry_indentation, match["rest"], line_number)
        mapping = {match["key"]: first}
        for key, value in _parse_mapping(
            cursor, entry_indentation, allow_empty=True
        ).items():
            if key in mapping:
                raise OpenApiSubsetError(f"line {line_number}: duplicate key {key!r}")
            mapping[key] = value
        items.append(mapping)
    if not items:
        raise OpenApiSubsetError(f"empty sequence at indentation {indentation}")
    return items


def _parse_value(cursor: _Cursor, parent_indentation: int, rest: str, line: int) -> Any:
    if rest and not rest.startswith(" "):
        raise OpenApiSubsetError(f"line {line}: a key must be followed by a space")

    text = rest.strip()
    if text == _EMPTY_MAPPING:
        return {}
    if text == _FOLDED:
        return cursor.take_folded(parent_indentation)
    if text:
        return _scalar(text, line)

    position = cursor.peek()
    if position is None:
        raise OpenApiSubsetError(f"line {line}: key has no value")
    child_indentation, child_text, child_line = position
    if child_indentation <= parent_indentation:
        raise OpenApiSubsetError(f"line {line}: key has no value")
    if child_text.startswith("- "):
        return _parse_sequence(cursor, child_indentation)
    if child_text.startswith("-"):
        raise OpenApiSubsetError(f"line {child_line}: unsupported sequence entry")
    return _parse_mapping(cursor, child_indentation)


def _parse_mapping(
    cursor: _Cursor,
    indentation: int,
    *,
    allow_empty: bool = False,
) -> dict[str, Any]:
    mapping: dict[str, Any] = {}
    while True:
        position = cursor.peek()
        if position is None:
            break
        line_indentation, text, line_number = position
        if line_indentation < indentation:
            break
        if line_indentation > indentation:
            raise OpenApiSubsetError(
                f"line {line_number}: unexpected indentation inside a mapping"
            )
        match = _KEY.match(text)
        if match is None:
            raise OpenApiSubsetError(f"line {line_number}: unsupported line {text!r}")
        key = match["key"]
        if key in mapping:
            raise OpenApiSubsetError(f"line {line_number}: duplicate key {key!r}")
        cursor.advance()
        mapping[key] = _parse_value(cursor, indentation, match["rest"], line_number)
    if not mapping and not allow_empty:
        raise OpenApiSubsetError(f"empty mapping at indentation {indentation}")
    return mapping


def _descend(cursor: _Cursor, key: str, indentation: int) -> bool:
    """Find ``key`` among the mapping at ``indentation`` and stop on its body.

    Every sibling is skipped by indentation rather than parsed. The strict
    subset therefore has to hold only where this module actually reads, which is
    the schema subtree, and not across the paths and prose it never consults.
    """
    while True:
        position = cursor.peek()
        if position is None:
            return False
        line_indentation, text, line_number = position
        if line_indentation < indentation:
            return False
        if line_indentation > indentation:
            raise OpenApiSubsetError(
                f"line {line_number}: unexpected indentation above {key!r}"
            )
        match = _KEY.match(text)
        if match is None:
            raise OpenApiSubsetError(f"line {line_number}: unsupported line {text!r}")
        cursor.advance()
        if match["key"] == key:
            if match["rest"].strip():
                raise OpenApiSubsetError(f"line {line_number}: {key!r} has no block")
            return True
        cursor.skip_block(indentation)


def load_component_schemas(document: str) -> dict[str, Any]:
    """Return ``components.schemas`` from an OpenAPI document.

    The subtree is located structurally rather than by search, so a matching key
    nested under some other section cannot be mistaken for it.
    """
    if "\t" in document:
        raise OpenApiSubsetError("the document contains a tab")

    cursor = _Cursor(document.split("\n"))
    if not _descend(cursor, "components", 0):
        raise OpenApiSubsetError("the document declares no components")
    if not _descend(cursor, "schemas", 2):
        raise OpenApiSubsetError("the document declares no component schemas")

    position = cursor.peek()
    if position is None or position[0] <= 2:
        raise OpenApiSubsetError("the document declares no component schemas")
    return _parse_mapping(cursor, position[0])
