"""Bootstrap package for the skill-manager local app."""

from pathlib import Path

__all__ = ["__version__"]

__version__ = (Path(__file__).with_name("VERSION").read_text(encoding="utf-8").strip())
