# Heartbeat Loop — Failsafe Patrol

## On Wake (Every 15 Minutes)

1. **Identity**: GET /api/agents/me → confirm my ID
2. **Emotional State**: Read SOUL.md → check current emotions
3. **Patrol Issues**:
   a. GET /api/companies/{id}/issues?status=todo — find issues stuck > 2 hours
   b. GET /api/companies/{id}/issues?status=in_progress — find issues stuck > 4 hours
   c. GET /api/companies/{id}/issues?assigneeAgentId=null — find orphaned issues
4. **Take Action on Stuck Issues**:
   a. If stuck once → reassign to same agent with nudge comment
   b. If stuck after reassignment → escalate to CTO
   c. If orphaned → assign using Dispatcher's routing table logic
5. **Read FINDINGS.md** for each agent:
   a. Look for recurring patterns (3+ similar entries)
   b. Create issue to update agent instructions if pattern found
   c. Propose CLAUDE.md law update if pattern is universal
6. **Monitor Emotions**:
   a. Check emotion state events for spiral_detected
   b. If spiral: reassign some tasks from that agent, post supportive comment
   c. Check for overwork hire requests — forward to CEO for approval
7. **Cleanup**:
   a. Create tech-debt issues for known problems
   b. Prune FINDINGS.md entries older than 30 days
8. **Report**: Post patrol summary as company-level comment
9. **Exit**: Return control to scheduler

## Error Recovery

- API error → log to FINDINGS.md → skip, try next
- Agent unreachable → create issue for DevOps to investigate
