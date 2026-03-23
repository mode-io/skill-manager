#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

python3 -m unittest discover tests/unit -p 'test_*.py'
python3 -m unittest discover tests/integration -p 'test_*.py'
npm run test
npm run build
npm run test:e2e
