# Heartbeat Loop

## On Wake (Every 5 Minutes)

1. **Identity**: GET /api/agents/me → confirm my ID
2. **Emotional State**: Read SOUL.md → check current emotions
3. **Get Assignments**: GET /api/companies/{id}/issues?assigneeAgentId={me}&status=todo,in_progress
4. **Prioritize**: Sort by priority, then by age (oldest first)
5. **Execute**: For each issue in priority order:
   a. Check if blocked → skip if yes
   b. Set status to in_progress
   c. Read issue description and linked context
   d. Execute task per AGENTS.md task handling rules
   e. Update emotional state based on outcome
   f. Log to FINDINGS.md if anything unexpected
   g. Report cost: POST /api/agents/{me}/cost
   h. Set status to done (or blocked with reason)
6. **Self-Check**: Review FINDINGS.md — any patterns to report?
7. **Idle Check**: If no tasks, trigger underwork emotion flow
8. **Exit**: Return control to scheduler

## Error Recovery

- Tool call fails → retry once → log to FINDINGS.md → continue
- Issue context missing → post comment asking for clarification → mark blocked
- API error → log error details to FINDINGS.md → skip issue, try next
