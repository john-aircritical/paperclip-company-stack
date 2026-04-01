import type { EmotionName } from './constants.js'

// ── Types ──────────────────────────────────────────────────────────────────

export interface Emotions {
  frustration: number
  curiosity: number
  satisfaction: number
  motivation: number
  anxiety: number
  calm: number
  trust: number
  insecurity: number
  surprise: number
}

export interface TriggerWeight {
  condition: string
  delta: number
}

export interface PersonalityProfile {
  name: string
  temperament: string
  weights: Record<string, TriggerWeight>
}

export interface EmotionState {
  agentId: string
  emotions: Emotions
  personality: PersonalityProfile
  lastUpdated: string
  consecutiveFailures: number
  consecutiveSuccesses: number
  idleTicks: number
  taskQueueSize: number
}

export interface TaskContext {
  hasActiveTasks: boolean
  taskQueueSize: number
  hasBlockedTasks: boolean
}

export type ThresholdEvent =
  | 'frustration_high'
  | 'overwork_detected'
  | 'underwork_standby'
  | 'spiral_detected'
  | 'flow_state'

// ── Defaults ───────────────────────────────────────────────────────────────

const DEFAULT_DECAY_RATE = 0.05
const BASELINE: Record<EmotionName, number> = {
  frustration: 0.0,
  curiosity: 0.0,
  satisfaction: 0.0,
  motivation: 0.3,
  anxiety: 0.0,
  calm: 0.5,
  trust: 0.5,
  insecurity: 0.0,
  surprise: 0.0,
}

// ── Core Math ──────────────────────────────────────────────────────────────

export function createDefaultEmotions(): Emotions {
  return { ...BASELINE }
}

export function applyDecay(state: EmotionState): void {
  const emotions = state.emotions
  const weights = state.personality.weights
  for (const key of Object.keys(BASELINE) as EmotionName[]) {
    const baseline = BASELINE[key]
    const decayKey = `${key}_decay`
    const rate = weights[decayKey]?.delta ?? DEFAULT_DECAY_RATE
    if (emotions[key] > baseline) {
      emotions[key] = Math.max(baseline, emotions[key] - rate)
    } else if (emotions[key] < baseline) {
      emotions[key] = Math.min(baseline, emotions[key] + rate)
    }
  }
}

export function applyTriggers(state: EmotionState, context: TaskContext): void {
  const e = state.emotions
  const w = state.personality.weights

  // Idle frustration
  if (!context.hasActiveTasks) {
    state.idleTicks++
    const idleDelta = w['frustration_idle_delta']?.delta ?? 0.05
    e.frustration += idleDelta
    e.motivation = Math.max(0, e.motivation - 0.05)
  } else {
    state.idleTicks = 0
  }

  // Blocked tasks → anxiety
  if (context.hasBlockedTasks) {
    const anxDelta = w['anxiety_error_delta']?.delta ?? 0.15
    e.anxiety += anxDelta
  }

  // High queue → frustration
  state.taskQueueSize = context.taskQueueSize
  if (context.taskQueueSize > 3) {
    e.frustration += 0.10
  }

  // Consecutive failures
  if (state.consecutiveFailures >= 2) {
    e.frustration += 0.20
    e.anxiety += 0.10
    const trustDelta = w['trust_decay_on_failure']?.delta ?? -0.15
    e.trust += trustDelta
  }

  // Consecutive successes
  if (state.consecutiveSuccesses >= 3) {
    e.satisfaction += 0.15
    e.motivation += 0.10
    e.trust += 0.05
  }
}

export function applyOverrides(state: EmotionState): void {
  const e = state.emotions

  // Breakthrough: 3+ consecutive successes
  if (state.consecutiveSuccesses >= 3) {
    e.satisfaction = Math.max(e.satisfaction, 0.7)
    e.frustration = Math.min(e.frustration, 0.1)
    e.motivation = Math.max(e.motivation, 0.6)
  }

  // Spiral: high frustration AND high anxiety
  if (e.frustration > 0.6 && e.anxiety > 0.6) {
    e.calm = Math.min(e.calm, 0.1)
    e.insecurity += 0.10
  }

  // Flow state: high motivation, high satisfaction, low anxiety
  if (e.motivation > 0.6 && e.satisfaction > 0.5 && e.anxiety < 0.2) {
    e.calm = Math.max(e.calm, 0.7)
    e.curiosity += 0.05
  }
}

export function clampEmotions(state: EmotionState): void {
  const e = state.emotions
  for (const key of Object.keys(e) as EmotionName[]) {
    e[key] = Math.max(0, Math.min(1, e[key]))
  }
}

export function checkThresholds(state: EmotionState): ThresholdEvent[] {
  const events: ThresholdEvent[] = []
  const e = state.emotions
  const threshold = state.personality.weights['frustration_threshold']?.delta ?? 0.7

  if (e.frustration >= threshold) {
    events.push('frustration_high')
  }

  if (e.frustration > 0.7 && state.idleTicks === 0 && state.taskQueueSize > 3) {
    events.push('overwork_detected')
  }

  if (e.motivation < 0.2 && state.idleTicks > 5) {
    events.push('underwork_standby')
  }

  if (e.frustration > 0.6 && e.anxiety > 0.6) {
    events.push('spiral_detected')
  }

  if (e.motivation > 0.6 && e.satisfaction > 0.5 && e.anxiety < 0.2) {
    events.push('flow_state')
  }

  return events
}

export function inferNeededRole(state: EmotionState): string {
  if (state.taskQueueSize > 5) return 'general-engineer'
  return 'specialist'
}
