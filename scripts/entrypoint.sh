#!/bin/bash
set -e

# ── UID/GID adjustment (from upstream Paperclip entrypoint) ──────────────

PUID=${USER_UID:-1000}
PGID=${USER_GID:-1000}

changed=0

if [ "$(id -u node)" -ne "$PUID" ]; then
    echo "Updating node UID to $PUID"
    usermod -o -u "$PUID" node
    changed=1
fi

if [ "$(id -g node)" -ne "$PGID" ]; then
    echo "Updating node GID to $PGID"
    groupmod -o -g "$PGID" node
    usermod -g "$PGID" node
    changed=1
fi

if [ "$changed" = "1" ]; then
    chown -R node:node /paperclip /home/node
fi

# ── Start Paperclip server ───────────────────────────────────────────────

echo "Starting Paperclip server..."
gosu node node --import ./server/node_modules/tsx/dist/loader.mjs server/dist/index.js &
PAPERCLIP_PID=$!

# Wait for Paperclip to be healthy
echo "Waiting for Paperclip to be ready..."
for i in $(seq 1 60); do
  if curl -sf http://localhost:3101/api/health > /dev/null 2>&1; then
    echo "Paperclip server ready"
    break
  fi
  if [ "$i" = "60" ]; then
    echo "ERROR: Paperclip server failed to start within 60 seconds"
    exit 1
  fi
  sleep 1
done

# ── headroom wrap claude handles EVERYTHING ──────────────────────────────
#   1. Starts Headroom proxy on :8787 (background)
#   2. Downloads and installs RTK binary (if missing)
#   3. Registers RTK hooks in Claude Code settings
#   4. Sets ANTHROPIC_BASE_URL=http://127.0.0.1:8787
#   5. Registers Headroom MCP (compress/retrieve/stats)
#   6. Launches Claude Code with full compression active
#
# No separate RTK install, no separate proxy service, no manual hook setup.
# Paperclip's claude_local adapter will use this wrapped Claude Code.

# Keep container alive — wait for Paperclip
echo "Stack ready. Paperclip UI at :3101"
wait $PAPERCLIP_PID
