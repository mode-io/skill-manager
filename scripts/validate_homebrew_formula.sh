#!/usr/bin/env bash
set -euo pipefail

VERSION="${1:-}"
ARTIFACT_PATH="${2:-}"

if [[ -z "$VERSION" || -z "$ARTIFACT_PATH" ]]; then
  echo "Usage: $0 <version> <artifact-path>" >&2
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_FORMULA="$(mktemp "${TMPDIR:-/tmp}/skill-manager-formula-XXXXXX.rb")"
PYTHON_BIN="${PYTHON_BIN:-python3}"
ARTIFACT_PATH="$("$PYTHON_BIN" -c 'from pathlib import Path; import sys; print(Path(sys.argv[1]).resolve())' "$ARTIFACT_PATH")"

if [[ ! -f "$ARTIFACT_PATH" ]]; then
  echo "Artifact not found: $ARTIFACT_PATH" >&2
  exit 1
fi

ARTIFACT_SHA="$("$PYTHON_BIN" -c 'from hashlib import sha256; from pathlib import Path; import sys; print(sha256(Path(sys.argv[1]).read_bytes()).hexdigest())' "$ARTIFACT_PATH")"
ARTIFACT_URI="$("$PYTHON_BIN" -c 'from pathlib import Path; import sys; print(Path(sys.argv[1]).resolve().as_uri())' "$ARTIFACT_PATH")"
BREW_BIN="${BREW_BIN:-$(command -v brew)}"

if [[ -z "$BREW_BIN" ]]; then
  echo "Homebrew is required to validate the formula." >&2
  exit 1
fi

BREW_REPO="$("$BREW_BIN" --repository)"
TAP_NAME="local/skill-manager-smoke"
TAP_DIR="$BREW_REPO/Library/Taps/local/homebrew-skill-manager-smoke"
FORMULA_NAME="skill-manager"
OFFICIAL_TAP="mode-io/tap"
OFFICIAL_TAP_WAS_PRESENT=0
if "$BREW_BIN" tap | grep -Fxq "$OFFICIAL_TAP"; then
  OFFICIAL_TAP_WAS_PRESENT=1
fi

cleanup() {
  rm -f "$TMP_FORMULA"
  HOMEBREW_NO_AUTO_UPDATE=1 HOMEBREW_NO_INSTALL_CLEANUP=1 "$BREW_BIN" uninstall --force "$TAP_NAME/$FORMULA_NAME" >/dev/null 2>&1 || true
  HOMEBREW_NO_AUTO_UPDATE=1 HOMEBREW_NO_INSTALL_CLEANUP=1 "$BREW_BIN" uninstall --force skill-manager >/dev/null 2>&1 || true
  HOMEBREW_NO_AUTO_UPDATE=1 HOMEBREW_NO_INSTALL_CLEANUP=1 "$BREW_BIN" untap "$TAP_NAME" >/dev/null 2>&1 || true
  rm -rf "$TAP_DIR"
  if [[ "$OFFICIAL_TAP_WAS_PRESENT" == "1" ]]; then
    HOMEBREW_NO_AUTO_UPDATE=1 HOMEBREW_NO_INSTALL_CLEANUP=1 "$BREW_BIN" tap "$OFFICIAL_TAP" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

"$PYTHON_BIN" "$REPO_ROOT/scripts/render_homebrew_formula.py" \
  --version "$VERSION" \
  --arm64-url "$ARTIFACT_URI" \
  --arm64-sha256 "$ARTIFACT_SHA" \
  --x64-url "$ARTIFACT_URI" \
  --x64-sha256 "$ARTIFACT_SHA" \
  --output "$TMP_FORMULA"

ruby -c "$TMP_FORMULA" >/dev/null
grep -q 'license "MIT"' "$TMP_FORMULA"
grep -q 'staged_root = (buildpath/"skill-manager").directory? ? buildpath/"skill-manager" : buildpath' "$TMP_FORMULA"
grep -q 'bin.install_symlink libexec/"skill-manager" => "skill-manager"' "$TMP_FORMULA"

HOMEBREW_NO_AUTO_UPDATE=1 HOMEBREW_NO_INSTALL_CLEANUP=1 "$BREW_BIN" uninstall --force skill-manager >/dev/null 2>&1 || true
if [[ "$OFFICIAL_TAP_WAS_PRESENT" == "1" ]]; then
  HOMEBREW_NO_AUTO_UPDATE=1 HOMEBREW_NO_INSTALL_CLEANUP=1 "$BREW_BIN" untap "$OFFICIAL_TAP" >/dev/null 2>&1 || true
fi
HOMEBREW_NO_AUTO_UPDATE=1 HOMEBREW_NO_INSTALL_CLEANUP=1 "$BREW_BIN" untap "$TAP_NAME" >/dev/null 2>&1 || true
rm -rf "$TAP_DIR"
HOMEBREW_NO_AUTO_UPDATE=1 HOMEBREW_NO_INSTALL_CLEANUP=1 "$BREW_BIN" tap-new --no-git "$TAP_NAME" >/dev/null
cp "$TMP_FORMULA" "$TAP_DIR/Formula/$FORMULA_NAME.rb"
HOMEBREW_NO_AUTO_UPDATE=1 HOMEBREW_NO_INSTALL_CLEANUP=1 "$BREW_BIN" install "$TAP_NAME/$FORMULA_NAME"

BREW_PREFIX="$("$BREW_BIN" --prefix)"
export PATH="$BREW_PREFIX/bin:$PATH"
INSTALLED_PREFIX="$("$BREW_BIN" --prefix "$FORMULA_NAME")"
ACTUAL_BIN="$(command -v skill-manager)"

[[ -n "$ACTUAL_BIN" ]]
[[ "$ACTUAL_BIN" == "$BREW_PREFIX/bin/skill-manager" ]]
[[ -x "$INSTALLED_PREFIX/bin/skill-manager" ]]
[[ -x "$INSTALLED_PREFIX/libexec/skill-manager" ]]

VERSION_OUTPUT="$("$INSTALLED_PREFIX/bin/skill-manager" --version)"
[[ "$VERSION_OUTPUT" == "skill-manager $VERSION" ]]
