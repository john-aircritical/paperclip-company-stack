#!/bin/bash
set -e

# ═══════════════════════════════════════════════════════════════════════════════
# Paperclip Company Stack — First-Run Setup
# ═══════════════════════════════════════════════════════════════════════════════

SENTINEL="/paperclip/.setup-complete"
API_URL="http://localhost:3101/api"

# ── Step 1: Check if already configured ──────────────────────────────────────

if [ -f "$SENTINEL" ]; then
  echo "Setup already complete. To re-run, delete $SENTINEL first."
  echo "  docker compose exec stack rm $SENTINEL"
  echo "  docker compose exec stack /app/setup.sh"
  exit 0
fi

# ── Step 2: Wait for Paperclip server ────────────────────────────────────────

echo "Waiting for Paperclip server..."
for i in $(seq 1 60); do
  if curl -sf "$API_URL/health" > /dev/null 2>&1; then
    echo "Paperclip server is healthy."
    break
  fi
  if [ "$i" = "60" ]; then
    echo "ERROR: Paperclip server not healthy after 60s"
    exit 1
  fi
  sleep 2
done

# ── Step 3: Claude Code authentication ───────────────────────────────────────

echo ""
echo "Step 3: Claude Code Authentication"
echo "Running 'claude auth login' — follow the prompts."
echo ""
claude auth login || {
  echo "WARNING: Claude auth failed. You can retry later with: claude auth login"
}

# ── Step 4: Board claim (Paperclip auth) ─────────────────────────────────────

echo ""
echo "Step 4: Claiming board seat..."
echo "Open Paperclip UI at ${PAPERCLIP_PUBLIC_URL:-http://localhost:3101}"
echo "Complete board claim in the browser, then press Enter."
read -r -p "Press Enter when board claim is complete... "

# Get auth token
echo "Enter your Paperclip auth token (from browser dev tools or login response):"
read -r -s TOKEN
echo ""

if [ -z "$TOKEN" ]; then
  echo "ERROR: No token provided."
  exit 1
fi

echo "$TOKEN" > /paperclip/.board-token
echo "Token saved."

# ── Step 5: Create company ───────────────────────────────────────────────────

echo ""
echo "Step 5: Creating company..."
read -r -p "Company name [AI Company]: " COMPANY_NAME
COMPANY_NAME="${COMPANY_NAME:-AI Company}"

COMPANY_RESPONSE=$(curl -sf -X POST "$API_URL/v1/companies" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\": \"$COMPANY_NAME\"}" 2>&1) || {
  echo "ERROR: Failed to create company: $COMPANY_RESPONSE"
  exit 1
}

COMPANY_ID=$(echo "$COMPANY_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null)
if [ -z "$COMPANY_ID" ]; then
  echo "ERROR: Could not parse company ID from response"
  echo "$COMPANY_RESPONSE"
  exit 1
fi

echo "$COMPANY_ID" > /paperclip/.company-id
echo "Company created: $COMPANY_NAME (ID: $COMPANY_ID)"

# ── Step 6: Store secrets ────────────────────────────────────────────────────

echo ""
echo "Step 6: Storing API keys as Paperclip secrets..."

store_secret() {
  local name="$1"
  local value="$2"
  if [ -z "$value" ]; then
    echo "  Skipping $name (not set)"
    return
  fi
  local resp
  resp=$(curl -sf -X POST "$API_URL/v1/secrets" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"name\": \"$name\", \"value\": \"$value\"}" 2>&1) || {
    echo "  WARNING: Failed to store secret $name"
    return
  }
  local sid
  sid=$(echo "$resp" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null)
  echo "  Stored: $name → $sid"
  echo "\"$name\": \"$sid\"" >> /tmp/secrets-list.txt
}

> /tmp/secrets-list.txt
store_secret "anthropic-api-key" "$ANTHROPIC_API_KEY"
store_secret "openai-api-key" "$OPENAI_API_KEY"
store_secret "google-api-key" "$GOOGLE_API_KEY"
store_secret "github-api-key" "$GITHUB_API_KEY"

# Build secrets JSON
python3 -c "
import json
secrets = {}
try:
    with open('/tmp/secrets-list.txt') as f:
        for line in f:
            line = line.strip()
            if line:
                k, v = line.split(': ', 1)
                secrets[k.strip('\"')] = v.strip('\"')
except: pass
with open('/paperclip/.secret-ids.json', 'w') as f:
    json.dump(secrets, f, indent=2)
print(f'  Saved {len(secrets)} secret IDs to /paperclip/.secret-ids.json')
"
rm -f /tmp/secrets-list.txt

# ── Step 7: Create agents ────────────────────────────────────────────────────

echo ""
echo "Step 7: Creating agents..."
/app/scripts/seed-company.sh

# ── Step 8: Install plugins ──────────────────────────────────────────────────

echo ""
echo "Step 8: Installing plugins..."
/app/scripts/install-plugins.sh

# ── Step 9: Set company goal ─────────────────────────────────────────────────

echo ""
echo "Step 9: Company goals"
read -r -p "What is your company mission? " MISSION
if [ -n "$MISSION" ]; then
  curl -sf -X POST "$API_URL/v1/companies/$COMPANY_ID/goals" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"description\": \"$MISSION\"}" > /dev/null 2>&1 && \
    echo "  Goal set: $MISSION" || \
    echo "  WARNING: Failed to set goal (non-critical)"
fi

# ── Step 10: Verify ──────────────────────────────────────────────────────────

echo ""
echo "Step 10: Verifying setup..."
HEALTH=$(curl -sf "$API_URL/health" 2>/dev/null)
echo "  Paperclip: healthy"
echo "  Company: $COMPANY_NAME ($COMPANY_ID)"
echo "  Secrets: $(cat /paperclip/.secret-ids.json | python3 -c 'import sys,json; print(len(json.load(sys.stdin)))' 2>/dev/null || echo '?') stored"
echo ""

# ── Done ─────────────────────────────────────────────────────────────────────

touch "$SENTINEL"
echo "═══════════════════════════════════════════════════════"
echo "Setup complete!"
echo ""
echo "Paperclip UI: ${PAPERCLIP_PUBLIC_URL:-http://localhost:3101}"
echo "Company ID:   $COMPANY_ID"
echo ""
echo "Next steps:"
echo "  1. Open the Paperclip UI and verify agents in the org chart"
echo "  2. Create your first issue to test routing"
echo "  3. Monitor the emotion dashboard"
echo "═══════════════════════════════════════════════════════"
