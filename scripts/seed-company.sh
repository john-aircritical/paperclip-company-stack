#!/bin/bash
set -e

# ══════════════════════════════════════════════════════════════════════════════
# Seed Company — Creates all 11 agents via Paperclip API
# Idempotent: skips agents that already exist
# Supports no-auth mode (local_trusted) and authenticated mode
# ══════════════════════════════════════════════════════════════════════════════

INTERNAL_PORT="${PAPERCLIP_INTERNAL_PORT:-${PORT:-9000}}"
API_URL="http://localhost:${INTERNAL_PORT}/api"
ORIGIN="http://localhost:${INTERNAL_PORT}"
TOKEN=$(cat /paperclip/.board-token 2>/dev/null || true)
COOKIE=$(cat /paperclip/.session-cookie 2>/dev/null || true)
COMPANY_ID=$(cat /paperclip/.company-id 2>/dev/null || true)
SECRETS_FILE="/paperclip/.secret-ids.json"

# Build auth args with CSRF origin headers
AUTH_ARGS=(-H "Origin: $ORIGIN" -H "Referer: $ORIGIN/")
if [ -n "$TOKEN" ]; then
  AUTH_ARGS+=(-H "Authorization: Bearer $TOKEN")
elif [ -n "$COOKIE" ]; then
  AUTH_ARGS+=(-H "Cookie: $COOKIE")
fi

if [ -z "$COMPANY_ID" ]; then
  echo "ERROR: Run setup first (missing company ID)"
  exit 1
fi

# Get Anthropic secret ID
ANTHROPIC_SECRET_ID=$(python3 -c "
import json
with open('$SECRETS_FILE') as f:
    d = json.load(f)
    print(d.get('anthropic-api-key', ''))
" 2>/dev/null)

if [ -z "$ANTHROPIC_SECRET_ID" ]; then
  echo "ERROR: anthropic-api-key secret not found in $SECRETS_FILE"
  exit 1
fi

# ── Agent creation helper ────────────────────────────────────────────────

create_agent() {
  local name="$1"
  local slug="$2"
  local model="$3"
  local heartbeat="$4"
  local reports_to="$5"

  # Check if agent already exists
  local existing
  existing=$(curl -sf "$API_URL/companies/$COMPANY_ID/agents" \
    "${AUTH_ARGS[@]}" 2>/dev/null | \
    python3 -c "
import sys, json
agents = json.load(sys.stdin)
for a in agents:
    if a.get('name') == '$name':
        print(a['id'])
        break
" 2>/dev/null)

  if [ -n "$existing" ]; then
    echo "  [skip] $name already exists ($existing)"
    return
  fi

  # Build adapter config
  local adapter_config="{
    \"type\": \"claude_local\",
    \"cwd\": \"/home/node/workspaces/$slug\",
    \"command\": \"headroom wrap claude\",
    \"model\": \"$model\",
    \"env\": {
      \"ANTHROPIC_API_KEY\": {
        \"type\": \"secret_ref\",
        \"secretId\": \"$ANTHROPIC_SECRET_ID\",
        \"version\": \"latest\"
      }
    }
  }"

  # Build reports_to JSON
  local reports_json="None"
  if [ -n "$reports_to" ]; then
    local parent_id
    parent_id=$(curl -sf "$API_URL/companies/$COMPANY_ID/agents" \
      "${AUTH_ARGS[@]}" 2>/dev/null | \
      python3 -c "
import sys, json
agents = json.load(sys.stdin)
for a in agents:
    if a.get('name') == '$reports_to':
        print(a['id'])
        break
" 2>/dev/null)
    if [ -n "$parent_id" ]; then
      reports_json="\"$parent_id\""
    fi
  fi

  # Create agent
  local payload
  payload=$(python3 -c "
import json
data = {
    'name': '$name',
    'adapter': $adapter_config,
    'heartbeat': {
        'schedule': '$heartbeat'
    },
    'reportsTo': $reports_json,
    'instructionsDir': '/app/company/agents/$slug'
}
if data['reportsTo'] is None:
    del data['reportsTo']
print(json.dumps(data))
")

  local resp
  resp=$(curl -sf -X POST "$API_URL/companies/$COMPANY_ID/agents" \
    "${AUTH_ARGS[@]}" \
    -H "Content-Type: application/json" \
    -d "$payload" 2>&1) || {
    echo "  [FAIL] $name: $resp"
    return
  }

  local agent_id
  agent_id=$(echo "$resp" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id','?'))" 2>/dev/null)
  echo "  [created] $name → $agent_id"
}

# ── Create agents in hierarchy order ─────────────────────────────────────

echo "Creating agents for company $COMPANY_ID..."
echo ""

# Leadership (create first — others report to them)
create_agent "CEO"                "ceo"                "claude-opus-4-6"          "*/30 * * * *"  ""
create_agent "CTO"                "cto"                "claude-sonnet-4-6"        "*/10 * * * *"  "CEO"
create_agent "Project Manager"    "pm"                 "claude-sonnet-4-6"        "*/15 * * * *"  "CEO"

# Dispatcher
create_agent "Dispatcher"         "dispatcher"         "claude-haiku-4-5-20251001" "* * * * *"     "CEO"

# Engineers (report to CTO)
create_agent "Frontend Engineer"  "frontend-engineer"  "claude-haiku-4-5-20251001" "*/5 * * * *"   "CTO"
create_agent "Backend Engineer"   "backend-engineer"   "claude-haiku-4-5-20251001" "*/5 * * * *"   "CTO"
create_agent "SQL Engineer"       "sql-engineer"       "claude-haiku-4-5-20251001" "*/5 * * * *"   "CTO"
create_agent "Security Engineer"  "security-engineer"  "claude-haiku-4-5-20251001" "*/5 * * * *"   "CTO"
create_agent "QA Engineer"        "qa-engineer"        "claude-haiku-4-5-20251001" "*/5 * * * *"   "CTO"
create_agent "DevOps Engineer"    "devops-engineer"    "claude-haiku-4-5-20251001" "*/5 * * * *"   "CTO"

# Specialist (reports to CEO)
create_agent "SEO Specialist"     "seo-specialist"     "claude-haiku-4-5-20251001" "*/5 * * * *"   "CEO"

echo ""
echo "Agent seeding complete."
