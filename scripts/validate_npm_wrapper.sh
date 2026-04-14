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
FIXTURE_MANIFEST="$TMP_DIR/marketplace-fixture.json"
FIXTURE_PID=""

cleanup() {
  if [[ -x "$TMP_DIR/node_modules/.bin/skill-manager" ]]; then
    "$TMP_DIR/node_modules/.bin/skill-manager" stop --state-dir "$TMP_DIR/runtime" >/dev/null 2>&1 || true
  fi
  if [[ -n "$FIXTURE_PID" ]]; then
    kill "$FIXTURE_PID" >/dev/null 2>&1 || true
    wait "$FIXTURE_PID" >/dev/null 2>&1 || true
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

python3 "$REPO_ROOT/scripts/serve_marketplace_fixture.py" --manifest "$FIXTURE_MANIFEST" >/dev/null 2>&1 &
FIXTURE_PID=$!
for _ in {1..50}; do
  [[ -f "$FIXTURE_MANIFEST" ]] && break
  sleep 0.2
done
if [[ ! -f "$FIXTURE_MANIFEST" ]]; then
  echo "Marketplace fixture did not start." >&2
  exit 1
fi

export SKILL_MANAGER_MARKETPLACE_BASE_URL
SKILL_MANAGER_MARKETPLACE_BASE_URL="$(python3 -c 'import json, sys; print(json.load(open(sys.argv[1]))["baseUrl"])' "$FIXTURE_MANIFEST")"
export SSL_CERT_FILE
SSL_CERT_FILE="$(python3 -c 'import json, sys; print(json.load(open(sys.argv[1]))["caCertPath"])' "$FIXTURE_MANIFEST")"
export SKILL_MANAGER_LOCAL_ARTIFACT_PATH="$ARTIFACT_PATH"
npm install --no-package-lock "./$PACK_FILE" >/dev/null

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

BASE_URL="$(printf '%s' "$STATUS_OUTPUT" | python3 -c 'import re, sys; match = re.search(r"(http://127\.0\.0\.1:\d+)", sys.stdin.read()); print(match.group(1) if match else "")')"
if [[ -z "$BASE_URL" ]]; then
  echo "Unable to parse runtime URL from status output: $STATUS_OUTPUT" >&2
  exit 1
fi

python3 - "$BASE_URL" <<'PY'
import json
import sys
from urllib.parse import quote
from urllib.request import urlopen

base_url = sys.argv[1]
with urlopen(f"{base_url}/api/marketplace/popular?limit=3", timeout=30) as response:
    payload = json.loads(response.read().decode("utf-8"))
items = payload.get("items")
if not isinstance(items, list) or not items:
    raise SystemExit(f"marketplace popular response was empty: {payload!r}")
item_id = items[0].get("id")
if not isinstance(item_id, str) or not item_id:
    raise SystemExit(f"marketplace item was missing id: {items[0]!r}")
encoded_id = quote(item_id, safe="")
with urlopen(f"{base_url}/api/marketplace/items/{encoded_id}", timeout=30) as response:
    detail = json.loads(response.read().decode("utf-8"))
if detail.get("id") != item_id:
    raise SystemExit(f"marketplace detail response did not match item id: {detail!r}")
with urlopen(f"{base_url}/api/marketplace/items/{encoded_id}/document", timeout=30) as response:
    document = json.loads(response.read().decode("utf-8"))
if document.get("status") not in {"ready", "unavailable"}:
    raise SystemExit(f"marketplace document response was malformed: {document!r}")
PY

FAKE_BIN_DIR="$TMP_DIR/fake-bin"
mkdir -p "$FAKE_BIN_DIR"
cat >"$FAKE_BIN_DIR/brew" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
if [[ "${1:-}" == "--prefix" && $# -eq 1 ]]; then
  printf '/opt/homebrew\n'
  exit 0
fi
if [[ "${1:-}" == "--prefix" && "${2:-}" == "skill-manager" ]]; then
  printf '/opt/homebrew/opt/skill-manager\n'
  exit 0
fi
if [[ "${1:-}" == "list" && "${2:-}" == "--versions" && "${3:-}" == "skill-manager" ]]; then
  printf 'skill-manager 0.1.0\n'
  exit 0
fi
exit 1
EOF
chmod +x "$FAKE_BIN_DIR/brew"

CONFLICT_OUTPUT="$(
  PATH="$FAKE_BIN_DIR:$PATH" \
  npm install --global --prefix "$TMP_DIR/global-prefix" "./$PACK_FILE" 2>&1 || true
)"
if [[ "$CONFLICT_OUTPUT" != *"skill-manager is already installed via Homebrew. Run 'brew uninstall skill-manager' before 'npm install -g @mode-io/skill-manager', or keep using the Homebrew installation."* ]]; then
  echo "Global npm conflict check did not emit the expected remediation message." >&2
  echo "$CONFLICT_OUTPUT" >&2
  exit 1
fi

ln -sf "$TMP_DIR/node_modules/@mode-io/skill-manager/bin/skill-manager.js" "$TMP_DIR/global-skill-manager"
RUNTIME_CONFLICT_OUTPUT="$(
  PATH="$FAKE_BIN_DIR:$PATH" \
  "$TMP_DIR/global-skill-manager" --version 2>&1 || true
)"
if [[ "$RUNTIME_CONFLICT_OUTPUT" != *"skill-manager is already installed via Homebrew. Run 'brew uninstall skill-manager' before 'npm install -g @mode-io/skill-manager', or keep using the Homebrew installation."* ]]; then
  echo "Runtime conflict check did not emit the expected remediation message." >&2
  echo "$RUNTIME_CONFLICT_OUTPUT" >&2
  exit 1
fi

"$TMP_DIR/node_modules/.bin/skill-manager" stop --state-dir "$TMP_DIR/runtime" >/dev/null
