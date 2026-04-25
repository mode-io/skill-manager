# Test Layers

Backend tests stay split by behavior:

- `tests/unit/` covers pure storage, mappers, catalog clients, codecs, and service helpers.
- `tests/integration/` covers API routes and workflow-level mutations against fake homes.
- `tests/support/` owns shared harness, filesystem, and app fixture utilities.
- `tests/fixtures/` stores representative payloads used by backend tests.

Frontend tests live beside the component, screen, or model they protect. Shared frontend render, fetch, and DTO builders live under `frontend/src/test/` so feature tests can avoid rebuilding providers and common API payloads.
