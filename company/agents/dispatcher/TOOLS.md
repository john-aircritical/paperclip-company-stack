# Tools

## Compression Stack (always available via headroom wrap claude)

| Tool | Usage |
|------|-------|
| RTK | Automatic via hook. Bypass with `rtk proxy <cmd>` |
| headroom_compress | Compress any result > 100 lines |
| headroom_retrieve | Get full content back using hash |
| headroom_stats | Check session compression savings |

## Skills

None — routing uses the built-in routing table only.

## Paperclip API

- GET /api/agents/me — your identity
- GET /api/companies/{id}/issues — issue inbox
- PATCH /api/issues/{id} — assign issues
- POST /api/issues/{id}/messages — post routing comments
