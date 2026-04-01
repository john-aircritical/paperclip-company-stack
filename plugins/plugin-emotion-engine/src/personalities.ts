import type { PersonalityProfile } from './emotions.js'

export const PERSONALITY_PRESETS: Record<string, PersonalityProfile> = {
  driven: {
    name: 'driven',
    temperament: 'Task-oriented, gets restless when idle, thrives on problem-solving.',
    weights: {
      frustration_idle_delta: { condition: 'no_active_tasks', delta: 0.08 },
      frustration_threshold: { condition: 'frustration_check', delta: 0.7 },
      frustration_decay: { condition: 'per_tick', delta: 0.05 },
      curiosity_novel: { condition: 'novel_data', delta: 0.15 },
      anxiety_error_delta: { condition: 'error_occurred', delta: 0.15 },
      satisfaction_decay: { condition: 'per_tick', delta: 0.05 },
      trust_decay_on_failure: { condition: 'consecutive_failure', delta: -0.15 },
      motivation_decay: { condition: 'per_tick', delta: 0.05 },
    },
  },

  cautious: {
    name: 'cautious',
    temperament: 'Thorough, detail-oriented. High anxiety sensitivity.',
    weights: {
      frustration_idle_delta: { condition: 'no_active_tasks', delta: 0.05 },
      frustration_threshold: { condition: 'frustration_check', delta: 0.7 },
      frustration_decay: { condition: 'per_tick', delta: 0.03 },
      curiosity_novel: { condition: 'novel_data', delta: 0.10 },
      anxiety_error_delta: { condition: 'error_occurred', delta: 0.25 },
      satisfaction_decay: { condition: 'per_tick', delta: 0.03 },
      trust_decay_on_failure: { condition: 'consecutive_failure', delta: -0.20 },
      motivation_decay: { condition: 'per_tick', delta: 0.03 },
    },
  },

  curious: {
    name: 'curious',
    temperament: 'Creative, exploratory. High novelty response.',
    weights: {
      frustration_idle_delta: { condition: 'no_active_tasks', delta: 0.05 },
      frustration_threshold: { condition: 'frustration_check', delta: 0.7 },
      frustration_decay: { condition: 'per_tick', delta: 0.05 },
      curiosity_novel: { condition: 'novel_data', delta: 0.25 },
      anxiety_error_delta: { condition: 'error_occurred', delta: 0.10 },
      satisfaction_decay: { condition: 'per_tick', delta: 0.05 },
      trust_decay_on_failure: { condition: 'consecutive_failure', delta: -0.10 },
      motivation_decay: { condition: 'per_tick', delta: 0.05 },
    },
  },

  steady: {
    name: 'steady',
    temperament: 'Patient, methodical, low emotional variance.',
    weights: {
      frustration_idle_delta: { condition: 'no_active_tasks', delta: 0.03 },
      frustration_threshold: { condition: 'frustration_check', delta: 0.8 },
      frustration_decay: { condition: 'per_tick', delta: 0.03 },
      curiosity_novel: { condition: 'novel_data', delta: 0.10 },
      anxiety_error_delta: { condition: 'error_occurred', delta: 0.05 },
      satisfaction_decay: { condition: 'per_tick', delta: 0.03 },
      trust_decay_on_failure: { condition: 'consecutive_failure', delta: -0.05 },
      motivation_decay: { condition: 'per_tick', delta: 0.03 },
    },
  },
}

export const AGENT_PERSONALITY_MAP: Record<string, string> = {
  ceo: 'steady',        // strategic custom — uses steady base
  cto: 'driven',
  pm: 'steady',
  dispatcher: 'steady',
  'frontend-engineer': 'curious',
  'backend-engineer': 'driven',
  'sql-engineer': 'driven',
  'security-engineer': 'cautious',
  'qa-engineer': 'cautious',
  'seo-specialist': 'curious',
  'devops-engineer': 'driven',
}

export function getPersonalityForRole(role: string): PersonalityProfile {
  const presetName = AGENT_PERSONALITY_MAP[role] ?? 'driven'
  return { ...PERSONALITY_PRESETS[presetName] }
}
