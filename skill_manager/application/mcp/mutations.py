from __future__ import annotations

from dataclasses import replace
from typing import Iterable

from skill_manager.errors import MutationError

from .availability import (
    AvailabilityCache,
    McpAvailabilityProbe,
    availability_cache_key,
)
from .enrichment import McpEnrichmentService
from .install_resolver import resolve_registry_server_spec
from .install_state import resolve_enable_spec
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
        source_spec = resolve_registry_server_spec(
            detail,
            allow_missing_required=True,
        )
        if self.store.get_managed(source_spec.name) is not None:
            raise MutationError(
                f"a server named '{source_spec.name}' is already installed",
                status=409,
            )

        stored = self.store.upsert_from_spec(source_spec)
        self.read_models.invalidate()
        self._availability_cache[availability_cache_key(stored.name, stored)] = (
            self.availability_probe.probe(stored)
        )
        return {"ok": True, "server": redacted_spec_dict(stored)}

    def uninstall_server(self, name: str) -> dict[str, object]:
        if self.store.get_managed(name) is None:
            raise MutationError(f"unknown server: {name}", status=404)
        bound_harnesses = self._harnesses_in_states(name, {"managed", "drifted"})
        succeeded: list[str] = []
        failures: list[dict[str, str]] = []
        for adapter in self.read_models.enabled_adapters():
            if adapter.harness not in bound_harnesses:
                continue
            try:
                adapter.disable_server(name)
                succeeded.append(adapter.harness)
            except Exception as error:  # noqa: BLE001
                failures.append({"harness": adapter.harness, "error": str(error)})
        if not failures:
            self.store.remove(name)
        if succeeded or not failures:
            self.read_models.invalidate()
        return {
            "ok": not failures,
            "succeeded": succeeded,
            "failed": failures,
        }

    # Per-harness toggle ----------------------------------------------------

    def enable_server(
        self,
        name: str,
        harness: str,
        *,
        config: dict[str, object] | None = None,
    ) -> dict[str, bool]:
        spec = self._require_server(name)
        adapter = self.read_models.require_enabled_adapter(harness)
        if adapter.has_binding(name):
            return {"ok": True}
        binding_spec = self._binding_spec_for_enable(spec, config=config)
        adapter.enable_server(binding_spec)
        if binding_spec != spec:
            self.store.upsert_from_spec(binding_spec)
        self.read_models.invalidate()
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
        spec = self._require_server(name)
        binding_spec = self._binding_spec_for_enable(spec, config=config) if target == "enabled" else spec

        bound_now = self._harnesses_in_states(name, {"managed", "drifted"})

        succeeded: list[str] = []
        failures: list[dict[str, str]] = []
        flipped_any = False

        adapters = (
            self.read_models.enabled_writable_adapters()
            if target == "enabled"
            else self.read_models.enabled_addressable_adapters()
        )
        for adapter in adapters:
            if target == "enabled" and adapter.harness in bound_now:
                continue
            if target == "disabled" and adapter.harness not in bound_now:
                continue
            try:
                if target == "enabled":
                    adapter.enable_server(binding_spec)
                else:
                    adapter.disable_server(name)
            except Exception as error:  # noqa: BLE001
                failures.append({"harness": adapter.harness, "error": str(error)})
                continue
            succeeded.append(adapter.harness)
            flipped_any = True

        if flipped_any:
            if target == "enabled" and binding_spec != spec:
                self.store.upsert_from_spec(binding_spec)
            self.read_models.invalidate()

        return {
            "ok": not failures,
            "succeeded": succeeded,
            "failed": failures,
        }

    def _binding_spec_for_enable(
        self,
        spec: McpServerSpec,
        *,
        config: dict[str, object] | None,
    ) -> McpServerSpec:
        if spec.source.kind != "marketplace":
            return spec
        detail = self._marketplace_install_detail(spec.source.locator)
        if detail is None:
            raise MutationError(f"server not found in marketplace: {spec.source.locator}", status=404)
        return resolve_enable_spec(detail, spec, config=config)

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
        current = self._require_server(name)
        if source_kind == "managed":
            source_spec = current
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
            self.store.upsert_from_spec(source_spec)
            self.read_models.invalidate()
            source_spec = self._require_server(name)
        else:
            raise MutationError("sourceKind must be 'managed' or 'harness'", status=400)

        stored = self.store.get_public_spec(name) or source_spec
        binding_spec = self.store.get_binding_spec(name) or source_spec
        succeeded, failures = self._write_spec_to_harnesses(binding_spec, target_harnesses)
        if succeeded:
            self.read_models.invalidate()
        return {
            "ok": not failures,
            "server": redacted_spec_dict(stored),
            "succeeded": succeeded,
            "failed": failures,
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
        stored = self.store.upsert_from_spec(target_spec)
        stored_binding_spec = self.store.get_binding_spec(stored.name)
        if stored_binding_spec is None:
            raise MutationError(f"unknown server: {name}", status=404)

        succeeded, failures = self._write_spec_to_harnesses(
            stored_binding_spec,
            target_harnesses,
        )

        self.read_models.invalidate()
        response_spec = self.store.get_public_spec(stored.name) or stored_binding_spec
        return {
            "ok": not failures,
            "server": redacted_spec_dict(response_spec),
            "succeeded": succeeded,
            "failed": failures,
        }

    # Internal helpers -----------------------------------------------------

    def _marketplace_install_detail(self, qualified_name: str):
        install_detail = getattr(self.marketplace, "install_detail", None)
        if callable(install_detail):
            detail = install_detail(qualified_name)
            if detail is not None:
                to_resolver_detail = getattr(detail, "to_resolver_detail", None)
                return to_resolver_detail() if callable(to_resolver_detail) else detail
        return self.marketplace.detail(qualified_name)

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
        for scan in snapshot.harness_scans:
            if scan.harness != harness:
                continue
            for entry in scan.entries:
                if entry.name != name:
                    continue
                if entry.parsed_spec is None:
                    raise MutationError(
                        entry.parse_issue or f"unable to parse '{name}' in {harness}",
                        status=409,
                    )
                return entry.parsed_spec
        raise MutationError(f"server '{name}' was not observed in harness '{harness}'", status=404)

    def _write_spec_to_harnesses(
        self,
        spec: McpServerSpec,
        harnesses: Iterable[str],
    ) -> tuple[list[str], list[dict[str, str]]]:
        targets = set(harnesses)
        succeeded: list[str] = []
        failures: list[dict[str, str]] = []
        for adapter in self.read_models.enabled_adapters():
            if adapter.harness not in targets:
                continue
            try:
                adapter.enable_server(spec)
            except Exception as error:  # noqa: BLE001
                failures.append({"harness": adapter.harness, "error": str(error)})
                continue
            succeeded.append(adapter.harness)
        return succeeded, failures

    def _require_server(self, name: str) -> McpServerSpec:
        spec = self.store.get_binding_spec(name)
        if spec is None:
            raise MutationError(f"unknown server: {name}", status=404)
        return spec

    def _managed_for_marketplace(self, qualified_name: str) -> McpServerSpec | None:
        for server in self.store.list_managed():
            if server.source.kind == "marketplace" and server.source.locator == qualified_name:
                return server
        return None


__all__ = ["McpMutationService"]
