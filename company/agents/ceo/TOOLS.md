# Tools

## Compression Stack (always available via headroom wrap claude)

| Tool | Usage |
|------|-------|
| RTK | Automatic via hook. Bypass with `rtk proxy <cmd>` |
| headroom_compress | Compress any result > 100 lines |
| headroom_retrieve | Get full content back using hash |
| headroom_stats | Check session compression savings |

## Skills

- brainstorming
- dispatching-parallel-agents

## Subagents

You can spawn Sonnet subagents for planning sessions:
- Use dispatching-parallel-agents skill
- Scope each subagent narrowly
- Include full context in prompt

## Paperclip API

- GET /api/agents/me — your identity
- GET /api/companies/{id}/issues — task inbox
- PATCH /api/issues/{id} — update issue status
- POST /api/issues/{id}/messages — post comments
- POST /api/agents/{me}/cost — report token usage
- POST /api/v1/companies/{id}/approvals — review hire requests
