#!/bin/bash
set -e

# ═══════════════════════════════════════════════════════════════════════════════
# Paperclip Company Stack — Container Entrypoint
#
# First run: start authenticated, create admin, provision company+agents
# Subsequent runs: just start Paperclip
# ═══════════════════════════════════════════════════════════════════════════════

SENTINEL="/paperclip/.setup-complete"
INSTANCE_DIR="/paperclip/instances/default"
PCLIP_PORT="${PORT:-9000}"

# ── UID/GID adjustment ──────────────────────────────────────────────────

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

# ── Helper: write config.json ──────────────────────────────────────────

write_config() {
  local mode="$1"
  local host="$2"
  local port="${3:-9000}"

  mkdir -p "$INSTANCE_DIR/secrets" "$INSTANCE_DIR/data/backups" "$INSTANCE_DIR/data/storage" "$INSTANCE_DIR/logs"
  local NOW
  NOW=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)
  cat > "$INSTANCE_DIR/config.json" <<CONF
{
  "\$meta": {
    "version": 1,
    "updatedAt": "${NOW}",
    "source": "configure"
  },
  "database": {
    "mode": "embedded-postgres",
    "embeddedPostgresDataDir": "/paperclip/instances/default/db",
    "embeddedPostgresPort": 54329,
    "backup": {
      "enabled": true,
      "intervalMinutes": 60,
      "retentionDays": 30,
      "dir": "/paperclip/instances/default/data/backups"
    }
  },
  "logging": {
    "mode": "file",
    "logDir": "/paperclip/instances/default/logs"
  },
  "server": {
    "deploymentMode": "${mode}",
    "exposure": "private",
    "host": "${host}",
    "port": ${port},
    "serveUi": true
  },
  "auth": {
    "baseUrlMode": "auto",
    "disableSignUp": false
  },
  "storage": {
    "provider": "local_disk",
    "localDisk": {
      "baseDir": "/paperclip/instances/default/data/storage"
    }
  },
  "secrets": {
    "provider": "local_encrypted",
    "strictMode": false,
    "localEncrypted": {
      "keyFilePath": "/paperclip/instances/default/secrets/master.key"
    }
  }
}
CONF
  chown -R node:node "$INSTANCE_DIR"
}

# ── Helper: wait for Paperclip healthy ─────────────────────────────────

wait_for_healthy() {
  local port="${1:-9000}"
  local max="${2:-90}"
  echo "Waiting for Paperclip on :${port}..."
  for i in $(seq 1 "$max"); do
    if curl -sf "http://localhost:${port}/api/health" > /dev/null 2>&1; then
      echo "Paperclip ready on :${port}"
      return 0
    fi
    if [ "$i" = "$max" ]; then
      echo "ERROR: Paperclip failed to start within ${max} seconds"
      return 1
    fi
    sleep 1
  done
}

# ═══════════════════════════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════════════════════════

# ── Extract OAuth token from credentials file ──────────────────────────
CREDS_FILE="/home/node/.claude/.credentials.json"
if [ -f "$CREDS_FILE" ]; then
  OAUTH_TOKEN=$(python3 -c "import json; print(json.load(open('$CREDS_FILE'))['claudeAiOauth']['accessToken'])" 2>/dev/null || true)
  if [ -n "$OAUTH_TOKEN" ]; then
    export ANTHROPIC_AUTH_TOKEN="$OAUTH_TOKEN"
    echo "Claude OAuth token loaded from credentials file"
  fi
fi

if [ -f "$SENTINEL" ]; then
  echo "Starting Paperclip (already provisioned)..."
  exec gosu node pnpm paperclipai run
fi

# ══════════════════════════════════════════════════════════════════════════
# FIRST RUN
# ══════════════════════════════════════════════════════════════════════════

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  First Run — Provisioning Paperclip Company Stack       ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# ── Start in authenticated mode ────────────────────────────────────────

write_config "authenticated" "0.0.0.0" "$PCLIP_PORT"
echo "Config written (authenticated, 0.0.0.0:${PCLIP_PORT})"

echo "Starting Paperclip..."
STARTUP_LOG="/tmp/paperclip-startup.log"
gosu node pnpm paperclipai run 2>&1 | tee "$STARTUP_LOG" &
PAPERCLIP_PID=$!

wait_for_healthy "$PCLIP_PORT" || exit 1

# Extract bootstrap token from startup output
BOOTSTRAP_TOKEN=$(grep -o 'pcp_bootstrap_[a-f0-9]*' "$STARTUP_LOG" | head -1 || true)
if [ -n "$BOOTSTRAP_TOKEN" ]; then
  echo "Bootstrap token captured: ${BOOTSTRAP_TOKEN:0:25}..."
  echo "$BOOTSTRAP_TOKEN" > /paperclip/.bootstrap-token
fi

# ── Create admin account and provision ─────────────────────────────────

export ADMIN_NAME="${ADMIN_NAME:-Admin}"
export ADMIN_EMAIL="${ADMIN_EMAIL:-admin@paperclip.local}"
export ADMIN_PASSWORD="${ADMIN_PASSWORD:-paperclip-admin-2026}"
export COMPANY_NAME="${COMPANY_NAME:-AI Company}"
export PCLIP_PORT

echo "Creating admin account and provisioning..."
if gosu node node /app/scripts/provision.cjs; then
  echo "Provisioning complete."
else
  echo "ERROR: Provisioning failed. Check logs above."
  echo "The server is still running — you can provision manually through the UI."
fi

# ── Done ───────────────────────────────────────────────────────────────

touch "$SENTINEL"

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  Setup Complete!                                        ║"
echo "║                                                         ║"
echo "║  Paperclip UI: http://localhost:${PCLIP_PORT}"
echo "║  Login: ${ADMIN_EMAIL}"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

wait $PAPERCLIP_PID
