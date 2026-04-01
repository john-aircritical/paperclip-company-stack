# Paperclip Company Stack

Portable Docker stack that runs [Paperclip AI](https://paperclip.ing) with 11 pre-configured Claude Code agents, an emotion engine, token compression toolchain, and fully automated first-run provisioning.

One command. Agents ready in 90 seconds.

## What You Get

- **11 AI agents** with roles, personalities, and reporting hierarchy
- **Automated setup** — company, admin account, secrets, agents, and plugins provisioned on first boot
- **Claude Max/Pro subscription auth** — no API key needed, uses your existing Claude account
- **Emotion engine plugin** — persistent emotional states that influence agent behavior
- **Token tools plugin** — usage tracking and compression savings dashboard
- **Headroom compression** — RTK + Headroom proxy for 60-90% token savings

## Prerequisites

- Docker and Docker Compose
- Claude Code CLI installed and authenticated on the **host** machine (`claude login`)
- A Claude Max or Pro subscription (or an Anthropic API key)

## Quick Start

```bash
git clone https://github.com/john-aircritical/paperclip-company-stack.git
cd paperclip-company-stack

# 1. Configure environment
cp .env.example .env
# Edit .env — at minimum set ANTHROPIC_API_KEY and BETTER_AUTH_SECRET

# 2. Build and run
docker compose up --build -d

# 3. Watch provisioning (first run takes ~90 seconds)
docker compose logs -f
```

When you see "Setup Complete!", open http://localhost:9000 and log in with the credentials from your `.env` file (defaults: `admin@paperclip.local` / `paperclip-admin-2026`).

## Claude Code Authentication (Critical)

Agents run Claude Code inside the container. Claude Code needs to authenticate with Anthropic. There are two methods:

### Method 1: Subscription Auth (Recommended)

Uses your existing Claude Max/Pro subscription. No API key billing.

**Step 1:** Make sure Claude Code is authenticated on your **host** machine:

```bash
claude login          # if not already logged in
claude auth status    # should show loggedIn: true, subscriptionType: max/pro
```

**Step 2:** The `docker-compose.yml` bind-mounts your host credentials into the container:

```yaml
volumes:
  - ~/.claude/.credentials.json:/paperclip/.claude/.credentials.json:ro
```

This happens automatically. The container's `HOME` directory is `/paperclip`, so Claude Code inside the container looks for credentials at `/paperclip/.claude/.credentials.json`.

**Step 3:** Verify it works inside the container:

```bash
docker exec -u node <container> claude auth status
```

Should show `loggedIn: true`.

**Why `/paperclip/.claude/` and not `/home/node/.claude/`?**

The Paperclip base image sets `HOME=/paperclip` (where all Paperclip data lives). Claude Code resolves `~/.claude/` relative to `HOME`, so credentials must be at `/paperclip/.claude/.credentials.json`. Mounting to `/home/node/.claude/` will NOT work.

**Token refresh:** The credentials file contains an OAuth refresh token. Claude Code refreshes the access token automatically. If auth stops working, re-run `claude login` on the host — the updated credentials file is bind-mounted read-only, so the container picks up changes on next agent run.

### Method 2: API Key Auth

If you prefer API key billing, set `ANTHROPIC_API_KEY` in your `.env` to a real key (not `sk-ant-test`). The provisioning script stores it as an encrypted Paperclip secret. Agents receive it at runtime via `secret_ref` in their adapter config.

Note: if `ANTHROPIC_API_KEY` is present in the container environment, Claude Code uses it instead of subscription auth. The entrypoint explicitly unsets it to avoid this — API keys are only used during provisioning to store as Paperclip secrets.

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | Yes | — | Stored as Paperclip secret during provisioning |
| `BETTER_AUTH_SECRET` | Yes | — | Random 32+ char string for session signing |
| `OPENAI_API_KEY` | No | — | For embeddings or additional models |
| `GOOGLE_API_KEY` | No | — | For Gemini models |
| `GITHUB_API_KEY` | No | — | For GitHub integration |
| `COMPANY_NAME` | No | `AI Company` | Company name in Paperclip |
| `ADMIN_NAME` | No | `Admin` | Admin user display name |
| `ADMIN_EMAIL` | No | `admin@paperclip.local` | Admin login email |
| `ADMIN_PASSWORD` | No | `paperclip-admin-2026` | Admin login password |
| `PAPERCLIP_PORT` | No | `9000` | Host port mapping |
| `USER_UID` / `USER_GID` | No | `1000` | Match host file permissions |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Docker Container                              │
│                                                                 │
│  ┌──────────────────────┐  ┌──────────────────────────────────┐ │
│  │  Paperclip Server    │  │  Claude Code Agent Runtime       │ │
│  │  :9000               │  │                                  │ │
│  │  ┌────────────────┐  │  │  headroom wrap claude            │ │
│  │  │ Embedded       │  │  │    ├─ Headroom Proxy (:8787)     │ │
│  │  │ PostgreSQL     │  │  │    ├─ RTK (auto-installed)       │ │
│  │  │ :54329         │  │  │    ├─ Headroom MCP (3 tools)     │ │
│  │  └────────────────┘  │  │    └─ ANTHROPIC_BASE_URL (auto)  │ │
│  │                      │  │                                  │ │
│  │  Plugin: Emotion     │  │  CLAUDE.md (master laws)         │ │
│  │  Plugin: Token Tools │  │  Agent instructions (per-role)   │ │
│  └──────────────────────┘  └──────────────────────────────────┘ │
│                                                                 │
│  Volumes:                                                       │
│    paperclip-data → /paperclip (DB, secrets, workspaces)        │
│    claude-home → /home/node/.claude (settings)                  │
│    ~/.claude/.credentials.json → /paperclip/.claude/ (auth)     │
│    ./CLAUDE.md → /app/CLAUDE.md:ro (updatable without rebuild)  │
└─────────────────────────────────────────────────────────────────┘
```

## First-Run Provisioning Flow

On first boot (when `/paperclip/.setup-complete` doesn't exist), the entrypoint automatically:

1. **Writes config** — authenticated mode, embedded PostgreSQL, 0.0.0.0 binding
2. **Starts Paperclip** — runs `paperclipai run`, waits for healthy
3. **Captures bootstrap token** — extracted from Paperclip's startup log
4. **Signs up admin** — creates account via Better Auth API
5. **Accepts bootstrap invite** — promotes admin to instance admin
6. **Creates company** — uses the company name from env vars
7. **Stores API secrets** — encrypts and stores all `PROVISION_*` API keys
8. **Seeds 11 agents** — creates each agent with correct model, adapter, and hierarchy
9. **Installs plugins** — emotion engine and token tools
10. **Touches sentinel** — marks setup complete, subsequent boots skip straight to start

## Org Chart

```
Board (You)
│
├─ CEO (claude-opus-4-6) ─── Strategic planning, goal decomposition
│   ├─ CTO (claude-sonnet-4-6) ─── Technical leadership, code review
│   │   ├─ Frontend Engineer (claude-haiku-4-5)
│   │   ├─ Backend Engineer (claude-haiku-4-5)
│   │   ├─ SQL Engineer (claude-haiku-4-5)
│   │   ├─ DevOps Engineer (claude-haiku-4-5)
│   │   ├─ Security Engineer (claude-haiku-4-5)
│   │   └─ QA Engineer (claude-haiku-4-5)
│   │
│   ├─ Project Manager (claude-sonnet-4-6) ─── Failsafe patrol
│   └─ SEO Specialist (claude-haiku-4-5)
│
└─ Dispatcher (claude-haiku-4-5) ─── Routes new issues to correct agent
```

## Agent Configuration

Each agent has 5 instruction files in `company/agents/<role>/`:

| File | Purpose |
|------|---------|
| `AGENTS.md` | Role description, task handling, escalation rules |
| `SOUL.md` | Emotional profile, personality preset, behavioral triggers |
| `HEARTBEAT.md` | Execution loop (fetch issues, execute, report) |
| `TOOLS.md` | Available tools, skills, compression stack |
| `FINDINGS.md` | Institutional knowledge log (cumulative, never deleted) |

Agents use the `claude_local` adapter type with `headroom wrap claude` as the command, which wraps every Claude Code invocation with the Headroom compression proxy.

## Plugins

### Emotion Engine

Persistent emotional states for each agent across 9 dimensions:

- frustration, curiosity, satisfaction, motivation, anxiety, calm, trust, insecurity, surprise

4 personality presets (driven, cautious, curious, steady) control how emotions shift. Threshold events trigger automatic behaviors:

- `frustration_high` → simplify approach or escalate
- `overwork_detected` → trigger hiring flow
- `spiral_detected` → reassign tasks
- `flow_state` → optimal performance, don't interrupt

### Token Tools

Dashboard showing:

- Token usage per agent and model
- Rate limit pacing (over/under budget)
- Compression savings by tool (RTK, Headroom, jCodeMunch, jDocMunch)
- Daily cost tracking

## Compression Stack

All agents run through `headroom wrap claude`, providing:

| Tool | What It Does | Savings |
|------|-------------|---------|
| **RTK** | Strips noise from bash output | 60-90% |
| **Headroom Proxy** | Compresses API context | 20-40% |
| **Headroom MCP** | Manual compress/retrieve/stats tools | Variable |

Zero configuration required — everything is auto-registered when `headroom wrap claude` runs.

## Ports

| Port | Service | Access |
|------|---------|--------|
| 9000 | Paperclip UI and API | Exposed (configurable via `PAPERCLIP_PORT`) |
| 8787 | Headroom Proxy | Internal only |
| 54329 | Embedded PostgreSQL | Internal only |

## Volumes

| Volume | Mount | Purpose |
|--------|-------|---------|
| `paperclip-data` | `/paperclip` | All Paperclip state, DB, secrets, workspaces |
| `claude-home` | `/home/node/.claude` | Claude Code settings |
| Bind mount | `/paperclip/.claude/.credentials.json` | Host Claude auth (read-only) |
| Bind mount | `/app/CLAUDE.md` | Master laws (read-only, hot-reloadable) |

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/entrypoint.sh` | Container entrypoint with auto-provisioning |
| `scripts/provision.cjs` | Creates company, stores secrets, seeds agents |
| `scripts/seed-company.sh` | Creates all 11 agents via Paperclip API |
| `scripts/install-plugins.sh` | Registers both plugins |
| `scripts/add-agent.sh` | Add a new agent post-setup (hire flow) |
| `scripts/add-secret.sh` | Store a new secret in Paperclip |
| `setup.sh` | Legacy interactive setup (use auto-provisioning instead) |

## Operations

```bash
# View logs
docker compose logs -f

# Check agent auth
docker exec -u node paperclip-company-stack-stack-1 claude auth status

# Add a new secret
docker compose exec -u node stack /app/scripts/add-secret.sh "my-key" "sk-..."

# Hire a new agent
docker compose exec -u node stack /app/scripts/add-agent.sh \
  --template backend-engineer --name "Bob" --reports-to "CTO"

# Update master laws (no rebuild needed — bind mount)
vim CLAUDE.md

# Re-provision from scratch
docker compose down -v
docker compose up --build -d

# Rebuild after code changes
docker compose up --build -d
```

## Troubleshooting

### "Not logged in" / agents can't authenticate

Claude Code inside the container can't find credentials. Check:

```bash
# Is the credentials file mounted?
docker exec -u node <container> ls -la /paperclip/.claude/.credentials.json

# Is Claude logged in?
docker exec -u node <container> claude auth status

# Is ANTHROPIC_API_KEY leaking into the env? (should NOT be set)
docker exec -u node <container> env | grep ANTHROPIC_API_KEY
```

If credentials are missing, make sure you're logged in on the host (`claude login`) and that `~/.claude/.credentials.json` exists.

### "Board mutation requires trusted browser origin"

API calls need `Origin` and `Referer` headers matching the Paperclip server URL. This is handled automatically by the provisioning scripts. If you're making manual API calls, include:

```
-H "Origin: http://localhost:9000" -H "Referer: http://localhost:9000/"
```

### "Instance admin required"

The bootstrap invite wasn't accepted. The entrypoint captures the bootstrap token from Paperclip's startup log and accepts it automatically. If this fails:

1. Check logs for `pcp_bootstrap_...` token
2. Visit the invite URL in your browser manually
3. Or re-provision: `docker compose down -v && docker compose up --build -d`

### Paperclip not starting

```bash
docker compose logs -f
```

Common causes:
- `BETTER_AUTH_SECRET` not set in `.env`
- Port 9000 already in use (change `PAPERCLIP_PORT` in `.env`)
- Stale PostgreSQL lock file (auto-cleaned on restart)

### Agents not running heartbeats

1. Check the agent is not paused in Paperclip UI
2. Verify Claude auth: `docker exec -u node <container> claude auth status`
3. Check agent adapter config has correct `cwd` and `model`
4. Look at agent run logs in Paperclip UI → Activity

## Project Structure

```
paperclip-company-stack/
├── .env.example              # Environment template
├── CLAUDE.md                 # Master laws for all agents
├── Dockerfile                # Multi-stage: build plugins → extend paperclip-base
├── docker-compose.yml        # Service definition, volumes, env
├── company/
│   └── agents/
│       ├── ceo/              # CEO instructions (Opus)
│       ├── cto/              # CTO instructions (Sonnet)
│       ├── pm/               # Project Manager (Sonnet)
│       ├── dispatcher/       # Issue router (Haiku)
│       ├── frontend-engineer/
│       ├── backend-engineer/
│       ├── sql-engineer/
│       ├── security-engineer/
│       ├── qa-engineer/
│       ├── seo-specialist/
│       └── devops-engineer/
├── plugins/
│   ├── plugin-emotion-engine/  # Emotional states and personality
│   └── plugin-token-tools/     # Usage tracking and compression stats
└── scripts/
    ├── entrypoint.sh           # Container init + auto-provisioning
    ├── provision.cjs           # First-run provisioning logic
    ├── seed-company.sh         # Creates 11 agents
    ├── install-plugins.sh      # Registers plugins
    ├── add-agent.sh            # Dynamic agent creation
    └── add-secret.sh           # Secret management
```

## License

Private.
