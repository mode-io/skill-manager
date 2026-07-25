# Plan: Rebuild Agents as a normal resource family

> **Status: PROPOSED (2026-07-24). Not started.**
> **Supersedes `plan-agents-packages.md` decisions 2, 4, and 6** (skill-alias pinning,
> compiled-artifact provenance, capability-degradation report) and retires Stages 2–4
> of that plan. Package-store decisions 1 and 3 in that file remain in force.

## Why

The Agents section grew a bespoke "Configuration Authority" model — agents declare
capability mappings to skills/MCPs/tools, and a compiler renders per-harness artifacts
with pinned skill revisions, provenance headers, and degradation reports. Nothing else in
the product works that way. Every other family (Skills, Slash Commands, MCP, Hooks,
Permissions) is a flat inventory with two views — **In Use** and **Needs Review** — and a
per-harness on/off matrix.

Agents should be that too. An agent is a markdown file that either is or isn't installed
in a given harness. That is the whole model.

## Decisions locked in

1. **Agents become a first-class harness family**, not a standalone service.
   `FamilyKey` (`skill_manager/harness/contracts.py:10`) gains `"agents"`, and harnesses
   that actually support subagent files declare a binding in the catalog.

2. **~~Only two harnesses get an agents column~~ — SUPERSEDED 2026-07-24.**
   This decision was wrong. It concluded from a *sitemap scan* that Cursor and Codex
   had no subagent format; both do, and Antigravity does too. See "Amendment:
   harness coverage" at the foot of this file for the corrected set and the evidence
   behind each. The original text is kept below for the record.

   Original:

   | Harness  | Global agents dir (docs form)    | Project dir         |
   |----------|----------------------------------|---------------------|
   | Claude   | `~/.claude/agents/*.md`          | `.claude/agents/`   |
   | OpenCode | `~/.config/opencode/agents/*.md` | `.opencode/agents/` |

   Resolve OpenCode as `context.xdg_config_home / "opencode" / "agents"`, matching
   `catalog.py:230` — **not** `home / ".config"`, which breaks when `XDG_CONFIG_HOME`
   is set.

   Cursor has no subagent-definition file format (rules and cloud workflows are a
   different concept). Codex, Hermes, OpenClaw, and Antigravity get no agents binding
   until someone verifies a real on-disk format. **v1 is global scope only**, matching
   how every other family behaves today.

3. **Ownership is by symlink, exactly like Skills.** The store is
   `data_dir/agents/<slug>.md`. Enabling an agent for a harness symlinks
   `<harness agents dir>/<slug>.md` → the store file; disabling removes the link (and
   refuses to delete a real file). "Is this ours?" is `link.is_symlink()` and the target
   resolves into the store — no content hashes, no sync-state file, no
   `GENERATED_MARKER`, no drift state.

   **This was verified empirically, not assumed**: a symlinked `~/.claude/agents/*.md`
   was picked up by a live headless Claude Code session and listed as an available
   subagent. If OpenCode turns out not to follow symlinks, it loses its column until it
   does — we do not reintroduce copy+hash bookkeeping for one harness.

4. **Two states per cell, never three.** A cell is `enabled` (our symlink present) or
   `disabled` (absent). Anything anomalous — a real file where our link should be, a
   dangling link, an unparseable definition — is a **Needs Review row**, not a third
   In Use state. This is the specific complexity being removed.

5. **The capability mapping is deleted outright.** Agents no longer reference skills,
   MCP servers, or tool allow/deny lists. Consequence worth stating plainly: compiled
   agents previously **inlined full `SKILL.md` bodies** into the rendered artifact
   (`service.py:_render_artifact`). Deployed agents will no longer carry skill text —
   correct, because both target harnesses resolve skills natively, but it is a real
   behavior change.

6. **~~Frontmatter shrinks to `name`, `description`, and optional `tools`~~ — AMENDED
   2026-07-24.** "Shrinks" was too strong and caused data loss: the writer re-rendered
   files from only those three fields, deleting every other key. See "Amendment:
   frontmatter is preserved, not shrunk" at the foot of this file. What survives from
   this decision is that Skill Manager *interprets* only those three, and that
   `capabilities:` / `harnesses:` are dropped on write. Original text:

   The parser
   ignores legacy `capabilities:` / `harnesses:` keys on read and drops them on write, so
   existing files (e.g. the current `red-team.md`) keep working with no migration script.

   Three places emit or rewrite that frontmatter and must shrink with it, or the
   scaffold endpoint and the authoring dialog silently diverge:
   - `skill_manager/data/templates/agent.md` — ships `capabilities:` + `harnesses:`
   - `application/scaffold.py:55-68` — string-splices `skills`/`mcps` into the template
   - `container.py:_rewrite_agent_local_prefix` (109-140) — strips `local/` prefixes from
     `capabilities.skills` / `.mcps` during the legacy move. Once those keys are gone it
     is dead code; delete it and its call at line 206, keeping the surrounding file move.

7. **Structure mirrors Hooks, semantics mirror Skills.** Hooks is the same job already
   done once (`e1c9c41` "standardize Needs Review views"): a 5-file model layer, flat
   routes, `entries[{kind: managed|unmanaged}]` API. Skills' 12-file layer with session
   provider, workspace context, and detail modal is more machinery than agents need.
   Copy Hooks' shape; use Skills as the visual and language reference.

8. **Authoring survives, trimmed.** Create / Edit / Delete for name, description, prompt,
   and optional tools stays — Skills has no authoring flow, but authoring was never the
   complexity being complained about. `CapabilityTagPicker` and `HireAgentDialog` go.

## What gets deleted vs kept

**Delete**

- `skill_manager/application/agents/service.py` — `compile`, `_compile_claude`,
  `_compile_cursor`, `_compile_codex`, `_resolve_skills`, `write_artifact`,
  `_render_artifact`, `_provenance`, `_strip_frontmatter`, `COMPILE_TARGETS`,
  `GENERATED_MARKER`
- `model.py`: `CompiledAgentArtifact`, `ResolvedSkill`, `AgentCompileError`
- `POST /api/agents/{ref}/compile` + `CompileAgentRequest/Response`,
  `ResolvedSkillResponse` in `api/schemas/agents.py`
- Frontend: `AgentsPage.tsx`, `AgentsPage.test.tsx`, `AgentCard.tsx`,
  `CapabilityTagPicker.tsx`, `HireAgentDialog.tsx`

**Keep (do not delete the module wholesale)**

- `parser.py` and `AgentDefinition` — trimmed, not replaced
- The `data_dir/agents/*.md` store location
- **The legacy migration at `container.py:158-225`** — that moves real users' on-disk
  agents out of `packages/local/agents`. Deleting it strips data. (Its
  `_rewrite_agent_local_prefix` helper goes; the file move stays — see decision 6.)
- `tests/unit/test_agents.py` — the parser tests survive; the compile/degradation tests
  are rewritten against the new model, not dropped.

## Stage 1 — Backend: family binding + demolition

Branch `feat/agents-family` off `main`.

- `contracts.py`: add `"agents"` to `FamilyKey`; add `AgentFileBindingProfile`
  (`root_path_resolver`, `output_dir_resolver`, `file_glob`, `docs_url`,
  `availability: FileTreeAvailability = "cli"`). Small and dedicated — do not overload
  `FileTreeBindingProfile` (directory-shaped, for `<slug>/SKILL.md`) or
  `CommandFileBindingProfile` (carries `invocation_prefix`, `render_format`). Both v1
  harnesses are CLI-probed so the default is correct; the field exists so the first
  GUI-only harness doesn't reach for `FileTreeBindingProfile` instead.
- `catalog.py`: agents bindings for `claude` and `opencode` only.
- **Audit every family-fanout surface** — adding a `FamilyKey` is not free. Check
  `kernel.enabled_harness_ids_for_family`, `bindings_for_family`,
  `HarnessDefinition.supports_family`, `harness/support_store.py`, and the Settings
  harness-enablement UI. A family that is silently absent from the support store reads as
  "unsupported everywhere" and the matrix renders empty.
- Delete the compile machinery; trim `AgentDefinition` to
  `slug / name / description / prompt / tools / path`.

## Stage 2 — Backend: inventory read model + mutations + API

- `application/agents/`: `store.py` (list/read/write/delete in `data_dir/agents`),
  `adapters.py` (symlink enable/disable/adopt per harness, modeled on
  `skills/adapters.py:106-133`), `inventory.py` (managed + unmanaged scan),
  `mutations.py`.
- Replace `GET /api/agents` with an inventory response shaped like Hooks/MCP/Permissions
  so the sidebar and overview code is a literal copy of the existing helpers:

  ```
  { columns: [{harness, label, logoKey, installed}],
    entries: [{ ref, name, description, kind: "managed"|"unmanaged",
                bindings: [{harness, state: "enabled"|"disabled"|"unsupported"}],
                actions: {canAdopt, canDelete} }],
    issues:  [{name, reason}] }
  ```

  Do **not** adopt Skills' `summary.managed` + `rows[].cells` shape.
- Routes, mirroring `routers/hooks.py`: `GET ""`, `GET /{ref}`, `POST ""`,
  `PUT /{ref}`, `DELETE /{ref}`, `POST /{ref}/enable`, `POST /{ref}/disable`,
  `POST /{ref}/set-harnesses`, `POST /{ref}/adopt`, `POST /adopt-all`.
- **Adopt name collision — the user resolves it, the server never guesses.** When
  `~/.claude/agents/foo.md` is a real file *and* `data_dir/agents/foo.md` already exists,
  adopt takes an explicit `onConflict` parameter:

  | `onConflict`    | Effect |
  |-----------------|--------|
  | *omitted*       | **409** with `{conflict: "store-name-exists", slug, storePath, harnessPath}`. Never acts. |
  | `"keep_store"`  | Discard the harness file, symlink it to the existing store entry. The project's version wins — this is the common case. |
  | `"replace_store"` | Move the harness file over the store entry, then symlink. The harness's version becomes the project version. |

  The 409-then-resolve shape means the client cannot accidentally destroy either side by
  omission, and both outcomes stay reachable from one button.
- **Bulk adopt never prompts N times.** `POST /adopt-all` adopts every non-conflicting
  row and returns conflicts in a `skipped[]` list for the user to resolve individually.
- Tests: parse valid/legacy/invalid frontmatter; enable creates a symlink; disable
  removes only symlinks and refuses real files; adopt moves file → store and leaves a
  symlink behind; **bare adopt on a colliding name returns 409 and mutates nothing**;
  **`keep_store` leaves store content byte-identical and replaces the harness file with a
  symlink**; **`replace_store` overwrites store content and symlinks**; bulk adopt skips
  conflicts and reports them; unmanaged detection; dangling-link → review row;
  unsupported harness column.

## Stage 3 — Frontend: In Use + Needs Review

- `features/agents/` rebuilt on the Hooks layout: `api/`, `model/`
  (`selectors.ts`, `use-agents-controller.ts`), `components/`, `screens/`,
  `i18n.ts`, and **`public.ts`** (`agentsRoutes`, `useAgentsInventoryQuery`,
  `invalidateAgentsQueries`).
- `AgentsInUsePage` — matrix with harness toggle cells, search + filter pills, matching
  `SkillsInUsePage`.
- `AgentsNeedsReviewPage` — `MatrixTable` with per-row Adopt, multi-select bulk dock, and
  Adopt-all, matching `SkillsNeedsReviewPage` / `HooksNeedsReviewPage`.
- **`AdoptConflictDialog`** — opened when adopt returns 409. Two labelled choices, not a
  bare confirm: *Keep the project version* (`keep_store`, primary) and *Use the harness
  version* (`replace_store`, danger tone), plus cancel. Shows both paths so the user can
  see what is being displaced. `ConfirmActionDialog` only supports one action — this
  needs its own component built on the same Radix `Dialog` primitives.
- Routes go **flat** — `/agents/use`, `/agents/review`, each with its own `Suspense`,
  as Hooks does. No parent-Outlet workspace page. Keep redirects from `/agents`.
- Sidebar: agents moves from a top link to a `NavGroup` with In Use / Needs Review
  children, using the existing `common.productLanguage.inUse` / `.needsReview` copy
  instead of the hardcoded `label: "Agents"` at `sidebar.ts:65`; `agentsSidebarCounts`
  is a copy of `hooksSidebarCounts` (`sidebar.ts:209`).
- `capability-registry/invalidation.ts:9` currently imports
  `features/agents/api/invalidation` directly, which the new `public.ts` fixes —
  `import-boundary.test.ts` should gain `agents` to its `FORBIDDEN` list once it does.
- `overview.ts`: add an agents card and widen the `key` union at line 62, or the overview
  counts silently disagree with the sidebar. `buildOverviewModel` gains a sixth family
  argument — **`overview.test.ts:7` calls it directly and will fail if not updated
  alongside.**

## Stage 4 — Authoring + docs

- `CreateAgentDialog` / `EditAgentDialog` trimmed to name, description, prompt, tools.
- `data/templates/agent.md` and the agent branch of `scaffold.py` shrink to match the new
  frontmatter (see decision 6); `ScaffoldRequest.skills` / `.mcps` go away.
- Delete action with confirm, mirroring `SkillDetailRemoveAction`.
- Update `README.md` and `handoff.md`; add the supersession note to the top of
  `plan-agents-packages.md` so the repo does not carry two contradictory designs.

## Validation gate (every stage, run independently before merge)

```bash
npm run typecheck
bash scripts/test_backend.sh
npm test
npm run build
```

Plus one manual pressure test per stage that touches the filesystem: enable an agent for
Claude, confirm the symlink lands in `~/.claude/agents/`, confirm a live
`claude -p` session lists it, then disable and confirm the link is gone and the store
file survives.

Git discipline per `CLAUDE.md`: short-lived branch off `main`, logical commits, no merge
to `main` without review; the running instance stays on `main`.

---

## Amendment: harness coverage (2026-07-24, post-merge)

Decision 2 above shipped a two-harness matrix (claude, opencode) built on a curated
`TARGET_ORDER` list. That was wrong twice over, and both errors are worth recording.

**Error 1 — under-researched.** Cursor and Codex were ruled out from a sitemap scan
that found no matching URL. Both have documented subagent formats. Antigravity was
never checked at all, despite `agy` being installed and having an `agy agents` command
that would have answered it in one call. The bar — "verify, don't infer" — was right;
it just wasn't applied to every harness.

**Error 2 — curated instead of derived.** A hand-maintained harness list guarantees
divergence from Skills on the next machine. Columns now come from
`enabled_harness_ids_for_family("agents")`, the same call the skills read model makes,
resolved **per request** so toggling a harness in Settings takes effect without a
restart. Which harnesses appear is a consequence of the catalog and the user's
settings, never a list someone has to remember to update.

### Evidence per harness

| Harness | Directory | Format | Evidence |
|---|---|---|---|
| claude | `~/.claude/agents/` | Markdown | **probe** — live headless session listed a symlinked agent |
| agy | `~/.gemini/antigravity-cli/agents/` | Markdown | **probe** — `agy agents` listed it; symlink followed |
| cursor | `~/.cursor/agents/` | Markdown | docs (`cursor.com/docs/subagents`); CLI not installed here, so unprobed |
| opencode | `$XDG_CONFIG_HOME/opencode/agents/` | Markdown | docs; disabled in this user's settings |
| codex | `~/.codex/agents/` | **TOML** | official docs (`developers.openai.com/codex/subagents`) |
| hermes | — | none | config inspection + docs: subagents are spawned dynamically |
| openclaw | — | none found | no agents binding declared |

### Two consequences accepted deliberately

**A generated marker is back, for Codex only.** Codex needs TOML with different keys,
so a symlinked `.md` is meaningless. Those files are rendered and marked
`# skill-manager:generated`; ownership is the marker, not `is_symlink()`. Without this,
every rendered file would return as an unmanaged Needs Review row forever and `disable`
would refuse to remove its own output. **Rendered files get no drift detection** —
re-enabling overwrites local edits. Detecting otherwise means content hashes, which is
the layer this rebuild exists to remove.

**Hermes keeps a column it can never fill.** `unavailable_reason` on the binding makes
every Hermes cell `unsupported` with the reason attached, rather than dropping the
column. Consistency with the other families beats a matrix whose columns shift per
family, and the cell explains itself instead of failing on click.

---

## Amendment: frontmatter is preserved, not shrunk (2026-07-24, post-merge)

Decision 6 said agent frontmatter "shrinks to `name`, `description`, and optional
`tools`." The implementation took that literally: `render_agent_document` built the file
from those three fields, so **every other key was deleted on the first save.** The 11
real Claude agents in this workspace carry eight more — `model`, `effort`,
`permissionMode`, `disallowedTools`, `skills`, `mcpServers`, `maxTurns`, `hooks` — and
adopting one and editing its description would have silently destroyed all of it.

The distinction the original decision missed: **interpreting a field and owning it are
different things.** Skill Manager needs to *understand* only name/description/tools. It
has no business *deleting* what it does not understand.

### Corrected behavior

- `AgentDefinition.metadata` holds the frontmatter mapping verbatim.
- `render_agent_document(..., base_metadata=...)` merges edits into the original rather
  than re-rendering, so unrecognized keys survive an edit byte-for-byte in value and in
  file order. Empty strings are quoted so `effort: ""` does not decay to null.
- The detail view lists everything except `name`/`description` under **Configuration**,
  verbatim. No per-harness whitelist exists or should be added — Cursor's `readonly` and
  Codex's `sandbox_mode` display for free, and a field a harness adds next month will
  too.
- `RETIRED_KEYS = {capabilities, harnesses}` are the sole exception: ours, dead, dropped.

### The generalizable lesson

Two data-loss bugs shipped in this rebuild, and both had the same shape: **a component
rewrote a whole artifact from the subset of fields it understood.** The edit dialog did
it with form state (opening blank and saving the blanks); the writer did it with
frontmatter. Neither was caught by tests, because both round-tripped perfectly through
the fields the tests knew about. When writing back a user-authored file, the test that
matters is "read a realistic file, write it, diff the parts you never touched."
