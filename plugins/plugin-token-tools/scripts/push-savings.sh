#!/usr/bin/env bash
# Fetches savings data from claude-tools-dashboard (:3102) and pushes to Paperclip plugin webhook.
# Usage: ./push-savings.sh [window_seconds]
#   window_seconds: optional time window (default: 0 = all time)
# Can be run via cron: */1 * * * * /home/john/paperclip-plugins/plugin-token-tools/scripts/push-savings.sh

set -euo pipefail

DASHBOARD_URL="http://localhost:3102/json"
WEBHOOK_URL="http://192.168.2.176:3101/api/plugins/68027b1a-2591-4ef8-81c4-188a3bb04f7f/webhooks/token-ingest"
WINDOW="${1:-0}"

# Fetch from dashboard
RAW=$(python3 -c "
import urllib.request, json, sys
url = '${DASHBOARD_URL}' + ('?window=${WINDOW}' if ${WINDOW} > 0 else '')
resp = urllib.request.urlopen(url)
d = json.loads(resp.read())

# Build savings payload
tools = []
for name in ['rtk', 'headroom', 'jcodemunch', 'jdocmunch']:
    t = d.get(name)
    if not t or not isinstance(t, dict):
        continue
    tools.append({
        'tool': name,
        'active': t.get('active', False),
        'totalSaved': t.get('total_saved', 0),
        'avgSavingsPct': t.get('avg_savings_pct', 0),
        'history': [
            {
                'time': h.get('time', ''),
                'savedTokens': h.get('saved_tokens', 0),
                'savedPct': h.get('saved_pct', 0),
                'cmd': h.get('cmd', ''),
            }
            for h in t.get('history', [])
        ],
        'extra': {k: v for k, v in t.items() if k not in ('active', 'total_saved', 'avg_savings_pct', 'history')},
    })

payload = {
    'type': 'ccusage-sync',
    'savings': {
        'combinedSaved': d.get('combined_saved', 0),
        'tools': tools,
        'collectedAt': __import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat(),
    },
}

print(json.dumps(payload))
")

# Push to webhook
curl -s -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d "$RAW"
