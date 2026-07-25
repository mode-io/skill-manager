from __future__ import annotations

import unittest

from skill_manager.application.mcp.marketplace.support_policy import (
    supported_registry_entry,
)

_OFFICIAL_META = "io.modelcontextprotocol.registry/official"


def _entry(
    *,
    packages: list[dict[str, object]] | None = None,
    remotes: list[dict[str, object]] | None = None,
    latest: bool = True,
    status: str = "active",
) -> dict[str, object]:
    server: dict[str, object] = {
        "name": "ai.example/mcp",
        "version": "1.0.0",
        "description": "Example",
    }
    if packages is not None:
        server["packages"] = packages
    if remotes is not None:
        server["remotes"] = remotes
    return {
        "server": server,
        "_meta": {
            _OFFICIAL_META: {
                "status": status,
                "isLatest": latest,
            }
        },
    }


class RegistrySupportPolicyTests(unittest.TestCase):
    def test_accepts_supported_local_package(self) -> None:
        result = supported_registry_entry(
            _entry(
                packages=[
                    {
                        "registryType": "npm",
                        "identifier": "@example/mcp",
                        "version": "1.0.0",
                        "transport": {"type": "stdio"},
                    }
                ]
            )
        )

        self.assertIsNotNone(result)
        assert result is not None
        _server, options = result
        self.assertEqual(options[0].option_key, "package:npm:@example/mcp:1.0.0")

    def test_rejects_unsupported_connection_shapes_generically(self) -> None:
        self.assertIsNone(
            supported_registry_entry(
                _entry(remotes=[{"type": "websocket", "url": "wss://example.com/mcp"}])
            )
        )
        self.assertIsNone(
            supported_registry_entry(
                _entry(
                    packages=[
                        {
                            "registryType": "gem",
                            "identifier": "example-mcp",
                            "version": "1.0.0",
                            "transport": {"type": "stdio"},
                        }
                    ]
                )
            )
        )

    def test_rejects_non_current_entries(self) -> None:
        self.assertIsNone(
            supported_registry_entry(
                _entry(
                    packages=[
                        {
                            "registryType": "npm",
                            "identifier": "@example/mcp",
                            "version": "1.0.0",
                            "transport": {"type": "stdio"},
                        }
                    ],
                    latest=False,
                )
            )
        )
        self.assertIsNone(
            supported_registry_entry(
                _entry(
                    packages=[
                        {
                            "registryType": "npm",
                            "identifier": "@example/mcp",
                            "version": "1.0.0",
                            "transport": {"type": "stdio"},
                        }
                    ],
                    status="deleted",
                )
            )
        )


if __name__ == "__main__":
    unittest.main()
