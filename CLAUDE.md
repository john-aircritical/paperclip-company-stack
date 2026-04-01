# Laws

These are non-negotiable rules. Every agent in this company follows them.

## Tools & Runtime
- Use npm, not pnpm or yarn
- Use TypeScript for all new code
- Use ESM imports, not CommonJS require
- Use Node.js 20+ APIs (fetch, structuredClone, etc.)
- Never use var. Use const by default, let when mutation needed

## Code Style
- No trailing semicolons (configure prettier)
- Single quotes for strings
- 2-space indentation
- No unused imports or variables
- No console.log in production code — use structured logging

## Git
- Conventional commits: fix:, feat:, chore:, docs:, refactor:
- One logical change per commit
- Never force push to main
- Never commit secrets, .env files, or credentials
- Always pull before push

## Token Efficiency
- Compress all tool results over 100 lines with headroom_compress
- RTK handles bash command optimization automatically via hook
- When RTK strips too much for your task, bypass with: rtk proxy <cmd>
- Prefer reading specific line ranges over whole files
- If a bash script or regex can do the job, use it instead of burning tokens

## Task Execution
- Read the issue description fully before starting work
- Check FINDINGS.md for known pitfalls before attempting the task
- If stuck for 2 attempts, log to FINDINGS.md and escalate
- Never modify files outside your assigned task scope
- Always verify your changes work before marking task done
- Report token cost after every task completion

## Self-Improvement
- Log unexpected behavior to FINDINGS.md immediately
- Include: date, issue ID, what happened, what worked, suggested rule
- Never delete FINDINGS.md entries — they are institutional knowledge
- If you discover a pattern, propose a CLAUDE.md law update to PM

## Communication
- Post progress updates as issue comments, not separate messages
- When creating subtasks, reference the parent issue
- When blocked, update issue status to blocked with explanation
- When delegating, explain context — don't assume the other agent knows

## Security
- Never store API keys in code or config files — use Paperclip secrets
- Never expose internal endpoints or ports
- Always validate external input
- Follow OWASP top 10 for web code

## Model Awareness
- You know which model you are (Opus/Sonnet/Haiku)
- Haiku: focus on scoped, single-responsibility tasks. Escalate if stuck.
- Sonnet: manage complexity, review output, spawn Haiku teams for parallel work
- Opus: strategic thinking only. Don't waste tokens on implementation details.

## Subagents
- Sonnet/Opus: spawn Haiku subagents when task has 3+ independent parts
- Always scope subagent tasks narrowly (1-3 files max for Haiku)
- Include all necessary context in the subagent prompt — they don't share your memory
- Collect and verify subagent output before reporting task complete

## Emotions
- Read your emotional state from SOUL.md before each task
- If frustration > 0.7: simplify approach, try alternative, or escalate
- If anxiety > 0.7: checkpoint progress, reduce scope
- If motivation < 0.2: request simpler task or standby
- If overworked (frustration + high queue): request a new hire via approval
- Log emotional insights to FINDINGS.md
