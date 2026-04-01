#!/bin/bash
set -e

# ═══════════════════════════════════════════════════════════════════════════════
# Add Secret — Store a new secret in Paperclip
# Usage: ./add-secret.sh <name> <value>
# ═══════════════════════════════════════════════════════════════════════════════

API_URL="http://localhost:3101/api"
TOKEN=$(cat /paperclip/.board-token 2>/dev/null)

if [ -z "$TOKEN" ]; then
  echo "ERROR: Run setup.sh first (missing token)"
  exit 1
fi

NAME="$1"
VALUE="$2"

if [ -z "$NAME" ] || [ -z "$VALUE" ]; then
  echo "Usage: $0 <secret-name> <secret-value>"
  echo "Example: $0 my-api-key sk-abc123..."
  exit 1
fi

resp=$(curl -sf -X POST "$API_URL/v1/secrets" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\": \"$NAME\", \"value\": \"$VALUE\"}" 2>&1) || {
  echo "ERROR: Failed to store secret: $resp"
  exit 1
}

SID=$(echo "$resp" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null)
echo "Secret stored: $NAME → $SID"

# Update local secrets registry
SECRETS_FILE="/paperclip/.secret-ids.json"
if [ -f "$SECRETS_FILE" ]; then
  python3 -c "
import json
with open('$SECRETS_FILE') as f:
    d = json.load(f)
d['$NAME'] = '$SID'
with open('$SECRETS_FILE', 'w') as f:
    json.dump(d, f, indent=2)
"
  echo "Updated $SECRETS_FILE"
fi
