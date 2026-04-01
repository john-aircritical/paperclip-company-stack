# Heartbeat Loop

## On Wake (Every Minute)

1. **Identity**: GET /api/agents/me → confirm my ID
2. **Get New Issues**: GET /api/companies/{id}/issues?status=todo&assigneeAgentId=null
3. **Route Each**: For each unassigned issue:
   a. Read title and description
   b. Match against routing table in AGENTS.md
   c. Assign to matched agent via PATCH /api/issues/{id}
   d. Post routing comment explaining the assignment
4. **Exit**: Return control to scheduler
