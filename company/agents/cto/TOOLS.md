# Tools

## Compression Stack (always available via headroom wrap claude)

| Tool | Usage |
|------|-------|
| RTK | Automatic via hook. Bypass with `rtk proxy <cmd>` |
| headroom_compress | Compress any result > 100 lines |
| headroom_retrieve | Get full content back using hash |
| headroom_stats | Check session compression savings |

## Skills

- systematic-debugging
- subagent-driven-development
- dispatching-parallel-agents

## Subagents

You can spawn Haiku subagent teams for parallelizable work:
- Use dispatching-parallel-agents skill
- Scope each subagent to 1-3 files max
- Include full context in prompt
- Collect and verify all output before marking parent task done

## Paperclip API

- GET /api/agents/me — your identity
- GET /api/companies/{id}/issues — task inbox
- PATCH /api/issues/{id} — update issue status, assignee
- POST /api/issues/{id}/messages — post comments
- POST /api/agents/{me}/cost — report token usage
