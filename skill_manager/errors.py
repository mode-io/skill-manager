from __future__ import annotations

MARKETPLACE_UNAVAILABLE_MESSAGE = (
    "Marketplace is temporarily unavailable. Check your network connection or reinstall "
    "skill-manager if the problem persists."
)


class MutationError(Exception):
    """Raised when a user-visible mutation or lookup is refused."""

    def __init__(self, message: str, status: int = 409) -> None:
        self.status = status
        super().__init__(message)


class MarketplaceUpstreamError(Exception):
    """Raised when the external marketplace cannot be reached or parsed safely."""

    status = 503

    def __init__(
        self,
        kind: str,
        url: str,
        detail: str,
        *,
        upstream_status: int | None = None,
    ) -> None:
        self.kind = kind
        self.url = url
        self.detail = detail
        self.upstream_status = upstream_status
        super().__init__(MARKETPLACE_UNAVAILABLE_MESSAGE)
