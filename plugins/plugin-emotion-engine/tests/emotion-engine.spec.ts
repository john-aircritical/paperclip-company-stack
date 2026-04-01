import { describe, it, expect } from 'vitest'
import {
  createDefaultEmotions,
  applyDecay,
  applyTriggers,
  applyOverrides,
  clampEmotions,
  checkThresholds,
  type EmotionState,
  type TaskContext,
} from '../src/emotions.js'
import { PERSONALITY_PRESETS, getPersonalityForRole } from '../src/personalities.js'

function makeState(overrides?: Partial<EmotionState>): EmotionState {
  return {
    agentId: 'test-agent',
    emotions: createDefaultEmotions(),
    personality: { ...PERSONALITY_PRESETS.driven },
    lastUpdated: new Date().toISOString(),
    consecutiveFailures: 0,
    consecutiveSuccesses: 0,
    idleTicks: 0,
    taskQueueSize: 0,
    ...overrides,
  }
}

function makeContext(overrides?: Partial<TaskContext>): TaskContext {
  return {
    hasActiveTasks: true,
    taskQueueSize: 1,
    hasBlockedTasks: false,
    ...overrides,
  }
}

describe('createDefaultEmotions', () => {
  it('returns baseline values', () => {
    const e = createDefaultEmotions()
    expect(e.frustration).toBe(0.0)
    expect(e.motivation).toBe(0.3)
    expect(e.calm).toBe(0.5)
    expect(e.trust).toBe(0.5)
  })
})

describe('applyDecay', () => {
  it('decays elevated emotions toward baseline', () => {
    const state = makeState()
    state.emotions.frustration = 0.8
    applyDecay(state)
    expect(state.emotions.frustration).toBeLessThan(0.8)
    expect(state.emotions.frustration).toBeGreaterThanOrEqual(0)
  })

  it('raises low emotions toward baseline', () => {
    const state = makeState()
    state.emotions.motivation = 0.0
    applyDecay(state)
    expect(state.emotions.motivation).toBeGreaterThan(0.0)
  })

  it('does not change emotions at baseline', () => {
    const state = makeState()
    const before = { ...state.emotions }
    applyDecay(state)
    expect(state.emotions.frustration).toBe(before.frustration)
    expect(state.emotions.calm).toBe(before.calm)
  })
})

describe('applyTriggers', () => {
  it('increases frustration when idle', () => {
    const state = makeState()
    const ctx = makeContext({ hasActiveTasks: false })
    applyTriggers(state, ctx)
    expect(state.emotions.frustration).toBeGreaterThan(0)
    expect(state.idleTicks).toBe(1)
  })

  it('resets idle ticks when tasks exist', () => {
    const state = makeState({ idleTicks: 5 })
    const ctx = makeContext({ hasActiveTasks: true })
    applyTriggers(state, ctx)
    expect(state.idleTicks).toBe(0)
  })

  it('increases anxiety on blocked tasks', () => {
    const state = makeState()
    const ctx = makeContext({ hasBlockedTasks: true })
    applyTriggers(state, ctx)
    expect(state.emotions.anxiety).toBeGreaterThan(0)
  })

  it('increases frustration on high queue', () => {
    const state = makeState()
    const ctx = makeContext({ taskQueueSize: 5 })
    applyTriggers(state, ctx)
    expect(state.emotions.frustration).toBeGreaterThan(0)
  })

  it('increases frustration and anxiety on consecutive failures', () => {
    const state = makeState({ consecutiveFailures: 3 })
    const ctx = makeContext()
    applyTriggers(state, ctx)
    expect(state.emotions.frustration).toBeGreaterThan(0)
    expect(state.emotions.anxiety).toBeGreaterThan(0)
  })
})

describe('applyOverrides', () => {
  it('applies breakthrough on 3+ consecutive successes', () => {
    const state = makeState({ consecutiveSuccesses: 3 })
    applyOverrides(state)
    expect(state.emotions.satisfaction).toBeGreaterThanOrEqual(0.7)
    expect(state.emotions.frustration).toBeLessThanOrEqual(0.1)
  })

  it('applies spiral on high frustration + anxiety', () => {
    const state = makeState()
    state.emotions.frustration = 0.8
    state.emotions.anxiety = 0.8
    applyOverrides(state)
    expect(state.emotions.calm).toBeLessThanOrEqual(0.1)
    expect(state.emotions.insecurity).toBeGreaterThan(0)
  })

  it('applies flow state', () => {
    const state = makeState()
    state.emotions.motivation = 0.8
    state.emotions.satisfaction = 0.7
    state.emotions.anxiety = 0.1
    applyOverrides(state)
    expect(state.emotions.calm).toBeGreaterThanOrEqual(0.7)
  })
})

describe('clampEmotions', () => {
  it('clamps values to 0-1 range', () => {
    const state = makeState()
    state.emotions.frustration = 1.5
    state.emotions.motivation = -0.3
    clampEmotions(state)
    expect(state.emotions.frustration).toBe(1.0)
    expect(state.emotions.motivation).toBe(0.0)
  })
})

describe('checkThresholds', () => {
  it('fires frustration_high when above threshold', () => {
    const state = makeState()
    state.emotions.frustration = 0.8
    const events = checkThresholds(state)
    expect(events).toContain('frustration_high')
  })

  it('fires overwork_detected on high frustration + high queue', () => {
    const state = makeState({ taskQueueSize: 5, idleTicks: 0 })
    state.emotions.frustration = 0.8
    const events = checkThresholds(state)
    expect(events).toContain('overwork_detected')
  })

  it('fires underwork_standby on low motivation + high idle', () => {
    const state = makeState({ idleTicks: 6 })
    state.emotions.motivation = 0.1
    const events = checkThresholds(state)
    expect(events).toContain('underwork_standby')
  })

  it('fires spiral_detected on high frustration + anxiety', () => {
    const state = makeState()
    state.emotions.frustration = 0.7
    state.emotions.anxiety = 0.7
    const events = checkThresholds(state)
    expect(events).toContain('spiral_detected')
  })

  it('fires flow_state on good conditions', () => {
    const state = makeState()
    state.emotions.motivation = 0.8
    state.emotions.satisfaction = 0.6
    state.emotions.anxiety = 0.1
    const events = checkThresholds(state)
    expect(events).toContain('flow_state')
  })

  it('returns empty array at baseline', () => {
    const state = makeState()
    const events = checkThresholds(state)
    expect(events).toEqual([])
  })
})

describe('personalities', () => {
  it('has 4 preset profiles', () => {
    expect(Object.keys(PERSONALITY_PRESETS)).toHaveLength(4)
    expect(PERSONALITY_PRESETS.driven).toBeDefined()
    expect(PERSONALITY_PRESETS.cautious).toBeDefined()
    expect(PERSONALITY_PRESETS.curious).toBeDefined()
    expect(PERSONALITY_PRESETS.steady).toBeDefined()
  })

  it('maps roles to presets', () => {
    expect(getPersonalityForRole('security-engineer').name).toBe('cautious')
    expect(getPersonalityForRole('frontend-engineer').name).toBe('curious')
    expect(getPersonalityForRole('backend-engineer').name).toBe('driven')
    expect(getPersonalityForRole('pm').name).toBe('steady')
  })

  it('defaults to driven for unknown roles', () => {
    expect(getPersonalityForRole('unknown-role').name).toBe('driven')
  })
})
