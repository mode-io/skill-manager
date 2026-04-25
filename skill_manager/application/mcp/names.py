from __future__ import annotations


def canonical_server_name(qualified_name: str) -> str:
    """Normalize a marketplace qualified name into the managed MCP key."""
    if not qualified_name:
        return ""
    cleaned = qualified_name.lstrip("@")
    if "/" in cleaned:
        cleaned = cleaned.split("/", 1)[1]
    return cleaned.replace("@", "-").replace("/", "-").lower()


__all__ = ["canonical_server_name"]
