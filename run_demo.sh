#!/usr/bin/env bash
#
# run_demo.sh — run the full GradeBuddy pipeline against 3 students.
#
# Each student has their own variant of demo/mock-server/app.py:
#   alice    — original, all rubric items pass
#   bob      — POST returns 200 on bad body, DELETE returns 200 (breaks 4 & 6)
#   charlie  — GET /businesses omits "next", GET /businesses/<id> returns
#              200 + {} on missing id (breaks 2 & 5)
#
# Usage:
#   export ANTHROPIC_API_KEY=...        # required (grader fails loud without it)
#   ./run_demo.sh
#
# The script is idempotent: it always restores app.py to alice's golden
# copy on exit, even if something fails midway.

set -uo pipefail

# Resolve repo root regardless of where the script is invoked from.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

MOCK_DIR="demo/mock-server"
APP_PATH="$MOCK_DIR/app.py"
ALICE_PATH="$MOCK_DIR/app_alice.py"
BOB_PATH="$MOCK_DIR/app_bob.py"
CHARLIE_PATH="$MOCK_DIR/app_charlie.py"

# --- Preconditions ------------------------------------------------------------
for f in "$ALICE_PATH" "$BOB_PATH" "$CHARLIE_PATH" \
         "$MOCK_DIR/docker-compose.yml" "$MOCK_DIR/Dockerfile" \
         "demo/assignment.md" "demo/collection.json" "main.py"; do
    if [ ! -f "$f" ]; then
        echo "ERROR: required file missing: $f" >&2
        exit 1
    fi
done

if ! command -v docker >/dev/null 2>&1; then
    echo "ERROR: docker not found on PATH." >&2
    exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
    echo "ERROR: python3 not found on PATH." >&2
    exit 1
fi

if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
    echo "WARN: ANTHROPIC_API_KEY is not set — the grader will raise. Set it before running."
fi

# --- Cleanup trap -------------------------------------------------------------
restore_alice() {
    echo
    echo ">>> Restoring app.py to alice's golden copy"
    cp "$ALICE_PATH" "$APP_PATH"
}
trap restore_alice EXIT

# --- Helpers ------------------------------------------------------------------
kill_port_3000() {
    echo ">>> Tearing down anything on port 3000"

    # Stop the demo compose project if it's up.
    ( cd "$MOCK_DIR" && docker compose down -v >/dev/null 2>&1 || true )

    # Stop any container publishing port 3000.
    local cids
    cids="$(docker ps --filter "publish=3000" -q || true)"
    if [ -n "$cids" ]; then
        echo "    stopping containers: $cids"
        docker stop $cids >/dev/null 2>&1 || true
        docker rm -f $cids >/dev/null 2>&1 || true
    fi

    # Last resort: kill any local process holding the port.
    if command -v lsof >/dev/null 2>&1; then
        local pids
        pids="$(lsof -ti :3000 || true)"
        if [ -n "$pids" ]; then
            echo "    killing local pids on :3000: $pids"
            kill -9 $pids 2>/dev/null || true
        fi
    fi
}

run_student() {
    local name="$1"
    local variant="$2"

    echo
    echo "================================================================"
    echo "  GradeBuddy demo run — student: $name"
    echo "================================================================"

    kill_port_3000

    echo ">>> Installing variant: $(basename "$variant") -> app.py"
    cp "$variant" "$APP_PATH"

    echo ">>> docker compose up -d --build"
    ( cd "$MOCK_DIR" && docker compose down -v >/dev/null 2>&1 || true )
    ( cd "$MOCK_DIR" && docker compose up -d --build )

    echo ">>> Waiting 5s for server to become ready..."
    sleep 5

    echo ">>> Running main.py for $name"
    python3 main.py \
        --student "$name" \
        --repo "https://github.com/${name}/businesses" \
        --assignment demo/assignment.md \
        --collection demo/collection.json \
        --base-url http://localhost:3000 \
        || echo "    (main.py exited non-zero for $name — continuing)"

    echo ">>> Sleeping 2s before next student"
    sleep 2
}

# --- Demo ---------------------------------------------------------------------
echo "GradeBuddy demo runner starting at $(date)"

run_student "alice"   "$ALICE_PATH"
run_student "bob"     "$BOB_PATH"
run_student "charlie" "$CHARLIE_PATH"

# Final teardown so the demo doesn't leave a container running on :3000.
kill_port_3000

echo
echo "All demo runs complete."
