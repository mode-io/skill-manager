from __future__ import annotations

import re
from dataclasses import dataclass, replace
from typing import Mapping

from skill_manager.errors import MutationError

from .install_config import ArgumentBinding
from .install_resolver import (
    RegistryInstallOption,
    registry_install_option,
    resolve_registry_server_spec,
)
from .store import McpServerSpec


@dataclass(frozen=True)
class McpInstallConfigStatus:
    has_fields: bool = False
    missing_required: tuple[str, ...] = ()

    @property
    def configured(self) -> bool:
        return not self.missing_required

    def to_dict(self) -> dict[str, object]:
        return {
            "hasFields": self.has_fields,
            "missingRequired": list(self.missing_required),
            "configured": self.configured,
        }


def install_config_status(
    detail: Mapping[str, object] | None,
    spec: McpServerSpec | None,
) -> McpInstallConfigStatus:
    option = registry_install_option(detail or {})
    fields = option.fields if option is not None else ()
    if not fields:
        return McpInstallConfigStatus()
    values = current_install_config_values(option, spec) if spec is not None else {}
    missing = tuple(
        field.name
        for field in fields
        if field.required and field.default is None and not _has_value(values.get(field.name))
    )
    return McpInstallConfigStatus(has_fields=True, missing_required=missing)


def resolve_enable_spec(
    detail: Mapping[str, object],
    spec: McpServerSpec,
    *,
    config: Mapping[str, object] | None,
) -> McpServerSpec:
    option = registry_install_option(detail)
    if option is None:
        return spec
    status = install_config_status(detail, spec)
    if config is None:
        if status.missing_required:
            raise MutationError(
                f"missing required install config: {', '.join(status.missing_required)}",
                status=400,
            )
        return spec

    merged_config: dict[str, object] = dict(current_install_config_values(option, spec))
    for key, value in config.items():
        if value is None or value == "":
            continue
        merged_config[key] = value

    resolved = resolve_registry_server_spec(detail, config=merged_config)
    return replace(
        resolved,
        name=spec.name,
        display_name=spec.display_name,
        source=spec.source,
        installed_at=spec.installed_at,
    )


def current_install_config_values(
    option: RegistryInstallOption,
    spec: McpServerSpec,
) -> dict[str, str]:
    values: dict[str, str] = {}
    _collect_env_values(option, spec, values)
    _collect_header_values(option, spec, values)
    _collect_url_values(option, spec, values)
    _collect_argument_values(option, spec, values)
    return values


def _collect_env_values(
    option: RegistryInstallOption,
    spec: McpServerSpec,
    values: dict[str, str],
) -> None:
    env = spec.env_dict()
    for binding in option.env_bindings:
        actual = env.get(binding.key)
        if actual is None:
            continue
        if binding.field_name:
            _store_value(values, binding.field_name, actual)
            continue
        if binding.value_template:
            _store_template_values(values, binding.value_template, actual)


def _collect_header_values(
    option: RegistryInstallOption,
    spec: McpServerSpec,
    values: dict[str, str],
) -> None:
    headers = spec.headers_dict()
    for binding in option.header_bindings:
        actual = headers.get(binding.key)
        if actual is None:
            continue
        if binding.field_name:
            _store_value(values, binding.field_name, actual)
            continue
        if binding.value_template:
            _store_template_values(values, binding.value_template, actual)


def _collect_url_values(
    option: RegistryInstallOption,
    spec: McpServerSpec,
    values: dict[str, str],
) -> None:
    if option.url and spec.url:
        _store_template_values(values, option.url, spec.url)


def _collect_argument_values(
    option: RegistryInstallOption,
    spec: McpServerSpec,
    values: dict[str, str],
) -> None:
    for target in ("runtimeArgument", "packageArgument"):
        tokens = _dynamic_argument_tokens(option, spec, target)
        remaining = list(tokens)
        for binding in option.argument_bindings:
            if binding.target != target:
                continue
            if binding.kind == "named" and binding.name:
                actual = _pop_named_argument(remaining, binding.name)
                if actual is None:
                    continue
                _store_argument_binding_value(values, binding, actual)
                continue
            actual = _pop_positional_argument(remaining, binding)
            if actual is not None:
                _store_argument_binding_value(values, binding, actual)


def _store_argument_binding_value(
    values: dict[str, str],
    binding: ArgumentBinding,
    actual: str,
) -> None:
    if binding.field_name:
        _store_value(values, binding.field_name, actual)
        return
    if binding.value_template:
        _store_template_values(values, binding.value_template, actual)


def _dynamic_argument_tokens(
    option: RegistryInstallOption,
    spec: McpServerSpec,
    target: str,
) -> tuple[str, ...]:
    actual = list(spec.args or ())
    base = list(option.args or ())
    if not base:
        return tuple(actual)
    if actual[: len(base)] == base:
        return tuple(actual[len(base) :]) if target == "packageArgument" else ()
    if len(base) == 1:
        try:
            base_index = actual.index(base[0])
        except ValueError:
            return tuple(actual)
        return tuple(actual[:base_index] if target == "runtimeArgument" else actual[base_index + 1 :])
    prefix = base[:-1]
    if actual[: len(prefix)] != prefix:
        return ()
    try:
        final_base_index = actual.index(base[-1], len(prefix))
    except ValueError:
        return ()
    if target == "runtimeArgument":
        return tuple(actual[len(prefix) : final_base_index])
    return tuple(actual[final_base_index + 1 :])


def _pop_named_argument(tokens: list[str], name: str) -> str | None:
    prefix = f"{name}="
    for index, token in enumerate(tokens):
        if token.startswith(prefix):
            tokens.pop(index)
            return token.removeprefix(prefix)
    return None


def _pop_positional_argument(
    tokens: list[str],
    binding: ArgumentBinding,
) -> str | None:
    if binding.value_template:
        for index, token in enumerate(tokens):
            if _template_values(binding.value_template, token):
                return tokens.pop(index)
        return None
    if not tokens:
        return None
    return tokens.pop(0)


def _store_template_values(values: dict[str, str], template: str, actual: str) -> None:
    for key, value in _template_values(template, actual).items():
        _store_value(values, key, value)


def _template_values(template: str, actual: str) -> dict[str, str]:
    names = _placeholder_names(template)
    if not names:
        return {}
    parts: list[str] = []
    cursor = 0
    for match in _PLACEHOLDER_RE.finditer(template):
        parts.append(re.escape(template[cursor : match.start()]))
        parts.append("(.+?)")
        cursor = match.end()
    parts.append(re.escape(template[cursor:]))
    matched = re.fullmatch("".join(parts), actual)
    if matched is None:
        return {}
    result: dict[str, str] = {}
    for name, value in zip(names, matched.groups(), strict=False):
        if value and value != f"{{{name}}}":
            result[name] = value
    return result


def _placeholder_names(template: str) -> tuple[str, ...]:
    return tuple(match.group(1) for match in _PLACEHOLDER_RE.finditer(template))


def _store_value(values: dict[str, str], key: str, value: str) -> None:
    if _has_value(value):
        values[key] = value


def _has_value(value: object) -> bool:
    return isinstance(value, str) and value != ""


_PLACEHOLDER_RE = re.compile(r"\{([^{}]+)\}")


__all__ = [
    "McpInstallConfigStatus",
    "current_install_config_values",
    "install_config_status",
    "resolve_enable_spec",
]
