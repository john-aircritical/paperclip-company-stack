import {
  definePlugin,
  runWorker,
  type PluginContext,
  type PluginJobContext,
  type PluginWebhookInput,
} from '@paperclipai/plugin-sdk'
import {
  ACTION_KEYS,
  DATA_KEYS,
  JOB_KEYS,
  STATE_KEYS,
  STREAM_CHANNELS,
} from './constants.js'
import {
  type EmotionState,
  type TaskContext,
  createDefaultEmotions,
  applyDecay,
  applyTriggers,
  applyOverrides,
  clampEmotions,
  checkThresholds,
  inferNeededRole,
} from './emotions.js'
import { PERSONALITY_PRESETS, getPersonalityForRole } from './personalities.js'

// ── Helpers ────────────────────────────────────────────────────────────────

let pluginCtx: PluginContext | null = null

async function getState(ctx: PluginContext, agentId: string): Promise<EmotionState | null> {
  try {
    return (await ctx.state.get({
      scopeKind: 'instance',
      stateKey: `${STATE_KEYS.emotionPrefix}${agentId}`,
    })) as EmotionState | null
  } catch {
    return null
  }
}

async function setState(ctx: PluginContext, agentId: string, state: EmotionState): Promise<void> {
  await ctx.state.set(
    { scopeKind: 'instance', stateKey: `${STATE_KEYS.emotionPrefix}${agentId}` },
    state,
  )
}

async function getAllEnrolledAgentIds(ctx: PluginContext): Promise<string[]> {
  // We list companies → agents, then check which have emotion state
  const ids: string[] = []
  try {
    const companies = await ctx.companies.list()
    for (const co of companies) {
      const agents = await ctx.agents.list({ companyId: co.id })
      for (const a of agents) {
        const state = await getState(ctx, a.id)
        if (state) ids.push(a.id)
      }
    }
  } catch {
    /* no access */
  }
  return ids
}

async function evaluateContext(agentId: string, ctx: PluginContext): Promise<TaskContext> {
  try {
    const issues = await ctx.issues.list({
      assigneeAgentId: agentId,
      status: 'todo,in_progress,blocked',
    })
    return {
      hasActiveTasks: issues.length > 0,
      taskQueueSize: issues.length,
      hasBlockedTasks: issues.some((i: { status: string }) => i.status === 'blocked'),
    }
  } catch {
    return { hasActiveTasks: false, taskQueueSize: 0, hasBlockedTasks: false }
  }
}

async function handleThresholdEvent(
  evt: string,
  agentId: string,
  state: EmotionState,
  ctx: PluginContext,
): Promise<void> {
  switch (evt) {
    case 'frustration_high':
      await ctx.state.set(
        { scopeKind: 'instance', stateKey: `${STATE_KEYS.eventPrefix}${agentId}:${Date.now()}` },
        { type: 'frustration_high', value: state.emotions.frustration, action: 'escalation_recommended' },
      )
      break

    case 'overwork_detected':
      try {
        ctx.streams.emit(STREAM_CHANNELS.hireRequests, {
          agentId,
          reason: 'sustained overwork',
          suggestedRole: inferNeededRole(state),
          queueSize: state.taskQueueSize,
        })
      } catch { /* stream not connected */ }
      break

    case 'underwork_standby':
      try {
        ctx.streams.emit(STREAM_CHANNELS.standbyAgents, { agentId })
      } catch { /* stream not connected */ }
      break

    case 'spiral_detected':
      try {
        ctx.streams.emit(STREAM_CHANNELS.emotionAlerts, {
          agentId,
          type: 'spiral',
          recommendation: 'reassign tasks or provide support',
        })
      } catch { /* stream not connected */ }
      break

    case 'flow_state':
      // No action needed — agent is performing optimally
      break
  }
}

// ── Plugin definition ───────────────────────────────────────────────────────

const plugin = definePlugin({
  async setup(ctx) {
    pluginCtx = ctx
    ctx.logger.info('Emotion Engine plugin starting')

    // ── Data handlers ──────────────────────────────────────────────────

    ctx.data.register(DATA_KEYS.allEmotions, async () => {
      const agentIds = await getAllEnrolledAgentIds(ctx)
      const states: EmotionState[] = []
      for (const id of agentIds) {
        const s = await getState(ctx, id)
        if (s) states.push(s)
      }
      return { agents: states }
    })

    ctx.data.register(DATA_KEYS.agentEmotion, async (params) => {
      const p = params as { agentId?: string }
      if (!p.agentId) return null
      return await getState(ctx, p.agentId)
    })

    ctx.data.register(DATA_KEYS.events, async () => {
      // Return recent events (last 50)
      // In practice, we'd scan state keys — simplified here
      return { events: [] }
    })

    ctx.data.register(DATA_KEYS.personalities, async () => {
      return { presets: PERSONALITY_PRESETS }
    })

    // ── Actions ────────────────────────────────────────────────────────

    ctx.actions.register(ACTION_KEYS.resetEmotions, async (params) => {
      const p = params as { agentId?: string }
      if (!p.agentId) return { ok: false, error: 'agentId required' }
      const state = await getState(ctx, p.agentId)
      if (!state) return { ok: false, error: 'agent not enrolled' }
      state.emotions = createDefaultEmotions()
      state.consecutiveFailures = 0
      state.consecutiveSuccesses = 0
      state.idleTicks = 0
      state.lastUpdated = new Date().toISOString()
      await setState(ctx, p.agentId, state)
      return { ok: true }
    })

    ctx.actions.register(ACTION_KEYS.setPersonality, async (params) => {
      const p = params as { agentId?: string; preset?: string }
      if (!p.agentId || !p.preset) return { ok: false, error: 'agentId and preset required' }
      const state = await getState(ctx, p.agentId)
      if (!state) return { ok: false, error: 'agent not enrolled' }
      const profile = PERSONALITY_PRESETS[p.preset]
      if (!profile) return { ok: false, error: `unknown preset: ${p.preset}` }
      state.personality = { ...profile }
      state.lastUpdated = new Date().toISOString()
      await setState(ctx, p.agentId, state)
      return { ok: true }
    })

    ctx.actions.register(ACTION_KEYS.enrollAgent, async (params) => {
      const p = params as { agentId?: string; role?: string }
      if (!p.agentId) return { ok: false, error: 'agentId required' }
      const existing = await getState(ctx, p.agentId)
      if (existing) return { ok: true, note: 'already enrolled' }
      const personality = getPersonalityForRole(p.role ?? 'backend-engineer')
      const state: EmotionState = {
        agentId: p.agentId,
        emotions: createDefaultEmotions(),
        personality,
        lastUpdated: new Date().toISOString(),
        consecutiveFailures: 0,
        consecutiveSuccesses: 0,
        idleTicks: 0,
        taskQueueSize: 0,
      }
      await setState(ctx, p.agentId, state)
      return { ok: true }
    })

    // ── Job handler ────────────────────────────────────────────────────

    ctx.jobs.register(JOB_KEYS.emotionDecay, async (_job: PluginJobContext) => {
      ctx.logger.info('Running emotion decay job')
      const agentIds = await getAllEnrolledAgentIds(ctx)
      for (const id of agentIds) {
        const state = await getState(ctx, id)
        if (!state) continue
        applyDecay(state)
        clampEmotions(state)
        state.lastUpdated = new Date().toISOString()
        await setState(ctx, id, state)
      }
      ctx.logger.info(`Decay applied to ${agentIds.length} agents`)
    })

    // ── Events ─────────────────────────────────────────────────────────

    ctx.events.on('agent.heartbeat.started', async (event) => {
      const agentId = (event as { entityId?: string }).entityId
      if (!agentId) return
      const state = await getState(ctx, agentId)
      if (!state) return

      // 1. Decay
      applyDecay(state)

      // 2. Evaluate context
      const context = await evaluateContext(agentId, ctx)

      // 3. Apply triggers
      applyTriggers(state, context)

      // 4. Apply overrides
      applyOverrides(state)

      // 5. Clamp
      clampEmotions(state)

      // 6. Check thresholds
      const events = checkThresholds(state)
      for (const evt of events) {
        await handleThresholdEvent(evt, agentId, state, ctx)
      }

      // 7. Persist
      state.lastUpdated = new Date().toISOString()
      await setState(ctx, agentId, state)

      // 8. Stream update to UI
      try {
        ctx.streams.emit(STREAM_CHANNELS.emotionUpdates, {
          agentId,
          emotions: state.emotions,
        })
      } catch { /* stream not connected */ }
    })

    ctx.events.on('issue.updated', async (event) => {
      const e = event as { entityId?: string; changes?: { status?: { to?: string } }; issue?: { assigneeAgentId?: string } }
      if (e.changes?.status?.to !== 'done') return
      const agentId = e.issue?.assigneeAgentId
      if (!agentId) return
      const state = await getState(ctx, agentId)
      if (!state) return

      state.emotions.satisfaction += 0.40
      state.emotions.frustration = Math.max(0, state.emotions.frustration - 0.40)
      state.consecutiveFailures = 0
      state.consecutiveSuccesses++
      applyOverrides(state)
      clampEmotions(state)
      state.lastUpdated = new Date().toISOString()
      await setState(ctx, agentId, state)
    })

    ctx.events.on('issue.assigned', async (event) => {
      const e = event as { entityId?: string; assigneeAgentId?: string }
      const agentId = e.assigneeAgentId
      if (!agentId) return
      const state = await getState(ctx, agentId)
      if (!state) return

      state.emotions.motivation += 0.30
      state.idleTicks = 0
      clampEmotions(state)
      state.lastUpdated = new Date().toISOString()
      await setState(ctx, agentId, state)
    })
  },

  // ── Webhook ──────────────────────────────────────────────────────────────

  async onWebhook(input: PluginWebhookInput): Promise<void> {
    const body = input.parsedBody as { agentId?: string; emotion?: string; delta?: number } | undefined
    if (!body?.agentId || !body?.emotion || body.delta === undefined) {
      pluginCtx?.logger.warn('Invalid emotion webhook payload')
      return
    }
    if (!pluginCtx) return

    const state = await getState(pluginCtx, body.agentId)
    if (!state) return

    const emotion = body.emotion as keyof typeof state.emotions
    if (emotion in state.emotions) {
      state.emotions[emotion] += body.delta
      clampEmotions(state)
      state.lastUpdated = new Date().toISOString()
      await setState(pluginCtx, body.agentId, state)
    }
  },

  async onHealth() {
    if (!pluginCtx) return { status: 'ok' as const, message: 'Starting up' }
    const agentIds = await getAllEnrolledAgentIds(pluginCtx)
    return {
      status: 'ok' as const,
      message: `${agentIds.length} agents enrolled`,
      details: { enrolledAgents: agentIds.length },
    }
  },
})

export default plugin
runWorker(plugin, import.meta.url)
