#!/usr/bin/env bash
# devbox init hook — runs on every `devbox shell` entry

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Copy .env.example → .env if missing
if [ ! -f "$REPO_ROOT/.env" ]; then
  if [ -f "$REPO_ROOT/.env.example" ]; then
    cp "$REPO_ROOT/.env.example" "$REPO_ROOT/.env"
    echo "✓ Created .env from .env.example"

    # Patch EFS_MOUNT_PATH to use local directory
    LOCAL_EFS="$REPO_ROOT/.local-efs"
    mkdir -p "$LOCAL_EFS"
    sed -i.bak "s|EFS_MOUNT_PATH=.*|EFS_MOUNT_PATH=\"$LOCAL_EFS\"|" "$REPO_ROOT/.env"
    rm -f "$REPO_ROOT/.env.bak"
    echo "✓ Set EFS_MOUNT_PATH to $LOCAL_EFS"
  else
    echo "⚠ No .env.example found — skipping .env generation"
  fi
fi

# Check Docker daemon
if ! docker info >/dev/null 2>&1; then
  echo "⚠ Docker daemon is not running. Start Docker Desktop or the Docker service."
fi

# Dolt server for beads (bd) is managed by a macOS LaunchAgent
# (~/Library/LaunchAgents/com.ldangelo.beads-dolt.plist) which keeps it running
# persistently and auto-restarts it if killed by bd's idle-monitor.
# Only fall back to manual start if launchd isn't managing it (e.g. CI/Linux).
if command -v bd >/dev/null 2>&1; then
  if ! nc -z 127.0.0.1 3307 >/dev/null 2>&1; then
    if [ "$(uname)" != "Darwin" ] || ! launchctl list com.ldangelo.beads-dolt >/dev/null 2>&1; then
      bd dolt start >/dev/null 2>&1 && echo "✓ Beads Dolt server started" || echo "⚠ Failed to start Beads Dolt server"
    else
      echo "⚠ Beads Dolt server not yet up (LaunchAgent managing it — wait a moment)"
    fi
  fi
fi
