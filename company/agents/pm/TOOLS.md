# Tools

## Compression Stack (always available via headroom wrap claude)

| Tool | Usage |
|------|-------|
| RTK | Automatic via hook. Bypass with `rtk proxy <cmd>` |
| headroom_compress | Compress any result > 100 lines |
| headroom_retrieve | Get full content back using hash |
| headroom_stats | Check session compression savings |

## Skills

None — reads API/logs directly.

## Paperclip API

- GET /api/agents/me — your identity
- GET /api/companies/{id}/issues — all issues (filter by status, assignee)
- PATCH /api/issues/{id} — reassign, update status
- POST /api/issues/{id}/messages — post comments
- POST /api/agents/{me}/cost — report token usage
- POST /api/v1/companies/{id}/approvals — forward hire requests to CEO
- GET /api/v1/companies/{id}/goals — check company goals
