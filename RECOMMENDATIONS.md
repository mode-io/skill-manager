# Recommendations

> Review of 2026-07-25, refreshed against `main` after the Tier-1 batch. Verified by running the
> suites: backend unit (385) + integration (155) tests pass, `npm run typecheck` clean, `npm test`
> green (263), `ruff check` clean, OpenAPI drift gate clean.
> Ordered by value: each tier outranks the next. Within a tier, items are ordered by
> value-for-effort. Effort scale: **S** < 1 hour, **M** hours–a day, **L** multi-day.
>
> **This list is kept to open items only — shipped work is removed.** Shipped batches:
> 2026-07-24 merge `98c3417` (audit gates, loopback guards, static-root containment, dead-code pass);
> 2026-07-25 Tier-1 batch (Dependabot + SHA-pinned actions; golden writer round-trip tests; ruff lint
> gate; Hermes slash provisional label) — see `handoff.md` for the record. Partially-shipped items
> below keep their number and describe only the remaining scope.

## Already strong — don't churn these

- Atomic writes + `flock` for file mutations (`skill_manager/atomic_files.py`), with a dedicated
  store-concurrency test.
- OpenAPI contract discipline: generated TS client committed, `codegen:check` drift gate in CI.
- One canonical harness catalog (`skill_manager/harness/catalog.py`) that drives every family.
- Subprocess calls are all list-form (no `shell=True`); marketplace fetchers use a pinned CA
  context with TLS fixtures under test.
- CI matrix across Python 3.11–3.14 plus a full packaging smoke on four OS/arch targets.
- Ruff lint gate in CI (`[tool.ruff]` in `pyproject.toml`): import sorting + pyflakes enforced
  and baselined green; `requirements-dev.txt` pins the tool.

---

## Tier 1 — High value, moderate effort

### 1.1 Harden the writers so unknown user fields survive a round-trip — M

**Shipped (2026-07-25):** `tests/unit/test_writer_round_trip.py` codifies the test the retrospective
in `plan-agents-simplify.md` calls for — for every writer of a user-authored file (slash frontmatter
codec, every MCP transport mapper) it pins idempotency, owned-field preservation, and a
*characterization* of the unknown keys/comments currently dropped. The data-loss surface is now
visible and locked.

**Remaining:** the characterization tests today assert that unknown frontmatter keys/comments and
unknown MCP entry fields (e.g. `disabled`, `autoApprove`) are *dropped* — the writers still destroy
what they do not model. Flip those to preservation assertions: have
`FrontmatterMarkdownCommandCodec` carry unknown frontmatter verbatim and `McpServerSpec` carry
per-entry extras, so re-writing a realistic file leaves untouched regions byte-identical (OpenCode's
force-`enabled=True` is the clearest live example). Consider `hypothesis` for frontmatter/JSON
round-trip properties once preservation lands.

### 1.2 Finish static-analysis adoption (type-check + frontend lint + baseline cleanup) — M

**Shipped (2026-07-25):** ruff is the backend lint gate — `[tool.ruff]` in `pyproject.toml`,
`requirements-dev.txt`, and a "Backend lint" CI step. Import sorting (I) is enforced and applied
across the tree; pyflakes (F) is enforced with `F401`/`F821`/`F841` baselined (the baseline is
documented in-config and meant to shrink).

**Remaining:** (a) chip the ruff baseline — drop `F401` by removing the 29 unused imports in a
verified per-module pass (a blanket `--fix` rewrote import paths and broke test collection, so this
needs care), then broaden `select` toward `E`/`W`/`UP`/`B`; (b) add `pyright` (or `mypy`) with a
committed config + CI step, starting from `basic`; (c) add ESLint (typescript + react-hooks) for
`frontend/src`. The fifteen `# noqa: BLE001` comments are the existing half-adoption this completes.


### 1.3 Finish labeling (or verify) the Hermes harness — M

**Shipped (2026-07-25):** the Hermes **slash** binding now carries a provisional `support_note`
("…unverified against a real Hermes install; writes may not take effect…") in
`harness/catalog.py`, surfaced to the UI via the existing `SlashTarget.supportNote` path. The agents
binding was already labeled unavailable (no agent-definition format).

**Remaining:** MCP and hooks are still written on unverified assumptions with no provisional label.
Thread a `support_note` through `ConfigSubtreeBindingProfile` → the MCP/hooks read models (typed,
so it needs an OpenAPI regen) and mark both provisional, **or** validate against a real Hermes
build and record the evidence in `handoff.md` (as was done for Claude/agy agent symlinks). With
seven more harnesses on the README roadmap, define a repeatable "new harness verification" checklist
(probe CLI, real read, real write, round-trip diff) and reuse it per harness.

---

## Tier 2 — Strategic investments

### 2.1 A mutation audit journal — M–L

A tool whose job is mutating local config has almost no observability: a `grep -rn 'logging'`
over `skill_manager/` now returns **zero** hits (the last holdout, `db/migrations.py`, was removed
in `9f23101`), and uvicorn runs with `access_log=False`. When something goes wrong in a
user's setup — or a user asks "what did Skill Manager change?" — there is no answer on disk.

**Action:** append a structured record (JSON Lines) to
`${XDG_DATA_HOME}/skill-manager/audit.log` for every mutation: timestamp, family, operation,
target paths, outcome. This doubles as product surface later (an activity view) and strengthens
the trust story that "Needs Review" already builds.

### 2.2 Coverage measurement with a ratchet — S–M

385 backend unit tests, 155 integration tests, and 62 frontend test files (263 tests) exist, but nothing measures what they cover, so
gaps are invisible (e.g. the two data-loss bugs in §1.1 lived in well-tested-looking code).

**Action:** add `coverage.py` to `scripts/test_backend.sh` and `vitest --coverage` to CI; report
per-package coverage and ratchet the threshold (fail if it drops). The point is trend, not a
vanity number.

### 2.3 Document the family/harness template; then decide on extraction — M

Each family (skills, MCP, hooks, permissions, agents, slash commands) re-implements the same
octet: store / mappers / adapters / inventory / mutations / queries / read_models / harness
application — e.g. `hooks/mappers.py` is 897 lines, `permissions/mappers.py` 683. The mirroring
is deliberate and has real benefits (families evolve independently), but the *knowledge* of what
a conforming family needs exists only in the plans and handoffs.

**Action:** write `docs/adding-a-family.md` + `docs/adding-a-harness.md` checklists (the harness
one pairs with §1.3's verification checklist). Only after that, evaluate extracting a shared
"family framework" for the truly invariant parts (manifest store, matrix read model) — with the
checklist as the spec it must satisfy. Do not extract first: the agents rebuild shows the cost of
a bespoke abstraction that had to be torn out.

### 2.4 Machine-readable API error codes — S–M

Every error is `{"error": "<human string>"}` (`api/errors.py`), so the frontend can only branch
on message text — brittle under rewording and under i18n (several features already have `i18n.ts`
modules).

**Action:** add a stable `code` field (`"skill_not_found"`, `"harness_unavailable"`, …) alongside
`error`; adopt incrementally in the frontend where behavior branches on errors today.

---

## Tier 3 — Housekeeping (low priority, cheap when touched next)

- **Root doc sprawl.** `handoff.md` (21 KB), two `plan-agents-*.md`, and this file sit beside a
  22 KB README. Move plans/handoffs under `docs/` (keeping the handoff discipline that clearly
  works) and leave a pointer at the root. — **S**
- **Windows is architecturally excluded, not just unsupported.** `atomic_files.py` imports
  `fcntl` at module top level, so the package doesn't even *import* on Windows. Fine while the
  README badges say macOS/Linux — just gate the import so "Windows support" later is a port of
  one module, not an archaeology dig. — **S**
- **`choose_port` / `bind_socket` TOCTOU race** (`runtime/server.py:32-49`): probe-bind, close,
  re-bind. Two quick starts can collide between the probes. Bind once and keep the socket (the
  code already passes `fd` to uvicorn, so this is mostly deleting the probe). — **S**
- **Clean local scratch from the repo dir.** Stale `test_scan_*.pyc` and `.pytest_cache` linger
  in the working tree (untracked, but confusing); and the `skill_manager/db/` directory now
  contains **only** stale `__pycache__/*.pyc` — its source was removed in `9f23101` but the
  compiled cache and the empty package dir were left behind. The project standardizes on
  `unittest`, so either document pytest compatibility or remove the cache dirs / orphaned
  `db/` package. — **S**

---

## Suggested sequencing

1. **Tier-1 batch shipped 2026-07-25** (1.4 Dependabot + SHA pinning; 1.1 golden round-trip tests;
   1.2 ruff gate; 1.3 Hermes slash label). **Next (all S/M):** finish the partials in value order —
   1.1 harden the writers to preserve unknown fields, 1.2 add pyright + ESLint + chip the ruff
   baseline, 1.3 label/verify Hermes MCP & hooks.
2. **When planning the next family or harness:** 2.3 first, 2.1 alongside, 2.2 to keep it honest.
3. **Tier 3 housekeeping** rides along whenever its files are touched next.

