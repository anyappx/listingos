#!/usr/bin/env bash
# Start Next.js dev server on port 4000, then run Playwright tests.
# Usage: ./scripts/run-tests.sh [playwright options]
#
# Examples:
#   ./scripts/run-tests.sh                            # all tests
#   ./scripts/run-tests.sh tests/e2e/10-full-movie.spec.ts
#   ./scripts/run-tests.sh --grep "Scene 7"

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/.."
cd "$ROOT"

NODE="/Users/sudhir/.nvm/versions/node/v21.6.0/bin/node"
NPX="$NODE $ROOT/node_modules/.bin/playwright"

export TEST_BASE_URL="${TEST_BASE_URL:-http://localhost:4000}"
export PORT=4000

echo "▶  Starting dev server on :4000..."
$NODE node_modules/.bin/next dev -p 4000 &
DEV_PID=$!
trap "kill $DEV_PID 2>/dev/null; exit" INT TERM EXIT

# Wait until server is ready
echo "⏳  Waiting for server..."
for i in $(seq 1 30); do
  if curl -sf "$TEST_BASE_URL" >/dev/null 2>&1; then
    echo "✅  Server ready"
    break
  fi
  sleep 2
done

# Run tests
echo "▶  Running Playwright tests..."
$NPX "$@"

echo "✅  Tests complete"
