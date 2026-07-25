# skill-manager — working agreement

This is **our fork** of skill-manager. Read this before doing any git or delegation work.

## Remotes

- `fork` → `execsumo/skill-manager` — **ours**. This is where we develop and ship.
- `origin` → `mode-io/skill-manager` — **upstream**. Contributing back is optional.

## Branch strategy — fork `main` is the cumulative trunk

`fork/main` is the single line where everything accumulates. It only grows; it always
contains every shipped feature (agy harness, light mode, hooks, …). **Run the app off `main`.**

- New work = a **short-lived** branch off `main` → merge **back into `main`** when done → delete the branch.
- Do **not** keep long-lived feature branches. They drift from `main` and from the running
  instance (this is how light mode "disappeared" once — the checkout was parked on a side branch).
- Commit/push to `main` or a short-lived feature branch. Never develop on a throwaway extract branch.
- Land features into `main` promptly so there is nothing to "keep cumulative" — it just is.

## Contributing upstream (mode-io) — opt-in and isolated

**Default: don't.** The fork is a complete product on its own. Only extract an upstream PR when
there is a real reason (you want mode-io to maintain/ship it). It is occasional, not per-feature.

When you do, **never switch this checkout to an upstream-extract branch** — that strips fork-only
features (light mode, etc.) and breaks the running instance. Do it in a separate worktree so the
main checkout never moves:

```bash
git worktree add ../skill-manager-upstream origin/main
cd ../skill-manager-upstream
git cherry-pick <only the commits upstream should get>   # keep it a clean subset
git push fork <extract-branch>
gh pr create --repo mode-io/skill-manager --base main --head execsumo:<extract-branch>
cd - && git worktree remove ../skill-manager-upstream
```

Keep the upstream PR a focused subset; do not bundle unrelated fork features into it.

## Running the app

Serve/run from `main`. After switching branches or building on a different branch, rebuild so
`frontend/dist` matches the source, then hard-refresh / restart the instance:

```bash
npm run build
```

## Delegating development (herdr + agy)

We work inside **herdr** (`HERDR_ENV=1`) — use the `ogulcancelik--herdr` skill. Delegate
substantial implementation to the **`agy`** agent running in another pane:

- Check for an agy pane with `herdr pane list`. If one exists, send the brief with
  `herdr pane run <agy-pane-id> "<instruction>"`.
- **If no agy pane exists, create one**: split a pane (`herdr pane split <pane> --direction right --no-focus`)
  and run `agy` in it, then delegate to it.
- Give agy a **complete written brief** (a `/tmp/<task>.md` file works well, then point agy at it):
  the task, the branch to use (short-lived off `main`, per the strategy above), git discipline
  (logical commits, push, **no merge to main without review**), and a **mandatory** pressure-test
  plus the full validation suite.
- **Monitor by exception.** Watch agy's herdr `agent_status`: `blocked` → grant the permission or
  answer; `idle`/`done` are unreliable instantaneously (agy flaps and reports `done` while waiting
  on its own subprocess) — only act on **sustained** quiescence, and **read the pane to confirm it
  actually finished** before trusting it.
- **Always independently verify agy's work** before reporting it done — re-run the validation suite
  yourself and spot-check the diff. Do not relay agy's pass counts on faith.

## Validation suite

```bash
npm run typecheck
bash scripts/test_backend.sh
npm test
npm run build
```
