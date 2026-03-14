#!/usr/bin/env bash
# Build pi-mono and ensure `pi` command is linked to omegon.
#
# Omegon's bin/pi imports directly from vendor/pi-mono/packages/coding-agent/dist/,
# so after building, changes are immediately live — no tarball packing or global
# npm install needed.
#
# Usage:
#   ./scripts/install-pi.sh              # build + link
#   ./scripts/install-pi.sh --skip-build # link only (assumes dist/ is current)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PI_MONO="$ROOT_DIR/vendor/pi-mono"

# ── Build ─────────────────────────────────────────────────────────────────
if [[ "${1:-}" != "--skip-build" ]]; then
  echo "▸ Building pi-mono..."
  (cd "$PI_MONO" && npm run build)
else
  echo "▸ Skipping build (--skip-build)"
fi

# ── Link ──────────────────────────────────────────────────────────────────
# npm link creates a global symlink: `pi` → omegon/bin/pi → vendor/pi-mono
echo "▸ Linking omegon globally..."
(cd "$ROOT_DIR" && npm link --force 2>&1 | grep -v "^npm warn")

# ── Verify ────────────────────────────────────────────────────────────────
PI_PATH=$(which pi 2>/dev/null || echo "NOT FOUND")
PI_VERSION=$(pi --version 2>/dev/null || echo "FAILED")
echo ""
echo "✓ pi $PI_VERSION"
echo "  → $PI_PATH"

# Verify it points at omegon
if readlink "$PI_PATH" 2>/dev/null | grep -q "omegon"; then
  echo "✓ Linked to omegon"
else
  echo "⚠ WARNING: pi may not be linked to omegon — check: readlink $(which pi)"
fi
