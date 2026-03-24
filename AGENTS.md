# Skill Manager Repo Guide

This repo is an incubating managed project for the Universal Skill Manager.

While `skill-manager/` lives inside `/Users/siruizhang/Desktop/ModeIOSkill`, the root workflow rules still apply for task tracking, worktree management, and local-repo coordination. This file adds the project-local rules that should move with the repo if it is later promoted to a standalone Mode.io GitHub repository.

## Session Start

1. Read `/Users/siruizhang/Desktop/ModeIOSkill/AGENTS.md` for the root workflow rules.
2. Read this file.
3. Read `design.md`.
4. Read `current-focus.md` before implementation work.
5. If working inside `.worktrees/skillmgr--*`, read `.worktree-context.md` first.
6. If the task includes frontend or visual design, also read `/Users/siruizhang/Desktop/ModeIOSkill/FRONTEND_DESIGN_GUIDE.md`.

## Workflow

- Treat `skill-manager/` main checkout as the read-only reference hub after bootstrap.
- Do active development in `.worktrees/skillmgr--*`.
- Keep product code and product docs inside this repo only.
- Do not create `TASKS.md`, `WORKSPACES.md`, `DEPENDENCIES.md`, `STATES.md`, or `CLAUDE.md` in this repo.
- `AGENTS.md` is intentionally tracked here as the project-local operating guide.

## Product Direction

- This project is a frontend-first local app for universal skill management across multiple agent harnesses.
- The CLI is a launcher, not the primary product surface.
- The browser UI is the primary product surface.
- The application layer owns orchestration.
- Harness-specific behavior belongs in adapters.
- `design.md` is the current conceptual source of truth.
- `current-focus.md` is the current execution-focus and validation source of truth.

## Scaffolding Status

- The current repo name and current design are both provisional.
- Treat the current files as bootstrap scaffolding, not a frozen implementation contract.
- When the design changes materially, update `design.md` first and then align the code to it.
- When active priorities, validation expectations, or execution focus change materially, update `current-focus.md`.
