#!/bin/bash
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"
cd "$ROOT/qa"
echo "=== Installing dependencies ==="
npm install
npx playwright install chromium
echo "=== Backend Tests ==="
cd "$ROOT/backend" && source .venv/bin/activate && pytest -x -q 2>&1 | tee ../qa/results/backend-results.txt
PASS=$(grep -oP '\d+(?=\s+passed)' results/backend-results.txt || echo "?")
echo "=== Web Admin Tests ==="
cd "$ROOT/qa"
npx playwright test 2>&1 | tee results/playwright.log
echo "=== Done ==="
echo "Results: qa/results/"