from __future__ import annotations

import json
import os
import re
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Mapping, Protocol
from uuid import uuid4

from skill_manager.errors import MutationError


_OPENCLAW_UNSUPPORTED_REASON = "Smithery does not provide an OpenClaw MCP installer target"
_SMITHERY_CLI_PACKAGE = "@smithery/cli@4.11.1"
_ANSI_RE = re.compile(r"\x1b\[[0-9;?]*[A-Za-z]")


@dataclass(frozen=True)
class McpInstallResult:
    qualified_name: str
    source_harness: str
    installer: str
    stdout: str
    stderr: str


@dataclass(frozen=True)
class SmitheryClientTarget:
    harness: str
    smithery_client: str | None
    supported: bool
    reason: str | None = None


_SMITHERY_CLIENT_TARGETS: tuple[SmitheryClientTarget, ...] = (
    SmitheryClientTarget(harness="codex", smithery_client="codex", supported=True),
    SmitheryClientTarget(harness="claude", smithery_client="claude-code", supported=True),
    SmitheryClientTarget(harness="cursor", smithery_client="cursor", supported=True),
    SmitheryClientTarget(harness="opencode", smithery_client="opencode", supported=True),
    SmitheryClientTarget(
        harness="openclaw",
        smithery_client=None,
        supported=False,
        reason=_OPENCLAW_UNSUPPORTED_REASON,
    ),
)
_SMITHERY_TARGETS_BY_HARNESS = {target.harness: target for target in _SMITHERY_CLIENT_TARGETS}


class McpInstallProvider(Protocol):
    def install_targets(self) -> tuple[SmitheryClientTarget, ...]: ...

    def install(
        self,
        *,
        qualified_name: str,
        source_harness: str,
    ) -> McpInstallResult: ...


class SmitheryCliInstallProvider:
    def __init__(
        self,
        *,
        env: Mapping[str, str] | None = None,
        cwd: Path | None = None,
        timeout_seconds: float = 120.0,
        runner=subprocess.run,
    ) -> None:
        self._env = dict(env or {})
        self._cwd = cwd
        self._timeout_seconds = timeout_seconds
        self._runner = runner

    def install_targets(self) -> tuple[SmitheryClientTarget, ...]:
        return _SMITHERY_CLIENT_TARGETS

    def install(
        self,
        *,
        qualified_name: str,
        source_harness: str,
    ) -> McpInstallResult:
        target = _SMITHERY_TARGETS_BY_HARNESS.get(source_harness)
        if target is None or not target.supported or target.smithery_client is None:
            message = (
                target.reason
                if target and target.reason
                else f"Smithery install is not supported for source harness: {source_harness}"
            )
            raise MutationError(
                message,
                status=400,
            )

        command = [
            "npx",
            "-y",
            _SMITHERY_CLI_PACKAGE,
            "mcp",
            "add",
            qualified_name,
            "--client",
            target.smithery_client,
            "--config",
            "{}",
        ]
        env = dict(os.environ)
        env.update(self._env)
        env["NO_COLOR"] = "1"

        try:
            with tempfile.TemporaryDirectory(prefix="skill-manager-smithery-") as config_dir:
                env["SMITHERY_CONFIG_PATH"] = config_dir
                _write_noninteractive_smithery_settings(Path(env["SMITHERY_CONFIG_PATH"]))
                result = self._runner(
                    command,
                    input="",
                    text=True,
                    env=env,
                    cwd=str(self._cwd or Path(env.get("HOME", str(Path.home())))),
                    capture_output=True,
                    timeout=self._timeout_seconds,
                )
        except subprocess.TimeoutExpired as error:
            raise MutationError(
                f"Smithery install timed out after {self._timeout_seconds:.0f}s",
                status=504,
            ) from error
        except OSError as error:
            raise MutationError(f"Unable to run Smithery installer: {error}", status=502) from error

        stdout = _clean_output(getattr(result, "stdout", "") or "")
        stderr = _clean_output(getattr(result, "stderr", "") or "")
        if getattr(result, "returncode", 1) != 0:
            message = _summarize_failure(stdout, stderr) or "Smithery install failed"
            raise MutationError(message, status=502)

        return McpInstallResult(
            qualified_name=qualified_name,
            source_harness=source_harness,
            installer="smithery",
            stdout=stdout,
            stderr=stderr,
        )


def _clean_output(value: str) -> str:
    return _ANSI_RE.sub("", value).strip()


def _summarize_failure(stdout: str, stderr: str) -> str:
    combined = "\n".join(part for part in (stderr, stdout) if part)
    lines = [line.strip() for line in combined.splitlines() if line.strip()]
    if not lines:
        return ""
    return lines[-1][:500]


def _write_noninteractive_smithery_settings(config_dir: Path) -> None:
    config_dir.mkdir(parents=True, exist_ok=True)
    settings_path = config_dir / "settings.json"
    if settings_path.exists():
        return
    settings_path.write_text(
        json.dumps(
            {
                "userId": f"skill-manager-{uuid4()}",
                "analyticsConsent": False,
                "askedConsent": True,
                "cache": {"servers": {}},
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )


__all__ = [
    "McpInstallProvider",
    "McpInstallResult",
    "SmitheryCliInstallProvider",
    "SmitheryClientTarget",
]
