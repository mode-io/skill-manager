from __future__ import annotations

from skill_manager.harness.link_operator import MutationError

from ..skills.mutations import SkillsMutationService
from .catalog import MarketplaceCatalog


class MarketplaceInstallService:
    def __init__(
        self,
        catalog: MarketplaceCatalog,
        skills_mutations: SkillsMutationService,
    ) -> None:
        self.catalog = catalog
        self.skills_mutations = skills_mutations

    def install_skill(self, install_token: str) -> dict[str, bool]:
        descriptor = self.catalog.resolve_install_token(install_token)
        if descriptor is None:
            raise MutationError("unknown marketplace install token", status=400)
        source_kind, source_locator = descriptor
        return self.skills_mutations.install_skill(source_kind=source_kind, source_locator=source_locator)
