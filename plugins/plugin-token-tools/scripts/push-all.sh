#!/usr/bin/env bash
# Combined push: usage bars + savings data to Paperclip plugin webhook.
# Run via cron every minute: * * * * * /home/john/paperclip-plugins/plugin-token-tools/scripts/push-all.sh
set -euo pipefail

DASHBOARD_URL="http://localhost:3102/json"
WEBHOOK_URL="http://192.168.2.176:3101/api/plugins/68027b1a-2591-4ef8-81c4-188a3bb04f7f/webhooks/token-ingest"

RAW=$(python3 -c "
import urllib.request, json, datetime

resp = urllib.request.urlopen('${DASHBOARD_URL}')
d = json.loads(resp.read())
now = datetime.datetime.now(datetime.timezone.utc).isoformat()

# Build savings
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
            {'time': h.get('time',''), 'savedTokens': h.get('saved_tokens',0), 'savedPct': h.get('saved_pct',0), 'cmd': h.get('cmd','')}
            for h in t.get('history', [])
        ],
    })

# Build usage bars from claude_usage if available
usage = d.get('claude_usage', {})
bars = []
if isinstance(usage, dict) and usage.get('active'):
    # The dashboard app has usage data; for now, usage bars must be pushed separately
    # or computed from the Anthropic API. This script focuses on savings.
    pass

payload = {
    'type': 'ccusage-sync',
    'savings': {
        'combinedSaved': d.get('combined_saved', 0),
        'tools': tools,
        'collectedAt': now,
    },
}
print(json.dumps(payload))
")

curl -s -X POST "$WEBHOOK_URL" -H "Content-Type: application/json" -d "$RAW" > /dev/null
