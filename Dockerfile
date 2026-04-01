# Stage 1: Build plugins
FROM node:lts-trixie-slim AS plugin-builder
WORKDIR /build

# Copy plugin source
COPY plugins/ ./plugins/

# Build emotion engine plugin
WORKDIR /build/plugins/plugin-emotion-engine
RUN npm install && npm run build

# Build token tools plugin
WORKDIR /build/plugins/plugin-token-tools
RUN npm install && npm run build

# Stage 2: Extend Paperclip image
FROM paperclip-base AS production
# Note: paperclip-base is built from upstream Paperclip Dockerfile
# which already includes: Node.js, Claude Code, Codex, git, ripgrep, gh CLI

# Install Python (for Headroom)
RUN apt-get update && apt-get install -y python3-venv python3-pip && \
    rm -rf /var/lib/apt/lists/*

USER node

# Install Headroom (includes RTK auto-install + Headroom MCP + proxy)
# This is the ONLY compression tool we need to install.
# `headroom wrap claude` handles everything:
#   - Downloads and installs RTK binary automatically
#   - Registers RTK hooks in Claude Code settings
#   - Starts Headroom proxy on :8787
#   - Sets ANTHROPIC_BASE_URL
#   - Registers Headroom MCP (compress/retrieve/stats)
RUN python3 -m venv /home/node/.headroom-venv && \
    /home/node/.headroom-venv/bin/pip install headroom-ai && \
    ln -sf /home/node/.headroom-venv/bin/headroom /home/node/.local/bin/headroom

# Copy master CLAUDE.md
COPY --chown=node:node CLAUDE.md /home/node/.claude/CLAUDE.md

# Copy built plugins
COPY --from=plugin-builder --chown=node:node /build/plugins/plugin-emotion-engine/dist /app/plugins/plugin-emotion-engine/dist
COPY --from=plugin-builder --chown=node:node /build/plugins/plugin-emotion-engine/package.json /app/plugins/plugin-emotion-engine/package.json
COPY --from=plugin-builder --chown=node:node /build/plugins/plugin-token-tools/dist /app/plugins/plugin-token-tools/dist
COPY --from=plugin-builder --chown=node:node /build/plugins/plugin-token-tools/package.json /app/plugins/plugin-token-tools/package.json

# Copy company templates
COPY --chown=node:node company/ /app/company/

# Copy setup and seed scripts
COPY --chown=node:node scripts/ /app/scripts/
COPY --chown=node:node setup.sh /app/setup.sh
RUN chmod +x /app/setup.sh /app/scripts/*.sh

# Ensure PATH includes local bin
ENV PATH="/home/node/.local/bin:/home/node/.headroom-venv/bin:$PATH"

# Entrypoint script starts Paperclip + headroom wrap claude
COPY --chown=node:node scripts/entrypoint.sh /usr/local/bin/stack-entrypoint.sh
RUN chmod +x /usr/local/bin/stack-entrypoint.sh

USER root
ENTRYPOINT ["/usr/local/bin/stack-entrypoint.sh"]
