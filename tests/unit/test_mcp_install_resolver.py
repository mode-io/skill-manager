from __future__ import annotations

import unittest

from skill_manager.application.mcp.install_resolver import (
    registry_install_config,
    registry_managed_name,
    resolve_registry_server_spec,
)
from skill_manager.errors import MutationError


def _detail(
    *,
    name: str = "ai.adeu/adeu",
    title: str = "ADEU",
    version: str = "1.7.1",
    packages: list[dict[str, object]] | None = None,
    remotes: list[dict[str, object]] | None = None,
) -> dict[str, object]:
    server: dict[str, object] = {
        "name": name,
        "title": title,
        "version": version,
        "description": "description",
    }
    if packages is not None:
        server["packages"] = packages
    if remotes is not None:
        server["remotes"] = remotes
    return {
        "qualifiedName": name,
        "displayName": title,
        "registryServer": server,
    }


class RegistryManagedNameTests(unittest.TestCase):
    def test_uses_full_registry_name_to_avoid_mcp_collisions(self) -> None:
        self.assertEqual(registry_managed_name("ac.inference.sh/mcp"), "ac-inference-sh-mcp")
        self.assertEqual(registry_managed_name("ai.adeu/adeu"), "ai-adeu-adeu")
        self.assertEqual(registry_managed_name("@scope/pkg"), "scope-pkg")


class RegistryInstallResolverTests(unittest.TestCase):
    def test_npm_stdio_package_maps_to_npx_command(self) -> None:
        spec = resolve_registry_server_spec(
            _detail(
                packages=[
                    {
                        "registryType": "npm",
                        "identifier": "@adeu/mcp-server",
                        "version": "1.7.1",
                        "transport": {"type": "stdio"},
                    }
                ]
            )
        )

        self.assertEqual(spec.name, "ai-adeu-adeu")
        self.assertEqual(spec.display_name, "ADEU")
        self.assertEqual(spec.source.locator, "ai.adeu/adeu")
        self.assertEqual(spec.transport, "stdio")
        self.assertEqual(spec.command, "npx")
        self.assertEqual(spec.args, ("-y", "@adeu/mcp-server@1.7.1"))

    def test_package_environment_variables_generate_config_fields(self) -> None:
        install_config = registry_install_config(
            _detail(
                name="ai.cueapi/mcp",
                packages=[
                    {
                        "registryType": "npm",
                        "identifier": "@cueapi/mcp",
                        "version": "0.1.3",
                        "transport": {"type": "stdio"},
                        "environmentVariables": [
                            {
                                "name": "CUEAPI_API_KEY",
                                "description": "CueAPI API key. Generate at https://cueapi.ai",
                                "isRequired": True,
                                "format": "string",
                                "isSecret": True,
                            },
                            {
                                "name": "CUEAPI_BASE_URL",
                                "description": "Override the CueAPI base URL",
                                "format": "string",
                                "default": "https://api.cueapi.ai",
                            },
                        ],
                    }
                ],
            )
        )

        self.assertTrue(install_config.required)
        self.assertEqual([field.name for field in install_config.fields], ["CUEAPI_API_KEY", "CUEAPI_BASE_URL"])
        self.assertTrue(install_config.fields[0].required)
        self.assertTrue(install_config.fields[0].secret)
        self.assertEqual(install_config.fields[0].target, "env")

    def test_package_environment_config_is_written_to_spec_env(self) -> None:
        spec = resolve_registry_server_spec(
            _detail(
                name="ai.cueapi/mcp",
                packages=[
                    {
                        "registryType": "npm",
                        "identifier": "@cueapi/mcp",
                        "version": "0.1.3",
                        "transport": {"type": "stdio"},
                        "environmentVariables": [
                            {"name": "CUEAPI_API_KEY", "isRequired": True, "isSecret": True},
                            {"name": "CUEAPI_BASE_URL", "default": "https://api.cueapi.ai"},
                        ],
                    }
                ],
            ),
            config={"CUEAPI_API_KEY": "cue-key"},
        )

        self.assertEqual(
            spec.env,
            (("CUEAPI_API_KEY", "cue-key"), ("CUEAPI_BASE_URL", "https://api.cueapi.ai")),
        )

    def test_required_install_config_missing_returns_400(self) -> None:
        with self.assertRaises(MutationError) as captured:
            resolve_registry_server_spec(
                _detail(
                    name="ai.cueapi/mcp",
                    packages=[
                        {
                            "registryType": "npm",
                            "identifier": "@cueapi/mcp",
                            "version": "0.1.3",
                            "transport": {"type": "stdio"},
                            "environmentVariables": [{"name": "CUEAPI_API_KEY", "isRequired": True}],
                        }
                    ],
                ),
            )

        self.assertEqual(captured.exception.status, 400)
        self.assertIn("missing required install config", str(captured.exception))

    def test_pypi_stdio_package_maps_to_uvx_command(self) -> None:
        spec = resolve_registry_server_spec(
            _detail(
                name="ai.example/python",
                version="2.0.0",
                packages=[
                    {
                        "registryType": "pypi",
                        "identifier": "python-mcp",
                        "version": "2.0.0",
                        "transport": {"type": "stdio"},
                    }
                ],
            )
        )

        self.assertEqual(spec.command, "uvx")
        self.assertEqual(spec.args, ("python-mcp==2.0.0",))

    def test_oci_stdio_package_maps_to_docker_command_and_appends_version(self) -> None:
        spec = resolve_registry_server_spec(
            _detail(
                name="ai.example/docker",
                version="3.0.0",
                packages=[
                    {
                        "registryType": "oci",
                        "identifier": "ghcr.io/acme/mcp-server",
                        "version": "3.0.0",
                        "transport": {"type": "stdio"},
                    }
                ],
            )
        )

        self.assertEqual(spec.command, "docker")
        self.assertEqual(spec.args, ("run", "--rm", "-i", "ghcr.io/acme/mcp-server:3.0.0"))

    def test_streamable_http_remote_maps_to_http_without_headers(self) -> None:
        spec = resolve_registry_server_spec(
            _detail(
                name="ai.example/remote",
                packages=[],
                remotes=[
                    {
                        "type": "streamable-http",
                        "url": "https://api.example.com/mcp",
                    }
                ],
            )
        )

        self.assertEqual(spec.transport, "http")
        self.assertEqual(spec.url, "https://api.example.com/mcp")
        self.assertIsNone(spec.headers)

    def test_remote_headers_and_url_variables_are_applied(self) -> None:
        spec = resolve_registry_server_spec(
            _detail(
                name="ai.example/remote",
                packages=[],
                remotes=[
                    {
                        "type": "streamable-http",
                        "url": "https://api.example.com/{workspace}/mcp",
                        "variables": {
                            "workspace": {"description": "Workspace slug", "isRequired": True}
                        },
                        "headers": [
                            {
                                "name": "Authorization",
                                "value": "Bearer {API_TOKEN}",
                                "isRequired": True,
                                "isSecret": True,
                                "variables": {
                                    "API_TOKEN": {"description": "API token", "isRequired": True, "isSecret": True}
                                },
                            }
                        ],
                    }
                ],
            ),
            config={"workspace": "acme", "API_TOKEN": "token-123"},
        )

        self.assertEqual(spec.transport, "http")
        self.assertEqual(spec.url, "https://api.example.com/acme/mcp")
        self.assertEqual(spec.headers, (("Authorization", "Bearer token-123"),))

    def test_sse_remote_maps_to_sse(self) -> None:
        spec = resolve_registry_server_spec(
            _detail(
                name="ai.example/sse",
                packages=[],
                remotes=[{"type": "sse", "url": "https://api.example.com/sse"}],
            )
        )

        self.assertEqual(spec.transport, "sse")
        self.assertEqual(spec.url, "https://api.example.com/sse")

    def test_local_packages_are_preferred_over_remotes(self) -> None:
        spec = resolve_registry_server_spec(
            _detail(
                packages=[
                    {
                        "registryType": "npm",
                        "identifier": "@adeu/mcp-server",
                        "version": "1.7.1",
                        "transport": {"type": "stdio"},
                    }
                ],
                remotes=[{"type": "streamable-http", "url": "https://api.example.com/mcp"}],
            )
        )

        self.assertEqual(spec.transport, "stdio")
        self.assertEqual(spec.command, "npx")

if __name__ == "__main__":
    unittest.main()
