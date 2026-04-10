#!/usr/bin/env bash
set -euo pipefail

ARTIFACT_PATH="${1:-}"
if [[ -z "$ARTIFACT_PATH" ]]; then
  echo "Usage: $0 <artifact-path>" >&2
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARTIFACT_PATH="$(cd "$(dirname "$ARTIFACT_PATH")" && pwd)/$(basename "$ARTIFACT_PATH")"
TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/skill-manager-npm-XXXXXX")"

cleanup() {
  if [[ -x "$TMP_DIR/node_modules/.bin/skill-manager" ]]; then
    "$TMP_DIR/node_modules/.bin/skill-manager" stop --state-dir "$TMP_DIR/runtime" >/dev/null 2>&1 || true
  fi
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

cd "$TMP_DIR"
npm init -y >/dev/null 2>&1

PACK_OUTPUT="$(npm pack --json "$REPO_ROOT/packaging/npm")"
PACK_FILE="$(printf '%s' "$PACK_OUTPUT" | python3 -c 'import json, sys; print(json.load(sys.stdin)[0]["filename"])')"
if [[ ! -f "$PACK_FILE" ]]; then
  echo "npm pack did not produce an archive: $PACK_OUTPUT" >&2
  exit 1
fi
tar -tzf "$PACK_FILE" | grep -q '^package/LICENSE$'
tar -xOf "$PACK_FILE" package/LICENSE | cmp -s - "$REPO_ROOT/LICENSE"
rm -f "$PACK_FILE"

export SKILL_MANAGER_LOCAL_ARTIFACT_PATH="$ARTIFACT_PATH"
npm install --no-package-lock "$REPO_ROOT/packaging/npm" >/dev/null

VERSION_OUTPUT="$("$TMP_DIR/node_modules/.bin/skill-manager" --version)"
if [[ ! "$VERSION_OUTPUT" =~ ^skill-manager[[:space:]][0-9]+\.[0-9]+\.[0-9]+ ]]; then
  echo "Unexpected npm wrapper version output: $VERSION_OUTPUT" >&2
  exit 1
fi

mkdir -p "$TMP_DIR/runtime"
START_OUTPUT="$("$TMP_DIR/node_modules/.bin/skill-manager" start --state-dir "$TMP_DIR/runtime" --no-open-browser --port 0)"
if [[ "$START_OUTPUT" != *"skill-manager started at http://127.0.0.1:"* ]]; then
  echo "Unexpected npm wrapper start output: $START_OUTPUT" >&2
  exit 1
fi

STATUS_OUTPUT="$("$TMP_DIR/node_modules/.bin/skill-manager" status --state-dir "$TMP_DIR/runtime")"
if [[ "$STATUS_OUTPUT" != *"skill-manager is running at http://127.0.0.1:"* ]]; then
  echo "Unexpected npm wrapper status output: $STATUS_OUTPUT" >&2
  exit 1
fi

"$TMP_DIR/node_modules/.bin/skill-manager" stop --state-dir "$TMP_DIR/runtime" >/dev/null
