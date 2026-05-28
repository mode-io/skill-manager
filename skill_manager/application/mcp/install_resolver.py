from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Callable, Literal, Mapping

from skill_manager.errors import MutationError

from .install_config import (
    ArgumentBinding,
    EnvBinding,
    HeaderBinding,
    McpInstallConfig,
    McpInstallConfigField,
    argument_fields_and_bindings,
    dedupe_fields,
    env_fields_and_bindings,
    header_fields_and_bindings,
    resolve_arguments,
    resolve_env,
    resolve_headers,
    resolve_template,
    resolved_config_values,
    url_variable_fields,
)
from .store import McpServerSpec, McpSource


_SAFE_NAME_RE = re.compile(r"[^a-z0-9]+")


@dataclass(frozen=True)
class RegistryInstallOption:
    transport: Literal["stdio", "http", "sse"]
    command: str | None = None
    args: tuple[str, ...] | None = None
    url: str | None = None
    fields: tuple[McpInstallConfigField, ...] = ()
    env_bindings: tuple[EnvBinding, ...] = ()
    header_bindings: tuple[HeaderBinding, ...] = ()
    url_variables: tuple[str, ...] = ()
    argument_bindings: tuple[ArgumentBinding, ...] = ()


@dataclass(frozen=True)
class _PackageInstallInput:
    registry_type: str
    identifier: str
    version: str
    fields: tuple[McpInstallConfigField, ...]
    env_bindings: tuple[EnvBinding, ...]
    argument_bindings: tuple[ArgumentBinding, ...]


def registry_managed_name(qualified_name: str) -> str:
    cleaned = qualified_name.strip().lstrip("@").lower()
    normalized = _SAFE_NAME_RE.sub("-", cleaned).strip("-")
    return normalized or "mcp-server"


def registry_install_config(detail: Mapping[str, object]) -> McpInstallConfig:
    option = registry_install_option(detail)
    return McpInstallConfig(option.fields) if option is not None else McpInstallConfig()


def registry_install_option(detail: Mapping[str, object]) -> RegistryInstallOption | None:
    options = registry_install_options(_server_payload(detail))
    return options[0] if options else None


def resolve_registry_server_spec(
    detail: Mapping[str, object],
    *,
    config: Mapping[str, object] | None = None,
    allow_missing_required: bool = False,
) -> McpServerSpec:
    server = _server_payload(detail)
    qualified_name = _str(detail.get("qualifiedName")) or _str(server.get("name"))
    if not qualified_name:
        raise MutationError("registry server is missing a name", status=502)
    display_name = _str(detail.get("displayName")) or _str(server.get("title")) or qualified_name
    options = registry_install_options(server)
    if not options:
        raise MutationError(
            f"registry server '{qualified_name}' has no supported install configuration",
            status=400,
        )
    option = options[0]
    common = {
        "name": registry_managed_name(qualified_name),
        "display_name": display_name,
        "source": McpSource.marketplace(qualified_name),
    }
    values = resolved_config_values(
        option.fields,
        config or {},
        allow_missing_required=allow_missing_required,
    )
    if option.transport == "stdio":
        return _resolve_stdio_spec(common, option, values)
    if option.transport in {"http", "sse"}:
        return _resolve_remote_spec(common, option, values)
    raise MutationError(
        f"registry server '{qualified_name}' has unsupported transport: {option.transport}",
        status=400,
    )


def _resolve_stdio_spec(
    common: Mapping[str, object],
    option: RegistryInstallOption,
    values: Mapping[str, str],
) -> McpServerSpec:
    args = tuple(option.args or ())
    runtime_args = resolve_arguments(option.argument_bindings, values, "runtimeArgument")
    package_args = resolve_arguments(option.argument_bindings, values, "packageArgument")
    if runtime_args or package_args:
        args = _merge_stdio_args(args, runtime_args, package_args)
    return McpServerSpec(
        **common,
        transport="stdio",
        command=option.command,
        args=args,
        env=resolve_env(option.env_bindings, values),
    )


def _resolve_remote_spec(
    common: Mapping[str, object],
    option: RegistryInstallOption,
    values: Mapping[str, str],
) -> McpServerSpec:
    return McpServerSpec(
        **common,
        transport=option.transport,
        url=resolve_template(option.url or "", values),
        headers=resolve_headers(option.header_bindings, values),
    )


def registry_install_options(server: Mapping[str, object]) -> tuple[RegistryInstallOption, ...]:
    options: list[RegistryInstallOption] = []
    options.extend(_package_options(server))
    options.extend(_remote_options(server))
    return tuple(options)


def _package_options(server: Mapping[str, object]) -> list[RegistryInstallOption]:
    packages = server.get("packages")
    if not isinstance(packages, list):
        return []
    options: list[RegistryInstallOption] = []
    for package in packages:
        install_input = _package_install_input(package, server)
        if install_input is None:
            continue
        option = _build_package_option(install_input)
        if option is not None:
            options.append(option)
    return options


def _package_install_input(package: object, server: Mapping[str, object]) -> _PackageInstallInput | None:
    if not isinstance(package, Mapping):
        return None
    transport = package.get("transport")
    transport_type = _str(transport.get("type")) if isinstance(transport, Mapping) else ""
    if transport_type != "stdio":
        return None
    identifier = _str(package.get("identifier"))
    if not identifier:
        return None

    fields: list[McpInstallConfigField] = []
    env_bindings: list[EnvBinding] = []
    fields.extend(env_fields_and_bindings(package, env_bindings))
    argument_bindings: list[ArgumentBinding] = []
    fields.extend(argument_fields_and_bindings(package.get("runtimeArguments"), "runtimeArgument", argument_bindings))
    fields.extend(argument_fields_and_bindings(package.get("packageArguments"), "packageArgument", argument_bindings))
    return _PackageInstallInput(
        registry_type=_str(package.get("registryType")).lower(),
        identifier=identifier,
        version=_str(package.get("version")) or _str(server.get("version")),
        fields=dedupe_fields(fields),
        env_bindings=tuple(env_bindings),
        argument_bindings=tuple(argument_bindings),
    )


def _build_package_option(install_input: _PackageInstallInput) -> RegistryInstallOption | None:
    command_builder = _PACKAGE_COMMAND_BUILDERS.get(install_input.registry_type)
    if command_builder is None:
        return None
    command, args = command_builder(install_input.identifier, install_input.version)
    return RegistryInstallOption(
        transport="stdio",
        command=command,
        args=args,
        fields=install_input.fields,
        env_bindings=install_input.env_bindings,
        argument_bindings=install_input.argument_bindings,
    )


def _remote_options(server: Mapping[str, object]) -> list[RegistryInstallOption]:
    remotes = server.get("remotes")
    if not isinstance(remotes, list):
        return []
    options: list[RegistryInstallOption] = []
    for remote in remotes:
        if not isinstance(remote, Mapping):
            continue
        remote_type = _str(remote.get("type")).lower()
        transport = _REMOTE_TRANSPORTS.get(remote_type)
        if transport is None:
            continue
        url = _str(remote.get("url"))
        if not url:
            continue
        fields: list[McpInstallConfigField] = []
        url_variables = url_variable_fields(remote, fields)
        header_bindings: list[HeaderBinding] = []
        fields.extend(header_fields_and_bindings(remote, header_bindings))
        options.append(
            RegistryInstallOption(
                transport=transport,
                url=url,
                fields=dedupe_fields(fields),
                header_bindings=tuple(header_bindings),
                url_variables=tuple(url_variables),
            )
        )
    return options


def _server_payload(detail: Mapping[str, object]) -> Mapping[str, object]:
    server = detail.get("registryServer")
    if isinstance(server, Mapping):
        return server
    server = detail.get("server")
    if isinstance(server, Mapping):
        return server
    return detail


def _versioned_npm_identifier(identifier: str, version: str) -> str:
    if not version:
        return identifier
    if identifier.startswith("@"):
        if "@" in identifier[1:]:
            return identifier
        return f"{identifier}@{version}"
    if "@" in identifier:
        return identifier
    return f"{identifier}@{version}"


def _versioned_oci_identifier(identifier: str, version: str) -> str:
    if not version:
        return identifier
    last_segment = identifier.rsplit("/", 1)[-1]
    if ":" in last_segment:
        return identifier
    return f"{identifier}:{version}"


def _npm_package_command(identifier: str, version: str) -> tuple[str, tuple[str, ...]]:
    return "npx", ("-y", _versioned_npm_identifier(identifier, version))


def _pypi_package_command(identifier: str, version: str) -> tuple[str, tuple[str, ...]]:
    package_ref = f"{identifier}=={version}" if version else identifier
    return "uvx", (package_ref,)


def _oci_package_command(identifier: str, version: str) -> tuple[str, tuple[str, ...]]:
    return "docker", ("run", "--rm", "-i", _versioned_oci_identifier(identifier, version))


_PACKAGE_COMMAND_BUILDERS: dict[str, Callable[[str, str], tuple[str, tuple[str, ...]]]] = {
    "npm": _npm_package_command,
    "pypi": _pypi_package_command,
    "oci": _oci_package_command,
}

_REMOTE_TRANSPORTS: dict[str, Literal["http", "sse"]] = {
    "streamable-http": "http",
    "sse": "sse",
}


def _merge_stdio_args(args: tuple[str, ...], runtime_args: tuple[str, ...], package_args: tuple[str, ...]) -> tuple[str, ...]:
    if not runtime_args:
        return args + package_args
    if not args:
        return runtime_args + package_args
    return args[:-1] + runtime_args + args[-1:] + package_args


def _str(value: object) -> str:
    return value.strip() if isinstance(value, str) else ""


def _optional_str(value: object) -> str | None:
    return value.strip() if isinstance(value, str) and value.strip() else None


__all__ = [
    "McpInstallConfig",
    "McpInstallConfigField",
    "RegistryInstallOption",
    "registry_install_config",
    "registry_install_option",
    "registry_install_options",
    "registry_managed_name",
    "resolve_registry_server_spec",
]
