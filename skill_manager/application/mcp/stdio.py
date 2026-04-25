from __future__ import annotations

import ast
import re
from dataclasses import dataclass


@dataclass(frozen=True)
class StaticStdioCommand:
    command: str
    args: tuple[str, ...] = ()


_JS_STRING_PATTERN = r"""(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')"""
_JS_STRING_RE = re.compile(_JS_STRING_PATTERN)


def parse_static_stdio_function(value: object) -> StaticStdioCommand | None:
    """Extract a static command recipe from Smithery's stdioFunction string.

    The marketplace field is JavaScript source. We intentionally parse only the
    simple object-literal subset and never evaluate code.
    """
    if not isinstance(value, str) or not value.strip():
        return None
    if _has_dynamic_config_reference(value):
        return None
    command_literal = _find_js_string_property(value, "command")
    if command_literal is None:
        return None
    command = _decode_js_string(command_literal)
    if not command:
        return None
    args = _find_js_string_array_property(value, "args")
    if args is None:
        return None
    return StaticStdioCommand(command=command, args=args)


def _has_dynamic_config_reference(source: str) -> bool:
    without_strings = _JS_STRING_RE.sub("", source)
    return re.search(r"\bconfig\s*(?:\.|\[)", without_strings) is not None


def _find_js_string_property(source: str, key: str) -> str | None:
    pattern = re.compile(rf"\b{re.escape(key)}\s*:\s*(?P<literal>{_JS_STRING_PATTERN})")
    match = pattern.search(source)
    if match is None:
        return None
    return match.group("literal")


def _find_js_string_array_property(source: str, key: str) -> tuple[str, ...] | None:
    pattern = re.compile(rf"\b{re.escape(key)}\s*:\s*\[(?P<body>[^\]]*)\]", re.DOTALL)
    match = pattern.search(source)
    if match is None:
        return ()
    body = match.group("body")
    literals = [match.group(0) for match in _JS_STRING_RE.finditer(body)]
    remainder = _JS_STRING_RE.sub("", body)
    if remainder.replace(",", "").strip():
        return None
    args = tuple(_decode_js_string(literal) for literal in literals)
    if any(arg is None for arg in args):
        return None
    return tuple(arg for arg in args if arg is not None)


def _decode_js_string(literal: str) -> str | None:
    try:
        decoded = ast.literal_eval(literal)
    except (SyntaxError, ValueError):
        return None
    return decoded if isinstance(decoded, str) and decoded else None


__all__ = ["StaticStdioCommand", "parse_static_stdio_function"]
