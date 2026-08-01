#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# skill-manager requires Python 3.11+. The bare `python3` on a machine may be
# older (e.g. 3.9), which silently resolves incompatible dependency versions,
# so pick the first interpreter that satisfies the minimum.
find_python() {
  for candidate in python3.14 python3.13 python3.12 python3.11 python3; do
    if command -v "$candidate" >/dev/null 2>&1 \
      && "$candidate" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)'; then
      echo "$candidate"
      return 0
    fi
  done
  return 1
}

PYTHON="$(find_python)" || {
  echo "error: Python 3.11+ is required but was not found on PATH." >&2
  exit 1
}
echo "Using $("$PYTHON" --version) ($PYTHON)"

"$PYTHON" -m venv .venv
"$ROOT_DIR/.venv/bin/python" -m pip install --upgrade pip
"$ROOT_DIR/.venv/bin/pip" install -r requirements.txt
npm install
