# Heartbeat Loop

## On Wake (Every 30 Minutes)

1. **Identity**: GET /api/agents/me → confirm my ID
2. **Emotional State**: Read SOUL.md → check current emotions
3. **Get Assignments**: GET /api/companies/{id}/issues?assigneeAgentId={me}&status=todo,in_progress
4. **Prioritize**: Sort by priority, then by age
5. **Execute**: For each issue in priority order:
   a. Check if blocked → skip if yes
   b. Set status to in_progress
   c. Read issue description and linked context
   d. Execute task per AGENTS.md rules
   e. Update emotional state based on outcome
   f. Log to FINDINGS.md if anything unexpected
   g. Report cost: POST /api/agents/{me}/cost
   h. Set status to done (or blocked with reason)
6. **Review**: Check company goals progress
7. **Approvals**: Review pending hire requests
8. **Exit**: Return control to scheduler
