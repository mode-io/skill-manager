#!/bin/sh
export DELEGATE_LABEL="agy-perms-hooks"
exec 'agy' '-i' 'SPEC: Make Matrix the only In-use view for Permissions + Hooks

1. OBJECTIVE
Remove the Cards/Board view options from the Permissions In-use page and the Hooks In-use page
so the Matrix view is the sole, always-rendered view. Delete the now-dead code.

2. CONTEXT
- Repo root = your worktree CWD (a git worktree off `main`). All paths below are relative to it.
- You own ONLY these two features: `frontend/src/features/permissions/**` and
  `frontend/src/features/hooks/**`. Do NOT touch any other feature, `components/`, `lib/`, or
  the Python backend.
- The Matrix components ALREADY EXIST and must be kept:
  `frontend/src/features/permissions/components/PermissionsMatrixView.tsx`
  `frontend/src/features/hooks/components/HooksMatrixView.tsx`
- Shared files you must NOT delete or edit (the orchestrator removes them later, after all
  branches merge): `frontend/src/components/ViewModeToggle.tsx`,
  `frontend/src/lib/usePersistentViewMode.ts`.
- node_modules is symlinked into `frontend/node_modules` for you; npm commands work from repo root.

Files that carry the view toggle today:
  Permissions page: frontend/src/features/permissions/screens/PermissionsInUsePage.tsx
              hook: frontend/src/features/permissions/model/usePermissionsInUseViewMode.ts (DELETE)
              dead: frontend/src/features/permissions/components/PermissionCardList.tsx (DELETE)
                    + any component/i18n/test used ONLY by it
  Hooks page:  frontend/src/features/hooks/screens/HooksInUsePage.tsx
              hook: frontend/src/features/hooks/model/useHooksInUseViewMode.ts (DELETE)
              dead: frontend/src/features/hooks/components/HookCardList.tsx (DELETE)
                    frontend/src/features/hooks/components/board/HooksBoard.tsx (DELETE whole board/ dir)
                    + any component/i18n/test used ONLY by those

Per page, do exactly this:
  a. Remove the <ViewModeToggle> render, the `viewModeOptions` array, the `useXViewMode()`
     call, and all `viewMode === ...` branching. Render the Matrix component unconditionally
     wherever rows exist (keep the loading / error / empty-state branches intact).
  b. KEEP all search + filter UI (FilterBar, any filter/pill menu) — those are NOT view modes.
     If a filter was gated behind `viewMode === "cards"`, make it always shown.
  c. Delete the dead view components listed above and any files (subcomponents, tests, i18n
     `viewModes`/`viewModeAria` keys, unused lucide icon imports like Columns3/Grid2X2) that
     become unreferenced as a result. No dead code, no unused imports may remain.
  d. Delete the section'\''s `useXViewMode.ts` hook file and its test if present.

3. DEFINITION OF DONE (I will run these exact checks myself in your worktree)
- `grep -rn "ViewModeToggle" frontend/src/features/permissions frontend/src/features/hooks` → NO output
- `grep -rn "usePermissionsInUseViewMode\|useHooksInUseViewMode\|PermissionsInUseViewMode\|HooksInUseViewMode" frontend/src` → NO output
- `grep -rn "PermissionCardList\|HookCardList\|HooksBoard" frontend/src` → NO output
- `git status` shows the useXViewMode hooks and the dead components as deleted.
- `npm run typecheck` exits 0
- `npm test` passes (update/remove tests that referenced removed views; do NOT weaken unrelated tests)
- `npm run build` exits 0
- Manual read: PermissionsInUsePage.tsx and HooksInUsePage.tsx render only the Matrix view; search/filter UI preserved.

4. ESCALATION — stop and ask me (via reverse channel) instead of guessing if:
- Removing a view forces changing shared/global files outside your two features.
- A matrix component is missing an affordance the deleted card/board had and it'\''s unclear where it should live.
- A test failure implies a behavior change you'\''re unsure is intended.
- The real change is materially bigger than this spec implies.

5. REVERSE CHANNEL — to reach me, run ONE command from your worktree:
   ./.delegate/notify needs-input "the question or decision you need answered"
   ./.delegate/notify blocked     "what you are stuck on"
   ./.delegate/notify done        "summary of what you finished"
  then STOP AND WAIT at your prompt — do not exit, do not continue. I will review and either
  confirm or send corrections. After I reply, run `./.delegate/notify resume` before continuing.

6. OUTPUT — on finish: run `./.delegate/notify done "<summary>"`, then STOP AND WAIT. Do not exit.

7. SCOPE BOUNDARY — stay in your worktree; touch only features/permissions and features/hooks
   (plus their tests). Do NOT edit ViewModeToggle.tsx / usePersistentViewMode.ts / other features /
   backend. Do NOT push, open PRs, or run any git merge. Make small logical commits on your branch.' '--add-dir' '/Users/hgill/projects/skill-manager-worktrees/agy-perms-hooks' '--dangerously-skip-permissions' '--model' 'gemini-3.1-pro-high'
