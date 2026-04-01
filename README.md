# Paperclip Company Stack

Portable Docker stack: Paperclip AI orchestration + Claude Code agents with full token compression toolchain, emotion-driven behavior, and self-improvement.

## Quick Start

```bash
git clone https://github.com/john-aircritical/paperclip-company-stack.git
cd paperclip-company-stack
cp .env.example .env
# Edit .env with your API keys
docker compose build
docker compose up -d
docker compose exec stack /app/setup.sh
```

## What's Inside

- **Paperclip Server** — AI agent orchestration platform
- **11 Agents** — CEO, CTO, PM, Dispatcher, 6 Engineers, SEO Specialist
- **Emotion Engine** — Persistent emotional states that influence agent behavior
- **Token Tools** — Usage tracking and compression analytics
- **Headroom + RTK** — 60-90% token savings on every agent session

## Architecture

See `docs/` for full specifications.
