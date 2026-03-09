#!/usr/bin/env bash
set -euo pipefail

# Complexity checks for Python (radon) and TypeScript (ESLint)
# CC max: 15 (radon grade D+ = violation)
# MI min: A  (radon grade B+ = violation)

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
failed=0

echo "=== Python CC (max 15) ==="
output=$(cd "$ROOT/backend" && uv run radon cc app/ -n D -s)
if [ -n "$output" ]; then
    echo "$output"
    echo "FAIL: functions exceed CC 15"
    failed=1
else
    echo "  OK"
fi

echo "=== Python MI (min A) ==="
output=$(cd "$ROOT/backend" && uv run radon mi app/ -n B -s)
if [ -n "$output" ]; then
    echo "$output"
    echo "FAIL: modules below MI grade A"
    failed=1
else
    echo "  OK"
fi

echo "=== TypeScript CC (max 15) ==="
if cd "$ROOT/frontend" && npx eslint src/ --no-warn-ignored; then
    echo "  OK"
else
    echo "FAIL: TypeScript complexity violations"
    failed=1
fi

exit $failed
