# Paperclip Company Stack

Portable Docker stack: Paperclip AI orchestration + Claude Code agents with full token compression toolchain, emotion-driven behavior, and self-improvement.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    paperclip-company-stack                       │
│                                                                 │
│  ┌──────────────────────┐  ┌──────────────────────────────────┐ │
│  │  Paperclip Server    │  │  Claude Code Agent Runtime       │ │
│  │  :3101               │  │                                  │ │
│  │  ┌────────────────┐  │  │  headroom wrap claude            │ │
│  │  │ Embedded       │  │  │    ├─ Headroom Proxy (:8787)     │ │
│  │  │ PostgreSQL     │  │  │    ├─ RTK (auto-installed)       │ │
│  │  │ :54329         │  │  │    ├─ RTK hooks (auto-registered)│ │
│  │  └────────────────┘  │  │    ├─ Headroom MCP (3 tools)     │ │
│  │                      │  │    └─ ANTHROPIC_BASE_URL (auto)  │ │
│  │  Plugin: Emotion     │  │                                  │ │
│  │  Plugin: Token Tools │  │  CLAUDE.md (laws, read-only)     │ │
│  └──────────────────────┘  │  Agent Files (per-agent)         │ │
│                             │  Skills (on-demand)              │ │
│                             └──────────────────────────────────┘ │
│                                                                 │
│  Volumes:                                                       │
│    paperclip-data → /paperclip (DB, secrets, workspaces)        │
│    claude-home → /home/node/.claude (auth, settings)            │
│    ./CLAUDE.md → /app/CLAUDE.md:ro (bind mount, updatable)      │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Anthropic API key (subscription plan)

### Setup

```bash
git clone https://github.com/john-aircritical/paperclip-company-stack.git
cd paperclip-company-stack
cp .env.example .env
# Edit .env with your API keys

docker compose build
docker compose up -d
docker compose exec stack /app/setup.sh
```

The setup script walks through:
1. Claude Code authentication
2. Board claim (Paperclip auth via browser)
3. Company creation
4. Secret storage (API keys → Paperclip secrets)
5. Agent creation (11 agents)
6. Plugin installation (emotion engine + token tools)
7. Company goal setting

## Org Chart

```
Board (You)
│
├─ CEO (Opus) ─── Strategic planning, goal decomposition
│   ├─ CTO (Sonnet) ─── Technical leadership, code review
│   │   ├─ Frontend Engineer (Haiku)
│   │   ├─ Backend Engineer (Haiku)
│   │   ├─ SQL Engineer (Haiku)
│   │   ├─ DevOps Engineer (Haiku)
│   │   ├─ Security Engineer (Haiku)
│   │   └─ QA Engineer (Haiku)
│   ├─ Project Manager (Sonnet) ─── Failsafe patrol
│   └─ SEO Specialist (Haiku)
│
└─ Dispatcher (Haiku) ─── Routes new issues to correct agent
```

## Ports

| Port | Service | Access |
|------|---------|--------|
| 3101 | Paperclip UI & API | Exposed |
| 3102 | Token Dashboard | Exposed |
| 8787 | Headroom Proxy | Internal only |
| 54329 | Embedded PostgreSQL | Internal only |

## Volumes

| Volume | Mount | Purpose |
|--------|-------|---------|
| `paperclip-data` | `/paperclip` | All Paperclip state, DB, secrets |
| `claude-home` | `/home/node/.claude` | Claude Code auth, settings |
| `./CLAUDE.md` | `/app/CLAUDE.md:ro` | Master laws (bind mount) |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key |
| `BETTER_AUTH_SECRET` | Yes | Random 32-char string for auth |
| `OPENAI_API_KEY` | No | For embeddings/additional models |
| `GOOGLE_API_KEY` | No | For Gemini models |
| `GITHUB_API_KEY` | No | For GitHub integration |
| `PAPERCLIP_PORT` | No | Default: 3101 |
| `DASHBOARD_PORT` | No | Default: 3102 |
| `PAPERCLIP_PUBLIC_URL` | No | Default: http://localhost:3101 |
| `USER_UID` / `USER_GID` | No | Default: 1000 |

## Compression Stack

All agents run through `headroom wrap claude`, which provides:

- **RTK** — Strips noise from bash command output (60-90% savings)
- **Headroom Proxy** — Compresses API context (20-40% savings)
- **Headroom MCP** — 3 tools: `headroom_compress`, `headroom_retrieve`, `headroom_stats`

Zero manual MCP configuration. Everything is auto-registered.

## Emotion Engine

Persistent emotional states for each agent:
- 9 emotions: frustration, curiosity, satisfaction, motivation, anxiety, calm, trust, insecurity, surprise
- 4 personality presets: driven, cautious, curious, steady
- Threshold events: frustration_high, overwork_detected, spiral_detected, flow_state
- Overwork detection triggers dynamic hiring flow

## Scripts

| Script | Purpose |
|--------|---------|
| `setup.sh` | First-run interactive setup |
| `scripts/seed-company.sh` | Create all 11 agents |
| `scripts/install-plugins.sh` | Install both plugins |
| `scripts/install-skills.sh` | Pre-bake skill placeholders |
| `scripts/add-secret.sh` | Add a new secret |
| `scripts/add-agent.sh` | Add a new agent (hire flow) |
| `scripts/entrypoint.sh` | Container entrypoint |

## Operations

```bash
# View logs
docker compose logs -f

# Re-run setup (after clearing sentinel)
docker compose exec stack rm /paperclip/.setup-complete
docker compose exec stack /app/setup.sh

# Add a new secret
docker compose exec stack /app/scripts/add-secret.sh "my-key" "value"

# Hire a new agent
docker compose exec stack /app/scripts/add-agent.sh \
  --template backend-engineer --name "Bob" --reports-to "CTO"

# Update CLAUDE.md laws (hot reload — no rebuild needed)
# Edit CLAUDE.md locally, changes reflected immediately via bind mount

# Full rebuild (after code changes)
docker compose build && docker compose up -d
```

## Troubleshooting

**Paperclip not starting:** Check `docker compose logs stack`. Ensure `BETTER_AUTH_SECRET` is set in `.env`.

**Agents not running:** Verify Claude Code auth: `docker compose exec stack claude auth status`. Re-auth with `claude auth login`.

**Headroom proxy not healthy:** Check `:8787` inside the container. The proxy auto-starts with each `headroom wrap claude` session.

**Plugin install fails:** Install manually via Paperclip UI → Settings → Plugins. Enter the npm package name.
