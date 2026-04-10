# Contributing to skill-manager

Thanks for your interest in improving `skill-manager`.

Issues and pull requests are welcome. For small fixes, docs updates, and focused improvements, feel free to open a PR directly. For larger features, broad refactors, or architecture changes, please open an issue first so we can align on direction before implementation starts.

## Ways to contribute

- report bugs or confusing behavior
- improve documentation and examples
- fix focused issues with tests
- propose product or architecture improvements through issues first

## Local setup

Use the standard repo setup:

```bash
scripts/install-dev.sh
```

## Validate before opening a PR

Run the smallest set of checks that proves your change is correct. For most changes, that means:

```bash
bash scripts/test_backend.sh
npm test
npm run build
```

If your change touches only one area, include the narrower command you ran in the PR description.

## Pull request expectations

- keep the change focused and avoid mixing unrelated cleanup
- add or update tests when behavior changes
- update docs when user-facing behavior or setup changes
- include screenshots or a short recording for visible UI changes when practical
- explain the problem, the fix, and how you validated it

## What to avoid

- large refactors without prior discussion
- unrelated formatting or cleanup in feature PRs
- generated or AI-written changes that do not match existing repo patterns
- surprise changes to local mutation semantics, harness behavior, or shared-store behavior without prior alignment

