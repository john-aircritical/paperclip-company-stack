#!/bin/bash
set -e

# ═══════════════════════════════════════════════════════════════════════════════
# Install Plugins — Registers both plugins with Paperclip
# Idempotent: safe to re-run
# ═══════════════════════════════════════════════════════════════════════════════

API_URL="http://localhost:3101/api"
TOKEN=$(cat /paperclip/.board-token 2>/dev/null)

if [ -z "$TOKEN" ]; then
  echo "ERROR: Run setup.sh first (missing token)"
  exit 1
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

  # Install via API (plugin install endpoint)
  local resp
  resp=$(curl -sf -X POST "$API_URL/v1/plugins/install" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"source\": \"local\", \"path\": \"$path\"}" 2>&1) || {
    # Try alternative: install by npm name
    resp=$(curl -sf -X POST "$API_URL/v1/plugins/install" \
      -H "Authorization: Bearer $TOKEN" \
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
