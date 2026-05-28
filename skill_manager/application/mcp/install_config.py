from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Literal, Mapping

from skill_manager.errors import MutationError


McpInstallConfigTarget = Literal["env", "header", "urlVariable", "packageArgument", "runtimeArgument"]
McpInstallConfigFormat = Literal["string", "number", "boolean", "filepath"]

_PLACEHOLDER_RE = re.compile(r"\{([^{}]+)\}")


@dataclass(frozen=True)
class McpInstallConfigField:
    name: str
    label: str
    description: str
    format: McpInstallConfigFormat = "string"
    required: bool = False
    secret: bool = False
    default: str | None = None
    placeholder: str | None = None
    choices: tuple[str, ...] = ()
    target: McpInstallConfigTarget = "env"

    def to_dict(self) -> dict[str, object]:
        return {
            "name": self.name,
            "label": self.label,
            "description": self.description,
            "format": self.format,
            "required": self.required,
            "secret": self.secret,
            "default": self.default,
            "placeholder": self.placeholder,
            "choices": list(self.choices),
            "target": self.target,
        }


@dataclass(frozen=True)
class McpInstallConfig:
    fields: tuple[McpInstallConfigField, ...] = ()

    @property
    def required(self) -> bool:
        return any(field.required for field in self.fields)

    def to_dict(self) -> dict[str, object]:
        return {
            "required": self.required,
            "fields": [field.to_dict() for field in self.fields],
        }


@dataclass(frozen=True)
class EnvBinding:
    key: str
    field_name: str | None = None
    value_template: str | None = None


@dataclass(frozen=True)
class HeaderBinding:
    key: str
    field_name: str | None = None
    value_template: str | None = None


@dataclass(frozen=True)
class ArgumentBinding:
    target: Literal["packageArgument", "runtimeArgument"]
    kind: Literal["positional", "named"]
    name: str | None = None
    field_name: str | None = None
    value_template: str | None = None
    repeated: bool = False


def env_fields_and_bindings(package: Mapping[str, object], bindings: list[EnvBinding]) -> list[McpInstallConfigField]:
    raw = package.get("environmentVariables")
    if not isinstance(raw, list):
        return []
    fields: list[McpInstallConfigField] = []
    for item in raw:
        if not isinstance(item, Mapping):
            continue
        name = _str(item.get("name"))
        if not name:
            continue
        value = _optional_str(item.get("value"))
        variable_fields = variable_fields_from_input(item.get("variables"), target="env")
        if value is not None and variable_fields:
            fields.extend(variable_fields)
            bindings.append(EnvBinding(key=name, value_template=value))
        elif value is not None:
            bindings.append(EnvBinding(key=name, value_template=value))
        else:
            fields.append(field_from_input(name, item, target="env"))
            bindings.append(EnvBinding(key=name, field_name=name))
    return fields


def header_fields_and_bindings(remote: Mapping[str, object], bindings: list[HeaderBinding]) -> list[McpInstallConfigField]:
    raw = remote.get("headers")
    if not isinstance(raw, list):
        return []
    fields: list[McpInstallConfigField] = []
    for item in raw:
        if not isinstance(item, Mapping):
            continue
        name = _str(item.get("name"))
        if not name:
            continue
        value = _optional_str(item.get("value"))
        variable_fields = variable_fields_from_input(item.get("variables"), target="header")
        if value is not None and variable_fields:
            fields.extend(variable_fields)
            bindings.append(HeaderBinding(key=name, value_template=value))
        elif value is not None:
            bindings.append(HeaderBinding(key=name, value_template=value))
        else:
            fields.append(field_from_input(name, item, target="header"))
            bindings.append(HeaderBinding(key=name, field_name=name))
    return fields


def url_variable_fields(remote: Mapping[str, object], fields: list[McpInstallConfigField]) -> list[str]:
    variables = remote.get("variables")
    if not isinstance(variables, Mapping):
        return []
    names: list[str] = []
    for name, definition in variables.items():
        if not isinstance(name, str) or not isinstance(definition, Mapping):
            continue
        fields.append(field_from_input(name, definition, target="urlVariable"))
        names.append(name)
    return names


def argument_fields_and_bindings(
    raw: object,
    target: Literal["packageArgument", "runtimeArgument"],
    bindings: list[ArgumentBinding],
) -> list[McpInstallConfigField]:
    if not isinstance(raw, list):
        return []
    fields: list[McpInstallConfigField] = []
    for item in raw:
        if not isinstance(item, Mapping):
            continue
        if bool(item.get("isRepeated")):
            continue
        arg_type = _str(item.get("type"))
        if arg_type not in {"positional", "named"}:
            continue
        value = _optional_str(item.get("value"))
        variable_fields = variable_fields_from_input(item.get("variables"), target=target)
        if value is not None and variable_fields:
            fields.extend(variable_fields)
            bindings.append(ArgumentBinding(target=target, kind=arg_type, name=_optional_str(item.get("name")), value_template=value))
            continue
        if value is not None:
            bindings.append(ArgumentBinding(target=target, kind=arg_type, name=_optional_str(item.get("name")), value_template=value))
            continue
        field_name = _argument_field_name(item)
        if not field_name:
            continue
        fields.append(field_from_input(field_name, item, target=target))
        bindings.append(ArgumentBinding(target=target, kind=arg_type, name=_optional_str(item.get("name")), field_name=field_name))
    return fields


def dedupe_fields(fields: list[McpInstallConfigField]) -> tuple[McpInstallConfigField, ...]:
    by_name: dict[str, McpInstallConfigField] = {}
    for field in fields:
        current = by_name.get(field.name)
        if current is None:
            by_name[field.name] = field
            continue
        by_name[field.name] = McpInstallConfigField(
            name=current.name,
            label=current.label,
            description=current.description or field.description,
            format=current.format,
            required=current.required or field.required,
            secret=current.secret or field.secret,
            default=current.default if current.default is not None else field.default,
            placeholder=current.placeholder if current.placeholder is not None else field.placeholder,
            choices=current.choices or field.choices,
            target=current.target,
        )
    return tuple(by_name.values())


def resolved_config_values(
    fields: tuple[McpInstallConfigField, ...],
    provided: Mapping[str, object],
    *,
    allow_missing_required: bool = False,
) -> dict[str, str]:
    values: dict[str, str] = {}
    missing: list[str] = []
    for field in fields:
        raw = provided.get(field.name)
        if raw is None or raw == "":
            if field.default is not None:
                values[field.name] = field.default
            elif field.required and not allow_missing_required:
                missing.append(field.name)
            continue
        values[field.name] = _stringify_config_value(raw, field)
    if missing:
        raise MutationError(f"missing required install config: {', '.join(missing)}", status=400)
    return values


def resolve_env(bindings: tuple[EnvBinding, ...], values: Mapping[str, str]) -> tuple[tuple[str, str], ...] | None:
    pairs: list[tuple[str, str]] = []
    for binding in bindings:
        value = binding_value(binding.field_name, binding.value_template, values)
        if value is not None:
            pairs.append((binding.key, value))
    return tuple(pairs) if pairs else None


def resolve_headers(bindings: tuple[HeaderBinding, ...], values: Mapping[str, str]) -> tuple[tuple[str, str], ...] | None:
    pairs: list[tuple[str, str]] = []
    for binding in bindings:
        value = binding_value(binding.field_name, binding.value_template, values)
        if value is not None:
            pairs.append((binding.key, value))
    return tuple(pairs) if pairs else None


def binding_value(field_name: str | None, value_template: str | None, values: Mapping[str, str]) -> str | None:
    if value_template is not None:
        return resolve_template(value_template, values)
    if field_name is None:
        return None
    return values.get(field_name)


def resolve_template(template: str, values: Mapping[str, str]) -> str:
    def replace(match: re.Match[str]) -> str:
        key = match.group(1)
        return values.get(key, match.group(0))

    return _PLACEHOLDER_RE.sub(replace, template)


def resolve_arguments(
    bindings: tuple[ArgumentBinding, ...],
    values: Mapping[str, str],
    target: Literal["packageArgument", "runtimeArgument"],
) -> tuple[str, ...]:
    args: list[str] = []
    for binding in bindings:
        if binding.target != target:
            continue
        value = binding_value(binding.field_name, binding.value_template, values)
        if value is None:
            continue
        if binding.kind == "named" and binding.name:
            args.append(f"{binding.name}={value}")
        else:
            args.append(value)
    return tuple(args)


def variable_fields_from_input(raw: object, *, target: McpInstallConfigTarget) -> list[McpInstallConfigField]:
    if not isinstance(raw, Mapping):
        return []
    fields: list[McpInstallConfigField] = []
    for name, definition in raw.items():
        if isinstance(name, str) and isinstance(definition, Mapping):
            fields.append(field_from_input(name, definition, target=target))
    return fields


def field_from_input(name: str, raw: Mapping[str, object], *, target: McpInstallConfigTarget) -> McpInstallConfigField:
    choices = raw.get("choices")
    return McpInstallConfigField(
        name=name,
        label=name,
        description=_str(raw.get("description")),
        format=_input_format(raw.get("format")),
        required=bool(raw.get("isRequired", False)),
        secret=bool(raw.get("isSecret", False)),
        default=_optional_str(raw.get("default")),
        placeholder=_optional_str(raw.get("placeholder")),
        choices=tuple(str(choice) for choice in choices) if isinstance(choices, list) else (),
        target=target,
    )


def _argument_field_name(item: Mapping[str, object]) -> str:
    return _str(item.get("valueHint")) or _str(item.get("name"))


def _input_format(value: object) -> McpInstallConfigFormat:
    return value if value in {"string", "number", "boolean", "filepath"} else "string"  # type: ignore[return-value]


def _stringify_config_value(value: object, field: McpInstallConfigField) -> str:
    if field.choices and str(value) not in field.choices:
        raise MutationError(f"invalid value for install config '{field.name}'", status=400)
    if field.format == "boolean":
        if isinstance(value, bool):
            return "true" if value else "false"
        normalized = str(value).strip().lower()
        if normalized in {"true", "1", "yes", "on"}:
            return "true"
        if normalized in {"false", "0", "no", "off"}:
            return "false"
        raise MutationError(f"invalid boolean value for install config '{field.name}'", status=400)
    return str(value)


def _str(value: object) -> str:
    return value.strip() if isinstance(value, str) else ""


def _optional_str(value: object) -> str | None:
    return value.strip() if isinstance(value, str) and value.strip() else None
