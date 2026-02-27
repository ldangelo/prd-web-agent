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
