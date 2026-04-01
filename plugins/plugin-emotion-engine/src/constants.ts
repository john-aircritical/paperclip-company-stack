export const PLUGIN_ID = 'accmedlink.plugin-emotion-engine'
export const PLUGIN_VERSION = '0.0.1'
export const PAGE_ROUTE = 'emotions'

export const SLOT_IDS = {
  page: 'emotion-engine-page',
  dashboardWidget: 'emotion-engine-dashboard-widget',
  settingsPage: 'emotion-engine-settings',
}

export const EXPORT_NAMES = {
  page: 'EmotionPage',
  dashboardWidget: 'DashboardWidget',
  settingsPage: 'SettingsPage',
}

export const DATA_KEYS = {
  allEmotions: 'emotion-all-states',
  agentEmotion: 'emotion-agent-state',
  events: 'emotion-events',
  personalities: 'emotion-personalities',
}

export const ACTION_KEYS = {
  resetEmotions: 'reset-emotions',
  setPersonality: 'set-personality',
  enrollAgent: 'enroll-agent',
}

export const JOB_KEYS = {
  emotionDecay: 'emotion-decay',
}

export const WEBHOOK_KEYS = {
  emotionTrigger: 'emotion-trigger',
}

export const STREAM_CHANNELS = {
  emotionUpdates: 'emotion-updates',
  hireRequests: 'hire-requests',
  standbyAgents: 'standby-agents',
  emotionAlerts: 'emotion-alerts',
}

export const STATE_KEYS = {
  emotionPrefix: 'emotion:',
  eventPrefix: 'emotion-event:',
  config: 'emotion-config',
}

export const EMOTION_NAMES = [
  'frustration',
  'curiosity',
  'satisfaction',
  'motivation',
  'anxiety',
  'calm',
  'trust',
  'insecurity',
  'surprise',
] as const

export type EmotionName = (typeof EMOTION_NAMES)[number]
