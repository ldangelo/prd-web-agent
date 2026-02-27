#!/usr/bin/env bash
# Diagnostic checks for the development environment

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=0
FAIL=0
WARN=0

pass() { echo -e "  ${GREEN}✓${NC} $1"; PASS=$((PASS + 1)); }
fail() { echo -e "  ${RED}✗${NC} $1"; FAIL=$((FAIL + 1)); }
warn() { echo -e "  ${YELLOW}!${NC} $1"; WARN=$((WARN + 1)); }

echo "=== System Tools ==="

for cmd in node npm docker psql redis-cli jq curl; do
  if command -v "$cmd" >/dev/null 2>&1; then
    pass "$cmd ($(command -v "$cmd"))"
  else
    fail "$cmd not found"
  fi
done

echo ""
echo "=== Docker Services ==="

if docker info >/dev/null 2>&1; then
  pass "Docker daemon running"

  for svc in prd-web-agent-postgres prd-web-agent-redis prd-web-agent-opensearch; do
    if docker ps --format '{{.Names}}' | grep -q "^${svc}$"; then
      # Check health status
      health=$(docker inspect --format='{{.State.Health.Status}}' "$svc" 2>/dev/null || echo "unknown")
      if [ "$health" = "healthy" ]; then
        pass "$svc (healthy)"
      else
        warn "$svc (running, health: $health)"
      fi
    else
      fail "$svc not running"
    fi
  done

else
  fail "Docker daemon not running"
fi

echo ""
echo "=== Application State ==="

if [ -f "$REPO_ROOT/.env" ]; then
  pass ".env file exists"
else
  fail ".env file missing (run: devbox run setup)"
fi

if [ -d "$REPO_ROOT/node_modules" ]; then
  pass "node_modules installed"
else
  fail "node_modules missing (run: devbox run setup)"
fi

if [ -d "$REPO_ROOT/node_modules/.prisma/client" ]; then
  pass "Prisma client generated"
else
  fail "Prisma client missing (run: npx prisma generate)"
fi

echo ""
echo "=== Summary ==="
echo -e "  ${GREEN}${PASS} passed${NC}, ${RED}${FAIL} failed${NC}, ${YELLOW}${WARN} warnings${NC}"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
