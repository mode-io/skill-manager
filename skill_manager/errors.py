from __future__ import annotations


class MutationError(Exception):
    """Raised when a user-visible mutation or lookup is refused."""

    def __init__(self, message: str, status: int = 409) -> None:
        self.status = status
        super().__init__(message)
