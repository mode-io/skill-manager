# Plan: Packages & Agents (revised from RFC)

> **Status: SHIPPED 2026-07-13.** All four stages landed on `main` the same day:
> Stage 1 `343fb9d`, Stage 2 `5f8f808`, Stage 3 `dec09ae`, Stage 4 `076641a`.
> Deferred follow-ups are tracked in `handoff.md`. This file remains the design of
> record for the decisions below.
> 
> **Note: Decisions 2, 4, and 6 and Stages 2-4 are superseded by `plan-agents-simplify.md` (2026-07-24)**.

Revised execution plan for the "Agents & Packages" RFC, incorporating the architectural
review of 2026-07-13. Goal: finish and test all stages today, credits permitting.
`handoff.md` tracks live status; this file is the design of record.

## Decisions locked in (amendments to the RFC)

1. **Packages are a migration of the existing store, not a parallel system.** The legacy
   `data_dir/shared` + `manifest.json` skill store becomes `packages/local/`. One resolution
   path only — no stage ships while both paths are live.
2. **Identity:** `SkillRef` stable hashes remain the primary key everywhere. The RFC's
   `<package-slug>/<resource-slug>` form is a human-readable *alias*, resolved at compile
   time and **pinned** (compiled artifacts record the resolved ref + content fingerprint).
   Slug collisions across active packages are surfaced as needs-review issues, never
   silently resolved.
3. **Package metadata:** each package dir carries `package.json` (`slug`, `name`,
   `version`, `mutable`, `active`) *alongside* the existing per-family `manifest.json`
   format (metadata and resource provenance stay separate files; minimizes manifest-code churn).
   `version` exists from day one so dependencies stay possible later without a format break.
4. **Compiled artifacts carry provenance.** Every "hire" render embeds a header comment:
   source agent ref + content hash. Enables regeneration, clean removal, and drift
   detection (generalizing the existing "local changes detected" pattern).
5. **Never overwrite user-owned files.** Cursor gets `.cursor/rules/skill-manager.<agent>.mdc`
   (a dedicated generated file), never `.cursorrules`. Same principle per harness.
6. **Capability-degradation report.** Compile output lists every constraint that was
   dropped or is advisory-only in the target harness (esp. tool deny-lists — these must be
   labeled *enforced* vs *advisory* per harness, never silently assumed).
7. **No hardcoded model IDs in templates.** Model is a harness-level default with optional
   per-agent override. (The RFC's `claude-3-opus-20240229` / `gpt-4o` examples are stale.)
8. **Cut from v1:** cross-harness delegation runtime, package-to-package dependencies,
   marketplace distribution of packages. The Configuration Authority story (define →
   compile → hire) ships alone.

## Stage 0 — Scaffolding (DONE, committed)

`64d08b2` + `898af8b`: global asset templates (`data/templates/`), `POST /api/scaffold`,
`ScaffoldService` writing into the **legacy** store paths (skills as `<slug>/SKILL.md`
under `skills_store_root`) so nothing orphaned exists ahead of the migration.

## Stage 1 — Package store foundation + migration  → **delegated to agy**

Branch `feat/package-store` off `main`.

- `AppPaths`: add `packages_root = data_dir / "packages"`; repoint
  `skills_store_root` → `packages/local/skills`, `skills_store_manifest` →
  `packages/local/manifest.json`.
- One-time idempotent migration on container build: if legacy `shared/` exists and
  `packages/local/` doesn't → move `shared/` → `packages/local/skills/`,
  `manifest.json` → `packages/local/manifest.json`, write `package.json`
  (`slug: local, name: Local, version: 1, mutable: true, active: true`).
- `SkillStore` scan iterates **all** package dirs under `packages_root` honoring
  `active`; observations carry the owning package slug; duplicate `SkillRef` across
  packages → local wins + integrity issue.
- Immutability enforced in the mutations layer (`mutable: false` → 400 from API).
- Scaffold service follows the repointed paths automatically.
- Tests: fresh migration, idempotence, no-legacy case, multi-package scan, inactive
  package excluded, immutable mutation rejected, full existing suites green.

## Stage 2 — Agents as a resource family  → **me (contracts) + agy (plumbing)**

Branch `feat/agents-family` off `main` (after Stage 1 merges).

- New `FamilyKey` `"agents"` in `skill_manager/harness/contracts.py`; agent definitions
  are `agents/<slug>.md` in a package (frontmatter per RFC, minus hardcoded models).
- Parser + store observations + inventory read model + API router (mirror the skills
  family shape: page response with harness columns/cells).
- **Compile to Claude Code first**: render to `~/.claude/agents/<slug>.md` via a
  file-tree binding profile, provenance header per decision 4, skill aliases resolved
  and pinned per decision 2.
- Tests: parse (valid/invalid frontmatter), alias resolution incl. collision, compile
  output golden-file, drift detection.

## Stage 3 — Multi-harness compile + degradation report  → **me**

Same branch or `feat/agent-compile-targets`.

- Cursor (`.cursor/rules/skill-manager.<agent>.mdc`) and Codex compile targets.
- Per-harness capability support matrix; compile result returns the degradation report
  (decision 6); `dry_run` flag on the compile endpoint returning the artifact preview.

## Stage 4 — UI (agents-first)  → **agy**

Branch `feat/agents-ui`.

- Agents workspace page: agent cards, harness matrix (reuse `Matrix*` components),
  Hire flow with harness picker + degradation report + dry-run preview.
- Packages surface as an inventory/management view (Settings or sidebar), not the
  primary navigation.

## Validation gate (every stage, run independently before merge)

```bash
npm run typecheck
bash scripts/test_backend.sh
npm test
npm run build
```

Git discipline per `CLAUDE.md`: short-lived branch off `main`, logical commits, no merge
to `main` without review; the running instance stays on `main`.
