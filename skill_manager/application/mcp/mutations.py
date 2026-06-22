from __future__ import annotations

from dataclasses import replace
from typing import Iterable

from skill_manager.errors import MutationError

from .availability import (
    AvailabilityCache,
    McpAvailabilityProbe,
    availability_cache_key,
)
from .config_choice import observed_spec_from_scans
from .enrichment import McpEnrichmentService
from .harness_application import McpHarnessApplication
from .install_intent import ManagedMcpRecord, registry_record_from_detail
from .install_state import resolve_enable_managed_spec
from .marketplace.catalog import McpMarketplaceCatalog
from .planner import McpAdoptionPlanner
from .read_models import McpReadModelService
from .redaction import redacted_spec_dict
from .store import McpServerSpec, McpServerStore, McpSource


class McpMutationService:
    """Mutations for observed MCP configs.

    The managed manifest stores the canonical observed config. Harness files are
    projections of that canonical spec.
    """

    def __init__(
        self,
        *,
        store: McpServerStore,
        read_models: McpReadModelService,
        planner: McpAdoptionPlanner,
        marketplace_catalog: McpMarketplaceCatalog,
        enrichment: McpEnrichmentService | None = None,
        availability_probe: McpAvailabilityProbe | None = None,
        availability_cache: AvailabilityCache | None = None,
    ) -> None:
        self.store = store
        self.read_models = read_models
        self.planner = planner
        self.marketplace = marketplace_catalog
        self.enrichment = enrichment
        self.availability_probe = availability_probe or McpAvailabilityProbe()
        self._availability_cache = availability_cache if availability_cache is not None else {}
        self.harness_application = McpHarnessApplication(read_models)

    # Install / uninstall ---------------------------------------------------

    def install_from_marketplace(
        self,
        qualified_name: str,
    ) -> dict[str, object]:
        if not qualified_name:
            raise MutationError("qualifiedName is required", status=400)

        existing = self._managed_for_marketplace(qualified_name)
        if existing is not None:
            raise MutationError(
                f"a server named '{existing.name}' is already installed",
                status=409,
            )
        detail = self._marketplace_install_detail(qualified_name)
        if detail is None:
            raise MutationError(f"server not found in marketplace: {qualified_name}", status=404)
        source_record = registry_record_from_detail(
            detail,
            allow_missing_required=True,
        )
        if self.store.get_managed(source_record.spec.name) is not None:
            raise MutationError(
                f"a server named '{source_record.spec.name}' is already installed",
                status=409,
            )

        stored_record = self.store.upsert_record(source_record)
        stored = stored_record.spec
        self.read_models.invalidate()
        self._availability_cache[availability_cache_key(stored.name, stored)] = (
            self.availability_probe.probe(stored)
        )
        return {"ok": True, "server": redacted_spec_dict(stored)}

    def uninstall_server(self, name: str) -> dict[str, object]:
        if self.store.get_managed(name) is None:
            raise MutationError(f"unknown server: {name}", status=404)
        bound_harnesses = self._harnesses_in_states(name, {"managed", "drifted"})
        return self.harness_application.disable_many(
            name,
            bound_harnesses,
            remove_after_full_success=lambda: self.store.remove(name),
        ).to_dict()

    # Per-harness toggle ----------------------------------------------------

    def enable_server(
        self,
        name: str,
        harness: str,
        *,
        config: dict[str, object] | None = None,
    ) -> dict[str, bool]:
        record = self._require_record(name)
        adapter = self.read_models.require_enabled_adapter(harness)
        if adapter.has_binding(name):
            return {"ok": True}
        binding_record = self._record_for_enable(record, config=config)
        result = self.harness_application.enable_one(
            adapter,
            binding_record.spec,
            commit=(lambda: self.store.upsert_record(binding_record)) if binding_record != record else None,
        )
        if result.failed:
            raise MutationError(result.failed[0]["error"], status=400)
        return {"ok": True}

    def disable_server(self, name: str, harness: str) -> dict[str, bool]:
        if self.store.get_managed(name) is None:
            raise MutationError(f"unknown server: {name}", status=404)
        adapter = self.read_models.require_enabled_adapter(harness)
        adapter.disable_server(name)
        self.read_models.invalidate()
        return {"ok": True}

    def set_server_all_harnesses(
        self,
        name: str,
        target: str,
        *,
        config: dict[str, object] | None = None,
    ) -> dict[str, object]:
        if target not in ("enabled", "disabled"):
            raise MutationError("target must be 'enabled' or 'disabled'", status=400)
        record = self._require_record(name)
        binding_record = self._record_for_enable(record, config=config) if target == "enabled" else record

        bound_now = self._harnesses_in_states(name, {"managed", "drifted"})
        if target == "enabled":
            return self.harness_application.enable_many(
                binding_record.spec,
                self.read_models.enabled_harnesses(),
                writable_only=True,
                skip_harnesses=bound_now,
                commit=(lambda: self.store.upsert_record(binding_record)) if binding_record != record else None,
            ).to_dict()
        return self.harness_application.disable_many(
            name,
            bound_now,
            addressable_only=True,
        ).to_dict()

    def _record_for_enable(
        self,
        record: ManagedMcpRecord,
        *,
        config: dict[str, object] | None,
    ) -> ManagedMcpRecord:
        if record.spec.source.kind != "marketplace":
            return record
        if config is None:
            detail = self._marketplace_cached_install_detail(record.spec.source.locator)
            if detail is None:
                if record.install_intent is not None:
                    detail = self._marketplace_install_detail(record.spec.source.locator)
                    if detail is None:
                        raise MutationError(
                            f"server not found in marketplace: {record.spec.source.locator}",
                            status=404,
                        )
                    return resolve_enable_managed_spec(detail, record, config=config)
                return record
            return resolve_enable_managed_spec(detail, record, config=config)
        detail = self._marketplace_install_detail(record.spec.source.locator)
        if detail is None:
            raise MutationError(f"server not found in marketplace: {record.spec.source.locator}", status=404)
        return resolve_enable_managed_spec(detail, record, config=config)

    # Reconciliation -------------------------------------------------------

    def reconcile_server(
        self,
        name: str,
        *,
        source_kind: str,
        observed_harness: str | None = None,
        harnesses: list[str] | None = None,
    ) -> dict[str, object]:
        if self.store.get_managed(name) is None:
            raise MutationError(f"unknown server: {name}", status=404)
        target_harnesses = (
            set(harnesses)
            if harnesses is not None
            else self._harnesses_in_states(name, {"managed", "drifted"}, addressable_only=True)
        )
        current_record = self._require_record(name)
        current = current_record.spec
        if source_kind == "managed":
            source_record = current_record
        elif source_kind == "harness":
            if not observed_harness:
                raise MutationError("observedHarness is required when sourceKind is 'harness'", status=400)
            observed_spec = self._observed_spec(name, observed_harness)
            source_spec = replace(
                observed_spec,
                name=current.name,
                display_name=current.display_name,
                source=current.source,
            )
            source_record = ManagedMcpRecord(spec=source_spec)
        else:
            raise MutationError("sourceKind must be 'managed' or 'harness'", status=400)

        result = self.harness_application.enable_many(
            source_record.spec,
            target_harnesses,
            commit=(lambda: self.store.upsert_record(source_record)) if source_record != current_record else None,
        )
        stored = self.store.get_public_spec(name) or source_record.spec
        return {
            "ok": result.ok,
            "server": redacted_spec_dict(stored),
            "succeeded": result.succeeded,
            "failed": result.failed,
        }

    # Adoption -------------------------------------------------------------

    def _apply_enrichment(self, spec: McpServerSpec) -> McpServerSpec:
        if self.enrichment is None:
            return spec
        link = self.enrichment.lookup(spec.name)
        if link is None:
            return spec
        return replace(
            spec,
            display_name=link.display_name or spec.display_name,
            source=McpSource.marketplace(link.qualified_name),
        )

    def adopt(
        self,
        name: str,
        *,
        observed_harness: str | None = None,
        harnesses: list[str] | None = None,
    ) -> dict[str, object]:
        if self.store.get_managed(name) is not None:
            raise MutationError(
                f"a managed server named '{name}' already exists", status=409
            )
        group = self.planner.require_group(name)
        if observed_harness:
            target_spec = next(
                (sighting.spec for sighting in group.sightings if sighting.harness == observed_harness),
                None,
            )
            if target_spec is None:
                raise MutationError(
                    f"server '{name}' was not observed in harness '{observed_harness}'",
                    status=400,
                )
        else:
            target_spec = group.canonical_spec
        if target_spec is None:
            raise MutationError(
                f"server '{name}' has different configs across harnesses; choose an observedHarness to adopt",
                status=409,
            )
        if target_spec.name != name:
            target_spec = replace(target_spec, name=name)
        target_spec = self._apply_enrichment(target_spec)

        target_harnesses = set(harnesses) if harnesses else {s.harness for s in group.sightings}
        target_record = ManagedMcpRecord(spec=target_spec)
        result = self.harness_application.enable_many(
            target_record.spec,
            target_harnesses,
            commit=lambda: self.store.upsert_record(target_record),
        )

        response_spec = self.store.get_public_spec(target_spec.name) or target_spec
        return {
            "ok": result.ok,
            "server": redacted_spec_dict(response_spec),
            "succeeded": result.succeeded,
            "failed": result.failed,
        }

    # Internal helpers -----------------------------------------------------

    def _marketplace_install_detail(self, qualified_name: str):
        cached_detail = self._marketplace_cached_install_detail(qualified_name)
        if cached_detail is not None:
            return cached_detail
        install_detail = getattr(self.marketplace, "install_detail", None)
        if callable(install_detail):
            detail = install_detail(qualified_name)
            if detail is not None:
                to_resolver_detail = getattr(detail, "to_resolver_detail", None)
                return to_resolver_detail() if callable(to_resolver_detail) else detail
        return self.marketplace.detail(qualified_name)

    def _marketplace_cached_install_detail(self, qualified_name: str):
        cached_install_detail = getattr(self.marketplace, "cached_install_detail", None)
        if not callable(cached_install_detail):
            return None
        try:
            detail = cached_install_detail(qualified_name)
        except Exception:
            return None
        if detail is None:
            return None
        to_resolver_detail = getattr(detail, "to_resolver_detail", None)
        return to_resolver_detail() if callable(to_resolver_detail) else detail

    def _harnesses_in_states(
        self,
        name: str,
        states: Iterable[str],
        *,
        addressable_only: bool = False,
    ) -> set[str]:
        allowed_states = set(states)
        addressable = (
            {adapter.harness for adapter in self.read_models.enabled_addressable_adapters()}
            if addressable_only
            else set(self.read_models.enabled_harnesses())
        )
        snapshot = self.read_models.snapshot()
        result: set[str] = set()
        for scan in snapshot.harness_scans:
            if scan.harness not in addressable:
                continue
            for entry in scan.entries:
                if entry.name == name and entry.state in allowed_states:
                    result.add(scan.harness)
        return result

    def _observed_spec(self, name: str, harness: str) -> McpServerSpec:
        snapshot = self.read_models.snapshot()
        return observed_spec_from_scans(name, harness, snapshot.harness_scans)

    def _require_server(self, name: str) -> McpServerSpec:
        spec = self.store.get_binding_spec(name)
        if spec is None:
            raise MutationError(f"unknown server: {name}", status=404)
        return spec

    def _require_record(self, name: str) -> ManagedMcpRecord:
        record = self.store.get_record(name)
        if record is None:
            raise MutationError(f"unknown server: {name}", status=404)
        return record

    def _managed_for_marketplace(self, qualified_name: str) -> McpServerSpec | None:
        for server in self.store.list_managed():
            if server.source.kind == "marketplace" and server.source.locator == qualified_name:
                return server
        return None


__all__ = ["McpMutationService"]
