#!/bin/bash
set -e

# ═══════════════════════════════════════════════════════════════════════════════
# Install Plugins — Registers both plugins with Paperclip
# Idempotent: safe to re-run
# Supports no-auth mode (local_trusted) and authenticated mode
# ═══════════════════════════════════════════════════════════════════════════════

INTERNAL_PORT="${PAPERCLIP_INTERNAL_PORT:-${PORT:-9000}}"
API_URL="http://localhost:${INTERNAL_PORT}/api"
ORIGIN="http://localhost:${INTERNAL_PORT}"
TOKEN=$(cat /paperclip/.board-token 2>/dev/null || true)
COOKIE=$(cat /paperclip/.session-cookie 2>/dev/null || true)

# Build auth args with CSRF origin headers
AUTH_ARGS=(-H "Origin: $ORIGIN" -H "Referer: $ORIGIN/")
if [ -n "$TOKEN" ]; then
  AUTH_ARGS+=(-H "Authorization: Bearer $TOKEN")
elif [ -n "$COOKIE" ]; then
  AUTH_ARGS+=(-H "Cookie: $COOKIE")
fi

install_plugin() {
  local name="$1"
  local path="$2"

  echo "  Installing $name from $path..."

  # Pack the plugin
  local tarball
  tarball=$(cd "$path" && npm pack --quiet 2>/dev/null | tail -1)
  if [ -z "$tarball" ]; then
    echo "  [FAIL] Could not pack $name"
    return
  fi

  # Install via API
  local resp
  resp=$(curl -sf -X POST "$API_URL/plugins/install" \
    "${AUTH_ARGS[@]}" \
    -H "Content-Type: application/json" \
    -d "{\"source\": \"local\", \"path\": \"$path\"}" 2>&1) || {
    # Try alternative: install by npm name
    resp=$(curl -sf -X POST "$API_URL/plugins/install" \
      "${AUTH_ARGS[@]}" \
      -H "Content-Type: application/json" \
      -d "{\"name\": \"$name\"}" 2>&1) || {
      echo "  [WARN] Could not install $name via API. Install manually in Paperclip UI."
      return
    }
  }
  echo "  [installed] $name"
}

echo "Installing plugins..."
echo ""

install_plugin "@accmedlink/plugin-emotion-engine" "/app/plugins/plugin-emotion-engine"
install_plugin "@accmedlink/plugin-token-tools" "/app/plugins/plugin-token-tools"

echo ""
echo "Plugin installation complete."
echo "Verify in Paperclip UI → Settings → Plugins"
