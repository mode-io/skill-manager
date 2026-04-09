#!/usr/bin/env bash
set -euo pipefail

VERSION="${1:-}"
ARM64_SHA="${2:-}"
X64_SHA="${3:-}"

if [[ -z "$VERSION" || -z "$ARM64_SHA" || -z "$X64_SHA" ]]; then
  echo "Usage: $0 <version> <arm64-sha256> <x64-sha256>" >&2
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_FORMULA="$(mktemp "${TMPDIR:-/tmp}/skill-manager-formula-XXXXXX.rb")"
PYTHON_BIN="${PYTHON_BIN:-python3}"
trap 'rm -f "$TMP_FORMULA"' EXIT

"$PYTHON_BIN" "$REPO_ROOT/scripts/render_homebrew_formula.py" \
  --version "$VERSION" \
  --arm64-url "https://example.invalid/skill-manager-v${VERSION}-darwin-arm64.tar.gz" \
  --arm64-sha256 "$ARM64_SHA" \
  --x64-url "https://example.invalid/skill-manager-v${VERSION}-darwin-x64.tar.gz" \
  --x64-sha256 "$X64_SHA" \
  --output "$TMP_FORMULA"

ruby -c "$TMP_FORMULA" >/dev/null
grep -q 'libexec.install Dir\["skill-manager/\*"\]' "$TMP_FORMULA"
grep -q 'bin.install_symlink libexec/"skill-manager" => "skill-manager"' "$TMP_FORMULA"
