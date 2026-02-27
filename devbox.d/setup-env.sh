#!/usr/bin/env bash
# Explicit first-time .env setup (called by `devbox run setup`)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ ! -f "$REPO_ROOT/.env.example" ]; then
  echo "ERROR: .env.example not found at $REPO_ROOT/.env.example"
  exit 1
fi

cp "$REPO_ROOT/.env.example" "$REPO_ROOT/.env"
echo "✓ Created .env from .env.example"

# Patch EFS_MOUNT_PATH to local directory
LOCAL_EFS="$REPO_ROOT/.local-efs"
mkdir -p "$LOCAL_EFS"
sed -i.bak "s|EFS_MOUNT_PATH=.*|EFS_MOUNT_PATH=\"$LOCAL_EFS\"|" "$REPO_ROOT/.env"
rm -f "$REPO_ROOT/.env.bak"
echo "✓ Set EFS_MOUNT_PATH to $LOCAL_EFS"

echo ""
echo "Environment ready. Review $REPO_ROOT/.env and fill in any missing secrets."
