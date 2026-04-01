export const PLUGIN_ID = "accmedlink.plugin-token-tools";
export const PLUGIN_VERSION = "0.0.2";
export const PAGE_ROUTE = "tokens";

export const SLOT_IDS = {
  page: "token-tools-page",
  dashboardWidget: "token-tools-dashboard-widget",
  settingsPage: "token-tools-settings",
} as const;

export const EXPORT_NAMES = {
  page: "TokensPage",
  dashboardWidget: "DashboardWidget",
  settingsPage: "SettingsPage",
} as const;

export const DATA_KEYS = {
  overview: "token-overview",
  sessions: "token-sessions",
  agentBreakdown: "token-agent-breakdown",
  budgetStatus: "token-budget-status",
  savingsReport: "token-savings-report",
  savings: "token-savings",
} as const;

export const ACTION_KEYS = {
  refreshTokenData: "refresh-token-data",
  setTokenBudget: "set-token-budget",
} as const;

export const JOB_KEYS = {
  collectTokens: "collect-tokens",
} as const;

export const WEBHOOK_KEYS = {
  tokenIngest: "token-ingest",
} as const;

export const STREAM_CHANNELS = {
  tokenUpdates: "token-updates",
} as const;

export const STATE_KEYS = {
  tokenData: "token-data",
  tokenBudget: "token-budget",
  costEvents: "cost-events",
} as const;
