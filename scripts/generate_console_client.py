from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path
from typing import Any


class ConsoleClientError(ValueError):
    """Raised when the pinned contract cannot be turned into a client safely."""


# Every keyword the pinned contract uses. An unlisted keyword is a contract
# change this generator has never been reviewed against, so it fails closed
# instead of emitting a client that silently ignores it.
SUPPORTED_KEYWORDS = {
    "$id",
    "$ref",
    "$schema",
    "additionalProperties",
    "const",
    "description",
    "enum",
    "examples",
    "format",
    "items",
    "maxItems",
    "maxLength",
    "maximum",
    "minItems",
    "minLength",
    "minimum",
    "oneOf",
    "pattern",
    "properties",
    "required",
    "title",
    "type",
    "uniqueItems",
}
SUPPORTED_FORMATS = {
    "date-time": (
        r"^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}"
        r"(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$"
    ),
    "email": r"^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$",
    "uuid": (
        r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}"
        r"-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
    ),
}
SCALAR_TYPES = {
    "boolean": "boolean",
    "integer": "number",
    "null": "null",
    "number": "number",
    "string": "string",
}
IDENTIFIER = re.compile(r"^[A-Za-z_$][A-Za-z0-9_$]*$")
GENERATED_FILES = ("index.ts", "types.ts", "unsupported-states.ts", "validators.ts")
# A contract type that shadows a TypeScript or DOM global would silently
# replace it wherever the client is imported, so every collision needs a
# reviewed rename here rather than an implicit one at the import site.
RESERVED_GLOBAL_TYPES = {
    "Array",
    "Blob",
    "Boolean",
    "Comment",
    "Console",
    "Crypto",
    "Date",
    "Document",
    "Error",
    "Event",
    "File",
    "FormData",
    "Function",
    "Headers",
    "History",
    "Image",
    "Location",
    "Map",
    "Navigator",
    "Node",
    "Notification",
    "Number",
    "Object",
    "Option",
    "Performance",
    "Promise",
    "Range",
    "Request",
    "Response",
    "Screen",
    "Selection",
    "Set",
    "Storage",
    "String",
    "Symbol",
    "Text",
    "URL",
    "Window",
    "Worker",
}
RENAMED_TYPES = {"Error": "ConsoleError"}


def _canonical_json(value: Any) -> bytes:
    return (
        json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
        + "\n"
    ).encode()


def _type_name(schema_file: str) -> str:
    stem = schema_file.removesuffix(".json")
    name = "".join(part.capitalize() for part in stem.split("-"))
    if name in RENAMED_TYPES:
        return RENAMED_TYPES[name]
    if name in RESERVED_GLOBAL_TYPES:
        raise ConsoleClientError(
            f"contract schema {schema_file} would shadow the global type {name}"
        )
    return name


def _quote(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)


def _property_key(name: str) -> str:
    return name if IDENTIFIER.fullmatch(name) else _quote(name)


def verify_contract_bytes(archive_root: Path, expected_package_sha256: str) -> dict[str, Any]:
    manifest_path = archive_root / "contracts/console/v1/manifest.json"
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ConsoleClientError(f"cannot read contract manifest: {exc}") from exc

    entries = manifest.get("files")
    if not isinstance(entries, list) or not entries:
        raise ConsoleClientError("contract manifest lists no files")
    files: list[dict[str, str]] = []
    for entry in entries:
        path_value = entry.get("path") if isinstance(entry, dict) else None
        expected_digest = entry.get("sha256") if isinstance(entry, dict) else None
        if not isinstance(path_value, str) or not isinstance(expected_digest, str):
            raise ConsoleClientError("contract manifest entry is malformed")
        relative = Path(path_value)
        if relative.is_absolute() or ".." in relative.parts:
            raise ConsoleClientError(f"unsafe contract member: {path_value}")
        member = archive_root / relative
        if not member.is_file():
            raise ConsoleClientError(f"contract member is missing: {path_value}")
        digest = hashlib.sha256(member.read_bytes()).hexdigest()
        if digest != expected_digest:
            raise ConsoleClientError(f"contract member digest drift: {path_value}")
        files.append({"path": path_value, "sha256": digest})

    package_sha256 = hashlib.sha256(_canonical_json(files)).hexdigest()
    if package_sha256 != manifest.get("packageSha256"):
        raise ConsoleClientError("contract manifest packageSha256 does not match its files")
    if package_sha256 != expected_package_sha256:
        raise ConsoleClientError("contract packageSha256 does not match the contract lock")
    return manifest


def _assert_supported(node: dict[str, Any], pointer: str) -> None:
    for keyword in node:
        if keyword.startswith("x-evirion-"):
            continue
        if keyword not in SUPPORTED_KEYWORDS:
            raise ConsoleClientError(
                f"unsupported contract keyword {keyword!r} at {pointer}"
            )


def _is_unconstrained(node: dict[str, Any]) -> bool:
    """A schema the contract leaves entirely to the owning projection."""
    return not {"$ref", "const", "enum", "oneOf", "type"}.intersection(node)


def _is_opaque_object(node: dict[str, Any]) -> bool:
    """An object the contract deliberately leaves unconstrained.

    Only a declaration that constrains nothing qualifies. An object that names
    properties must also close itself, otherwise unknown members would reach the
    browser as trusted data.
    """
    return "properties" not in node and "additionalProperties" not in node


def _nullable_branch(node: dict[str, Any], pointer: str) -> dict[str, Any]:
    branches = node["oneOf"]
    if (
        not isinstance(branches, list)
        or len(branches) != 2
        or not all(isinstance(branch, dict) for branch in branches)
    ):
        raise ConsoleClientError(f"unsupported oneOf arity at {pointer}")
    null_branches = [branch for branch in branches if branch.get("type") == "null"]
    value_branches = [branch for branch in branches if branch.get("type") != "null"]
    if len(null_branches) != 1 or len(value_branches) != 1:
        raise ConsoleClientError(f"unsupported oneOf shape at {pointer}")
    if set(null_branches[0]) != {"type"}:
        raise ConsoleClientError(f"unsupported null branch at {pointer}")
    return value_branches[0]


def _join(checks: list[str]) -> str:
    return checks[0] if len(checks) == 1 else "(" + " && ".join(checks) + ")"


class ClientGenerator:
    def __init__(self, schemas: dict[str, dict[str, Any]]) -> None:
        self._schemas = schemas
        self._patterns: dict[str, str] = {}
        self.unsupported_values: dict[str, str] = {}

    @property
    def patterns(self) -> dict[str, str]:
        return dict(self._patterns)

    def _resolve_ref(self, reference: Any, pointer: str) -> str:
        if not isinstance(reference, str) or reference not in self._schemas:
            raise ConsoleClientError(f"unresolvable $ref {reference!r} at {pointer}")
        return _type_name(reference)

    def type_expression(self, node: dict[str, Any], pointer: str, indent: str) -> str:
        _assert_supported(node, pointer)
        unsupported = node.get("x-evirion-unsupported-value")
        if isinstance(unsupported, str):
            self.unsupported_values[pointer] = unsupported

        if _is_unconstrained(node):
            return "unknown"
        if "$ref" in node:
            return self._resolve_ref(node["$ref"], pointer)
        if "oneOf" in node:
            branch = _nullable_branch(node, pointer)
            return f"{self.type_expression(branch, pointer, indent)} | null"
        if "const" in node:
            return _quote(node["const"])
        if "enum" in node:
            values = node["enum"]
            if not isinstance(values, list) or not values:
                raise ConsoleClientError(f"empty enum at {pointer}")
            return " | ".join(_quote(value) for value in values)

        declared = node.get("type")
        if isinstance(declared, list):
            return " | ".join(
                self.type_expression({**node, "type": member}, pointer, indent)
                for member in declared
            )
        if declared == "object":
            return self._object_expression(node, pointer, indent)
        if declared == "array":
            items = node.get("items")
            if not isinstance(items, dict):
                raise ConsoleClientError(f"array without item schema at {pointer}")
            element = self.type_expression(items, f"{pointer}/items", indent)
            wrapped = element if IDENTIFIER.fullmatch(element) else f"({element})"
            return f"{wrapped}[]"
        if declared in SCALAR_TYPES:
            return SCALAR_TYPES[declared]
        raise ConsoleClientError(f"unsupported type {declared!r} at {pointer}")

    def _object_expression(self, node: dict[str, Any], pointer: str, indent: str) -> str:
        if _is_opaque_object(node):
            return "Record<string, unknown>"
        if node.get("additionalProperties") is not False:
            raise ConsoleClientError(f"open object at {pointer}")
        properties = node.get("properties")
        if not isinstance(properties, dict) or not properties:
            raise ConsoleClientError(f"object without properties at {pointer}")
        required = set(node.get("required") or [])
        unknown_required = required - set(properties)
        if unknown_required:
            raise ConsoleClientError(
                f"required property is undeclared at {pointer}: "
                + ", ".join(sorted(unknown_required))
            )
        inner = indent + "  "
        lines = ["{"]
        for name in sorted(properties):
            child = properties[name]
            if not isinstance(child, dict):
                raise ConsoleClientError(f"malformed property {name!r} at {pointer}")
            expression = self.type_expression(child, f"{pointer}/{name}", inner)
            optional = "" if name in required else "?"
            lines.append(f"{inner}{_property_key(name)}{optional}: {expression};")
        lines.append(f"{indent}}}")
        return "\n".join(lines)

    def validator_expression(
        self,
        node: dict[str, Any],
        pointer: str,
        value: str,
        depth: int,
        indent: str,
    ) -> str:
        if _is_unconstrained(node):
            return "true"
        if "$ref" in node:
            return f"is{self._resolve_ref(node['$ref'], pointer)}({value})"
        if "oneOf" in node:
            branch = _nullable_branch(node, pointer)
            inner = self.validator_expression(branch, pointer, value, depth, indent)
            return f"({value} === null || {inner})"
        if "const" in node:
            return f"{value} === {_quote(node['const'])}"
        if "enum" in node:
            members = ", ".join(_quote(member) for member in node["enum"])
            return f"isOneOf({value}, [{members}])"

        declared = node.get("type")
        if isinstance(declared, list):
            branches = [
                self.validator_expression(
                    {**node, "type": member}, pointer, value, depth, indent
                )
                for member in declared
            ]
            return "(" + " || ".join(branches) + ")"
        if declared == "null":
            return f"{value} === null"
        if declared == "boolean":
            return f"typeof {value} === \"boolean\""
        if declared in {"integer", "number"}:
            checks = [f"typeof {value} === \"number\""]
            checks.append(
                f"Number.{'isInteger' if declared == 'integer' else 'isFinite'}({value})"
            )
            if "minimum" in node:
                checks.append(f"({value} as number) >= {node['minimum']}")
            if "maximum" in node:
                checks.append(f"({value} as number) <= {node['maximum']}")
            return _join(checks)
        if declared == "string":
            checks = [f"typeof {value} === \"string\""]
            text = f"({value} as string)"
            if "minLength" in node:
                checks.append(f"{text}.length >= {node['minLength']}")
            if "maxLength" in node:
                checks.append(f"{text}.length <= {node['maxLength']}")
            if "pattern" in node:
                checks.append(f"{self._pattern_constant(node['pattern'])}.test({text})")
            if "format" in node:
                fmt = node["format"]
                if fmt not in SUPPORTED_FORMATS:
                    raise ConsoleClientError(f"unsupported format {fmt!r} at {pointer}")
                checks.append(f"{_format_constant(fmt)}.test({text})")
            return _join(checks)
        if declared == "array":
            entry = f"entry{depth}"
            element = self.validator_expression(
                node["items"], f"{pointer}/items", entry, depth + 1, indent
            )
            items = f"({value} as unknown[])"
            checks = [f"Array.isArray({value})"]
            if "minItems" in node:
                checks.append(f"{items}.length >= {node['minItems']}")
            if "maxItems" in node:
                checks.append(f"{items}.length <= {node['maxItems']}")
            if element != "true":
                checks.append(f"{items}.every(({entry}: unknown) => {element})")
            if node.get("uniqueItems") is True:
                checks.append(f"hasUniqueEntries({items})")
            return _join(checks)
        if declared == "object":
            return self._object_validator(node, pointer, value, depth, indent)
        raise ConsoleClientError(f"unsupported type {declared!r} at {pointer}")

    def _pattern_constant(self, pattern: str) -> str:
        name = self._patterns.get(pattern)
        if name is None:
            name = f"PATTERN_{len(self._patterns) + 1}"
            self._patterns[pattern] = name
        return name

    def _object_validator(
        self,
        node: dict[str, Any],
        pointer: str,
        value: str,
        depth: int,
        indent: str,
    ) -> str:
        if _is_opaque_object(node):
            return f"isRecord({value})"
        properties: dict[str, Any] = node["properties"]
        required = set(node.get("required") or [])
        record = f"object{depth}"
        inner = indent + "  "
        allowed = ", ".join(_quote(name) for name in sorted(properties))
        checks = [f"hasOnlyKeys({record}, [{allowed}])"]
        for name in sorted(properties):
            member = f"{record}[{_quote(name)}]"
            child = self.validator_expression(
                properties[name], f"{pointer}/{name}", member, depth + 1, inner
            )
            if name in required:
                checks.append(f"{_quote(name)} in {record} && {child}")
            else:
                checks.append(f"({member} === undefined || {child})")
        body = f"\n{inner}&& ".join(checks)
        return (
            f"isObject({value}, ({record}: Record<string, unknown>) =>\n"
            f"{inner}{body}\n{indent})"
        )


def _format_constant(fmt: str) -> str:
    return fmt.replace("-", "_").upper() + "_PATTERN"


def _header(provenance: dict[str, str]) -> str:
    return "\n".join(
        [
            "// Generated by scripts/generate_console_client.py. Do not edit.",
            "//",
            f"// Source release: {provenance['repository']} {provenance['releaseTag']}",
            f"// Release asset: {provenance['assetName']} (id {provenance['assetId']})",
            f"// Archive SHA-256: {provenance['archiveSha256']}",
            f"// Contract packageSha256: {provenance['packageSha256']}",
            f"// Source commit: {provenance['sourceCommit']}",
            "",
        ]
    )


def render_client(
    schemas: dict[str, dict[str, Any]],
    provenance: dict[str, str],
) -> dict[str, str]:
    generator = ClientGenerator(schemas)
    header = _header(provenance)
    ordered = sorted(schemas)

    type_lines = [header]
    for schema_file in ordered:
        schema = schemas[schema_file]
        name = _type_name(schema_file)
        title = schema.get("title")
        description = schema.get("description")
        if title or description:
            type_lines.append("/**")
            if title:
                type_lines.append(f" * {title}")
            if description:
                type_lines.append(f" * {description}")
            type_lines.append(" */")
        expression = generator.type_expression(schema, name, "")
        type_lines.append(f"export type {name} = {expression};")
        type_lines.append("")
    types_source = "\n".join(type_lines)

    guards: list[str] = []
    for schema_file in ordered:
        name = _type_name(schema_file)
        check = generator.validator_expression(
            schemas[schema_file], name, "value", 0, "  "
        )
        guards.append(
            f"export function is{name}(value: unknown): value is {name} {{\n"
            f"  return {check};\n"
            "}\n"
        )

    imported = ", ".join(_type_name(schema_file) for schema_file in ordered)
    validator_lines = [
        header,
        f"import type {{ {imported} }} from \"./types\";",
        "",
    ]
    for fmt in sorted(SUPPORTED_FORMATS):
        pattern = SUPPORTED_FORMATS[fmt].replace("\\\\", "\\")
        validator_lines.append(f"const {_format_constant(fmt)} = /{pattern}/;")
    for pattern, constant in generator.patterns.items():
        validator_lines.append(f"const {constant} = new RegExp({_quote(pattern)});")
    validator_lines.extend(
        [
            "",
            "function isRecord(value: unknown): value is Record<string, unknown> {",
            "  return typeof value === \"object\" && value !== null "
            "&& !Array.isArray(value);",
            "}",
            "",
            "function isObject(",
            "  value: unknown,",
            "  check: (object: Record<string, unknown>) => boolean,",
            "): boolean {",
            "  return isRecord(value) && check(value);",
            "}",
            "",
            "function hasOnlyKeys(",
            "  object: Record<string, unknown>,",
            "  allowed: readonly string[],",
            "): boolean {",
            "  return Object.keys(object).every((key: string) => allowed.includes(key));",
            "}",
            "",
            "function isOneOf(value: unknown, allowed: readonly string[]): boolean {",
            "  return typeof value === \"string\" && allowed.includes(value);",
            "}",
            "",
            "function hasUniqueEntries(entries: readonly unknown[]): boolean {",
            "  const seen = entries.map((entry: unknown) => JSON.stringify(entry));",
            "  return new Set(seen).size === entries.length;",
            "}",
            "",
        ]
    )
    validator_lines.extend(guards)
    validators_source = "\n".join(validator_lines)

    unsupported_lines = [header]
    unsupported_lines.append(
        "// Values the backend documents as an unsupported server response. A"
    )
    unsupported_lines.append(
        "// consumer that receives one must fail closed with an explicit"
    )
    unsupported_lines.append("// unsupported-state response instead of rendering it as trusted.")
    unsupported_lines.append("export const CONSOLE_UNSUPPORTED_VALUES = {")
    for pointer in sorted(generator.unsupported_values):
        unsupported_lines.append(
            f"  {_quote(pointer)}: {_quote(generator.unsupported_values[pointer])},"
        )
    unsupported_lines.append("} as const;")
    unsupported_lines.append("")
    unsupported_source = "\n".join(unsupported_lines)

    index_lines = [header]
    index_lines.append("export * from \"./types\";")
    index_lines.append("export * from \"./unsupported-states\";")
    index_lines.append("export * from \"./validators\";")
    index_lines.append("")
    index_lines.append("export const CONSOLE_CONTRACT_PROVENANCE = {")
    for key in sorted(provenance):
        value = provenance[key]
        rendered = str(value) if isinstance(value, int) else _quote(str(value))
        index_lines.append(f"  {key}: {rendered},")
    index_lines.append("} as const;")
    index_lines.append("")
    index_source = "\n".join(index_lines)

    return {
        "index.ts": index_source,
        "types.ts": types_source,
        "unsupported-states.ts": unsupported_source,
        "validators.ts": validators_source,
    }


def load_schemas(contract_root: Path) -> dict[str, dict[str, Any]]:
    schema_root = contract_root / "schemas"
    schemas: dict[str, dict[str, Any]] = {}
    for path in sorted(schema_root.glob("*.json")):
        try:
            document = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise ConsoleClientError(f"cannot read {path.name}: {exc}") from exc
        if not isinstance(document, dict):
            raise ConsoleClientError(f"{path.name} must contain an object")
        schemas[path.name] = document
    if not schemas:
        raise ConsoleClientError("the pinned contract exposes no schemas")
    return schemas


def generate(lock: dict[str, Any], root: Path) -> dict[str, str]:
    consumption = lock["consumption"]
    archive_root = root / consumption["vendoredRoot"]
    verify_contract_bytes(archive_root, lock["contract"]["packageSha256"])
    contract_root = archive_root / lock["contract"]["manifestPath"]
    schemas = load_schemas(contract_root.parent)
    provenance = {
        "archiveSha256": lock["artifact"]["assetSha256"],
        "assetId": lock["artifact"]["assetId"],
        "assetName": lock["artifact"]["assetName"],
        "contractVersion": lock["contract"]["contractVersion"],
        "packageSha256": lock["contract"]["packageSha256"],
        "releaseTag": lock["artifact"]["tag"],
        "repository": lock["repository"],
        "sourceCommit": lock["sourceCommit"],
    }
    return render_client(schemas, provenance)


def surface_digest(rendered: dict[str, str]) -> str:
    exported = sorted(
        match
        for source in rendered.values()
        for match in re.findall(
            r"^export (?:type|function|const) (\w+)", source, flags=re.MULTILINE
        )
    )
    return hashlib.sha256(_canonical_json(exported)).hexdigest()


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
    parser.add_argument("--check", action="store_true")
    arguments = parser.parse_args()

    root = arguments.root.resolve()
    lock = json.loads((root / arguments.lock).read_text(encoding="utf-8"))
    rendered = generate(lock, root)
    output_root = root / lock["consumption"]["generatedClientRoot"]

    if arguments.check:
        drifted = []
        for name in GENERATED_FILES:
            path = output_root / name
            if not path.is_file():
                drifted.append(f"{name} is missing")
            elif path.read_text(encoding="utf-8") != rendered[name]:
                drifted.append(f"{name} differs from the pinned contract")
        expected_surface = lock["consumption"]["generatedClientSurfaceSha256"]
        actual_surface = surface_digest(rendered)
        if actual_surface != expected_surface:
            drifted.append(
                "the generated export surface changed, which is a breaking "
                "backend change: expected "
                f"{expected_surface}, produced {actual_surface}"
            )
        if drifted:
            for message in drifted:
                print(message)
            return 1
        print(f"generated client reproduced from the pinned contract: {actual_surface}")
        return 0

    output_root.mkdir(parents=True, exist_ok=True)
    for name in GENERATED_FILES:
        (output_root / name).write_text(rendered[name], encoding="utf-8")
    print(f"generated client surface: {surface_digest(rendered)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(_main())
