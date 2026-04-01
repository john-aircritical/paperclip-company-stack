import type PaperclipPluginManifestV1 from '@paperclipai/plugin-sdk'
import {
  PLUGIN_ID,
  PLUGIN_VERSION,
  SLOT_IDS,
  EXPORT_NAMES,
  PAGE_ROUTE,
  DATA_KEYS,
  ACTION_KEYS,
  JOB_KEYS,
  WEBHOOK_KEYS,
} from './constants.js'

const manifest: PaperclipPluginManifestV1 = {
  id: PLUGIN_ID,
  apiVersion: 1,
  version: PLUGIN_VERSION,
  displayName: 'Emotion Engine',
  description:
    'Persistent emotional states for agents. Emotions update on heartbeats, ' +
    'influence behavior, and trigger events (escalation, hiring, standby).',
  author: 'ACC Medlink',
  categories: ['automation', 'ui'],

  capabilities: [
    // Data
    'data.register',
    // Actions
    'actions.register',
    // Events
    'events.subscribe',
    // Jobs
    'jobs.schedule',
    // State
    'plugin.state.read',
    'plugin.state.write',
    // UI
    'ui.dashboardWidget.register',
    'ui.page.register',
    'instance.settings.register',
    // Webhooks
    'webhooks.receive',
    // Streams
    'streams.register',
    // Agents
    'agents.read',
    'companies.read',
  ],

  instanceConfigSchema: {},

  slots: [
    {
      id: SLOT_IDS.dashboardWidget,
      type: 'dashboardWidget',
      export: EXPORT_NAMES.dashboardWidget,
      title: 'Agent Emotions',
      description: 'Compact emotion overview for all agents',
    },
    {
      id: SLOT_IDS.page,
      type: 'page',
      export: EXPORT_NAMES.page,
      route: PAGE_ROUTE,
      title: 'Emotions',
      description: 'Full emotion dashboard with live state, events, and personalities',
    },
    {
      id: SLOT_IDS.settingsPage,
      type: 'settingsPage',
      export: EXPORT_NAMES.settingsPage,
      title: 'Emotion Engine Settings',
      description: 'Configure personalities, thresholds, and decay rates',
    },
  ],

  data: [
    { key: DATA_KEYS.allEmotions, displayName: 'All Agent Emotions', description: 'Current emotional state for all enrolled agents' },
    { key: DATA_KEYS.agentEmotion, displayName: 'Agent Emotion', description: 'Emotional state for a specific agent' },
    { key: DATA_KEYS.events, displayName: 'Emotion Events', description: 'Recent threshold events fired' },
    { key: DATA_KEYS.personalities, displayName: 'Personalities', description: 'Available personality presets' },
  ],

  actions: [
    { key: ACTION_KEYS.resetEmotions, displayName: 'Reset Emotions', description: 'Reset an agent to baseline emotional state' },
    { key: ACTION_KEYS.setPersonality, displayName: 'Set Personality', description: 'Assign a personality preset to an agent' },
    { key: ACTION_KEYS.enrollAgent, displayName: 'Enroll Agent', description: 'Enroll an agent in the emotion system' },
  ],

  webhooks: [
    {
      endpointKey: WEBHOOK_KEYS.emotionTrigger,
      displayName: 'Emotion Trigger',
      description: 'External trigger for emotion state changes',
    },
  ],

  jobs: [
    {
      key: JOB_KEYS.emotionDecay,
      displayName: 'Emotion Decay',
      description: 'Periodic decay of all agent emotions toward baseline',
      schedule: '*/5 * * * *',
    },
  ],
}

export default manifest
