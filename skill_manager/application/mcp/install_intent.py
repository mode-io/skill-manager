from __future__ import annotations

from dataclasses import dataclass, replace
from typing import Literal, Mapping

from skill_manager.errors import MutationError

from .install_config import resolved_config_values
from .install_resolver import (
    RegistryInstallOption,
    registry_install_option,
    registry_install_option_by_key,
    resolve_registry_server_spec,
)
from .store import McpServerSpec


@dataclass(frozen=True)
class RegistryInstallIntent:
    kind: Literal["registry"]
    qualified_name: str
    option_key: str
    values: tuple[tuple[str, str], ...] = ()

    @classmethod
    def create(
        cls,
        *,
        qualified_name: str,
        option_key: str,
        values: Mapping[str, str] | None = None,
    ) -> "RegistryInstallIntent":
        return cls(
            kind="registry",
            qualified_name=qualified_name,
            option_key=option_key,
            values=tuple(sorted((values or {}).items())),
        )

    @classmethod
    def from_dict(cls, payload: Mapping[str, object]) -> "RegistryInstallIntent | None":
        if payload.get("kind") != "registry":
            return None
        qualified_name = payload.get("qualifiedName")
        option_key = payload.get("optionKey")
        if not isinstance(qualified_name, str) or not isinstance(option_key, str):
            return None
        raw_values = payload.get("values")
        values = (
            tuple((str(key), str(value)) for key, value in raw_values.items())
            if isinstance(raw_values, Mapping)
            else ()
        )
        return cls(kind="registry", qualified_name=qualified_name, option_key=option_key, values=values)

    def to_dict(self) -> dict[str, object]:
        return {
            "kind": self.kind,
            "qualifiedName": self.qualified_name,
            "optionKey": self.option_key,
            "values": dict(self.values),
        }

    def values_dict(self) -> dict[str, str]:
        return dict(self.values)

    def with_values(self, values: Mapping[str, str]) -> "RegistryInstallIntent":
        return replace(self, values=tuple(sorted(values.items())))


@dataclass(frozen=True)
class ManagedMcpRecord:
    spec: McpServerSpec
    install_intent: RegistryInstallIntent | None = None

    def to_dict(self) -> dict[str, object]:
        payload = self.spec.to_dict()
        if self.install_intent is not None:
            payload["installIntent"] = self.install_intent.to_dict()
        return payload

    @classmethod
    def from_dict(cls, payload: Mapping[str, object]) -> "ManagedMcpRecord":
        spec = McpServerSpec.from_dict(payload)
        raw_intent = payload.get("installIntent")
        install_intent = (
            RegistryInstallIntent.from_dict(raw_intent)
            if isinstance(raw_intent, Mapping)
            else None
        )
        return cls(spec=spec, install_intent=install_intent)


def registry_record_from_detail(
    detail: Mapping[str, object],
    *,
    config: Mapping[str, object] | None = None,
    allow_missing_required: bool = False,
) -> ManagedMcpRecord:
    option = _selected_option(detail, None)
    values = resolved_config_values(
        option.fields,
        config or {},
        allow_missing_required=allow_missing_required,
    )
    spec = resolve_registry_server_spec(
        detail,
        config=values,
        allow_missing_required=allow_missing_required,
        option_key=option.option_key,
    )
    return ManagedMcpRecord(
        spec=spec,
        install_intent=RegistryInstallIntent.create(
            qualified_name=spec.source.locator,
            option_key=option.option_key,
            values=values,
        ),
    )


def install_intent_config_status(
    detail: Mapping[str, object],
    intent: RegistryInstallIntent | None,
) -> tuple[bool, tuple[str, ...]]:
    option = _selected_option(detail, intent.option_key if intent else None)
    fields = option.fields
    if not fields:
        return False, ()
    values = intent.values_dict() if intent is not None else {}
    missing = tuple(
        field.name
        for field in fields
        if field.required and field.default is None and not _has_value(values.get(field.name))
    )
    return True, missing


def resolve_enable_record(
    detail: Mapping[str, object],
    record: ManagedMcpRecord,
    *,
    config: Mapping[str, object] | None,
    legacy_values: Mapping[str, str] | None = None,
) -> ManagedMcpRecord:
    if record.spec.source.kind != "marketplace":
        return record
    intent = record.install_intent or _legacy_registry_intent(detail, record, legacy_values or {})
    option = _selected_option(detail, intent.option_key)
    current = intent.values_dict()
    if config is None:
        missing = tuple(
            field.name
            for field in option.fields
            if field.required and field.default is None and not _has_value(current.get(field.name))
        )
        if missing:
            raise MutationError(
                f"missing required install config: {', '.join(missing)}",
                status=400,
            )
        values = current
    else:
        merged: dict[str, object] = dict(current)
        for key, value in config.items():
            if value is None or value == "":
                continue
            merged[key] = value
        values = resolved_config_values(option.fields, merged)

    resolved = resolve_registry_server_spec(detail, config=values, option_key=option.option_key)
    spec = replace(
        resolved,
        name=record.spec.name,
        display_name=record.spec.display_name,
        source=record.spec.source,
        installed_at=record.spec.installed_at,
    )
    return ManagedMcpRecord(spec=spec, install_intent=intent.with_values(values))


def _legacy_registry_intent(
    detail: Mapping[str, object],
    record: ManagedMcpRecord,
    values: Mapping[str, str],
) -> RegistryInstallIntent:
    option = _selected_option(detail, None)
    return RegistryInstallIntent.create(
        qualified_name=record.spec.source.locator,
        option_key=option.option_key,
        values=values,
    )


def _selected_option(
    detail: Mapping[str, object],
    option_key: str | None,
) -> RegistryInstallOption:
    option = registry_install_option_by_key(detail, option_key) if option_key else None
    if option is None:
        option = registry_install_option(detail)
    if option is None:
        raise MutationError("registry server has no supported install configuration", status=400)
    return option


def _has_value(value: object) -> bool:
    return isinstance(value, str) and value != ""


__all__ = [
    "ManagedMcpRecord",
    "RegistryInstallIntent",
    "install_intent_config_status",
    "registry_record_from_detail",
    "resolve_enable_record",
]
