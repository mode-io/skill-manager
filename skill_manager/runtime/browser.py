from __future__ import annotations

import webbrowser


def maybe_open_browser(url: str, *, enabled: bool) -> None:
    if enabled:
        webbrowser.open(url)
