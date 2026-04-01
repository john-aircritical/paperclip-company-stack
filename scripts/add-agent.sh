#!/bin/bash
set -e

# ═══════════════════════════════════════════════════════════════════════════════
# Add Agent — Create a new agent (supports the hire flow)
# Usage: ./add-agent.sh --template <role> --name <name> [--reports-to <agent-name>]
# ═══════════════════════════════════════════════════════════════════════════════

API_URL="http://localhost:3101/api"
TOKEN=$(cat /paperclip/.board-token 2>/dev/null)
COMPANY_ID=$(cat /paperclip/.company-id 2>/dev/null)
SECRETS_FILE="/paperclip/.secret-ids.json"

if [ -z "$TOKEN" ] || [ -z "$COMPANY_ID" ]; then
  echo "ERROR: Run setup.sh first"
  exit 1
fi

# Parse arguments
TEMPLATE=""
AGENT_NAME=""
REPORTS_TO=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --template) TEMPLATE="$2"; shift 2 ;;
    --name) AGENT_NAME="$2"; shift 2 ;;
    --reports-to) REPORTS_TO="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

if [ -z "$TEMPLATE" ] || [ -z "$AGENT_NAME" ]; then
  echo "Usage: $0 --template <role> --name <name> [--reports-to <agent-name>]"
  echo ""
  echo "Templates: ceo, cto, pm, dispatcher, frontend-engineer, backend-engineer,"
  echo "           sql-engineer, security-engineer, qa-engineer, seo-specialist, devops-engineer"
  echo ""
  echo "Example: $0 --template backend-engineer --name 'Bob' --reports-to 'CTO'"
  exit 1
fi

# Map template to model
declare -A MODELS=(
  ["ceo"]="claude-opus-4-6"
  ["cto"]="claude-sonnet-4-6"
  ["pm"]="claude-sonnet-4-6"
  ["dispatcher"]="claude-haiku-4-5-20251001"
  ["frontend-engineer"]="claude-haiku-4-5-20251001"
  ["backend-engineer"]="claude-haiku-4-5-20251001"
  ["sql-engineer"]="claude-haiku-4-5-20251001"
  ["security-engineer"]="claude-haiku-4-5-20251001"
  ["qa-engineer"]="claude-haiku-4-5-20251001"
  ["seo-specialist"]="claude-haiku-4-5-20251001"
  ["devops-engineer"]="claude-haiku-4-5-20251001"
)

MODEL="${MODELS[$TEMPLATE]}"
if [ -z "$MODEL" ]; then
  echo "ERROR: Unknown template: $TEMPLATE"
  exit 1
fi

# Get Anthropic secret ID
ANTHROPIC_SECRET_ID=$(python3 -c "
import json
with open('$SECRETS_FILE') as f:
    print(json.load(f).get('anthropic-api-key', ''))
" 2>/dev/null)

# Look up reports_to agent ID
REPORTS_TO_ID=""
if [ -n "$REPORTS_TO" ]; then
  REPORTS_TO_ID=$(curl -sf "$API_URL/v1/companies/$COMPANY_ID/agents" \
    -H "Authorization: Bearer $TOKEN" 2>/dev/null | \
    python3 -c "
import sys, json
agents = json.load(sys.stdin)
for a in agents:
    if a.get('name') == '$REPORTS_TO':
        print(a['id'])
        break
" 2>/dev/null)
fi

# Build payload
PAYLOAD=$(python3 -c "
import json
data = {
    'name': '$AGENT_NAME',
    'adapter': {
        'type': 'claude_local',
        'command': 'headroom wrap claude',
        'model': '$MODEL',
        'env': {
            'ANTHROPIC_API_KEY': {
                'type': 'secret_ref',
                'secretId': '$ANTHROPIC_SECRET_ID',
                'version': 'latest'
            }
        }
    },
    'heartbeat': {'schedule': '*/5 * * * *'},
    'instructionsDir': '/app/company/agents/$TEMPLATE'
}
if '$REPORTS_TO_ID':
    data['reportsTo'] = '$REPORTS_TO_ID'
print(json.dumps(data))
")

resp=$(curl -sf -X POST "$API_URL/v1/companies/$COMPANY_ID/agents" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" 2>&1) || {
  echo "ERROR: Failed to create agent: $resp"
  exit 1
}

AGENT_ID=$(echo "$resp" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id','?'))" 2>/dev/null)
echo "Agent created: $AGENT_NAME → $AGENT_ID (template: $TEMPLATE, model: $MODEL)"
