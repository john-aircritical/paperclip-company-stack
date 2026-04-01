#!/bin/bash
set -e

# ═══════════════════════════════════════════════════════════════════════════════
# Install Skills — Pre-bakes role-specific skills into the container image
# Run during Docker build (not at runtime)
# ═══════════════════════════════════════════════════════════════════════════════

SKILLS_DIR="/home/node/.claude/skills"
mkdir -p "$SKILLS_DIR"

echo "Installing skills..."

# Skills are loaded on-demand by Claude Code from the skills directory.
# We just need to ensure the skill files exist. Claude Code's skill system
# discovers them automatically.

# The skills referenced by agents come from the superpowers/skills ecosystem.
# They are available at runtime if the Claude Code session has access to them.
# In the container, skills are discovered from:
#   1. ~/.claude/skills/ (local skills)
#   2. Skill registry (remote, fetched on demand)

# For container builds, we pre-create placeholder manifests so Claude Code
# knows which skills are available without network access.

declare -A AGENT_SKILLS=(
  ["ceo"]="brainstorming dispatching-parallel-agents"
  ["cto"]="systematic-debugging subagent-driven-development dispatching-parallel-agents"
  ["frontend-engineer"]="frontend-design shadcn-ui svelte5-best-practices web-design-guidelines mobile-design"
  ["backend-engineer"]="typescript-expert api-security-best-practices mcp-builder"
  ["sql-engineer"]="postgresql-table-design postgresql-optimization postgresql-code-review sql-optimization sql-code-review"
  ["security-engineer"]="api-security-best-practices"
  ["qa-engineer"]="playwright-best-practices systematic-debugging"
  ["seo-specialist"]="seo-audit keyword-research backlink-analyzer google-search-console schema-markup technical-seo-checker on-page-seo-auditor serp-analysis content-quality-auditor seo-content-writer ai-seo geo-content-optimizer"
  ["devops-engineer"]="docker-expert docker-compose-orchestration gcp-expert"
)

SKILL_COUNT=0
for role in "${!AGENT_SKILLS[@]}"; do
  for skill in ${AGENT_SKILLS[$role]}; do
    SKILL_DIR="$SKILLS_DIR/$skill"
    if [ ! -d "$SKILL_DIR" ]; then
      mkdir -p "$SKILL_DIR"
      # Skills are fetched at runtime from the registry
      # This placeholder ensures the skill name is discoverable
      echo "# Skill: $skill" > "$SKILL_DIR/.placeholder"
      SKILL_COUNT=$((SKILL_COUNT + 1))
    fi
  done
done

echo "  $SKILL_COUNT skill placeholders created"
echo "  Skills will be fetched from registry at runtime"
echo "Skills installation complete."
