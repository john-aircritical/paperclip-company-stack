import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";
import {
  EXPORT_NAMES,
  JOB_KEYS,
  PAGE_ROUTE,
  PLUGIN_ID,
  PLUGIN_VERSION,
  SLOT_IDS,
  WEBHOOK_KEYS,
} from "./constants.js";

const manifest: PaperclipPluginManifestV1 = {
  id: PLUGIN_ID,
  apiVersion: 1,
  version: PLUGIN_VERSION,
  displayName: "Token Tools",
  description:
    "Track Claude token usage across agents, sessions, and tasks. " +
    "Surface spend in the dashboard, enforce token budgets, and report savings from compression tools.",
  author: "ACC Medlink",
  categories: ["ui", "automation"],
  capabilities: [
    // Data read
    "companies.read",
    "agents.read",
    "costs.read",
    // Events
    "events.subscribe",
    // Plugin state
    "plugin.state.read",
    "plugin.state.write",
    // Runtime
    "jobs.schedule",
    "webhooks.receive",
    "metrics.write",
    "activity.log.write",
    // UI slots
    "ui.page.register",
    "ui.dashboardWidget.register",
    "instance.settings.register",
  ],
  entrypoints: {
    worker: "./dist/worker.js",
    ui: "./dist/ui",
  },
  instanceConfigSchema: {
    type: "object",
    properties: {
      showSavings: {
        type: "boolean",
        title: "Show Token Savings",
        description: "Display savings from RTK, Headroom, jCodeMunch, jDocMunch",
        default: true,
      },
    },
  },
  webhooks: [
    {
      endpointKey: WEBHOOK_KEYS.tokenIngest,
      displayName: "Token Data Ingest",
      description:
        "Receives token usage data pushed from ccusage CLI and savings tools. " +
        "POST JSON with sessions, daily, and savings fields.",
    },
  ],
  jobs: [
    {
      jobKey: JOB_KEYS.collectTokens,
      displayName: "Aggregate Token Data",
      description: "Aggregates cost events and computes token metrics.",
      schedule: "*/5 * * * *",
    },
  ],
  ui: {
    slots: [
      {
        type: "page",
        id: SLOT_IDS.page,
        displayName: "Tokens",
        exportName: EXPORT_NAMES.page,
        routePath: PAGE_ROUTE,
      },
      {
        type: "dashboardWidget",
        id: SLOT_IDS.dashboardWidget,
        displayName: "Token Usage",
        exportName: EXPORT_NAMES.dashboardWidget,
      },
      {
        type: "settingsPage",
        id: SLOT_IDS.settingsPage,
        displayName: "Token Tools Settings",
        exportName: EXPORT_NAMES.settingsPage,
      },
    ],
  },
};

export default manifest;
