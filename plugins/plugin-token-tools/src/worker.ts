import {
  definePlugin,
  runWorker,
  type PluginContext,
  type PluginJobContext,
  type PluginWebhookInput,
} from "@paperclipai/plugin-sdk";
import {
  ACTION_KEYS,
  DATA_KEYS,
  JOB_KEYS,
  STATE_KEYS,
  STREAM_CHANNELS,
} from "./constants.js";

// ── Types ──────────────────────────────────────────────────────────────────

type ModelBreakdown = {
  modelName: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  cost: number;
};

type CcusageSession = {
  sessionId: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  totalTokens: number;
  totalCost: number;
  lastActivity: string;
  modelsUsed: string[];
  modelBreakdowns: ModelBreakdown[];
  projectPath: string;
};

type DailyEntry = {
  date: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  totalTokens: number;
  totalCost: number;
};

type AgentTokenData = {
  agentId: string;
  agentName: string;
  sessionCount: number;
  totalTokens: number;
  totalCost: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  lastActivity: string;
  modelsUsed: string[];
};

type UsageBar = {
  label: string;       // "Current Session (5hr)", "Weekly (all models)"
  percent: number;     // 0-100
  resetLabel: string;  // "resets in 3h 34m"
  pacePercent: number; // positive = over pace, negative = under pace
  barColor: string;    // CSS color
  ticks?: number[];    // optional tick mark positions
};

type UsageOverview = {
  bars: UsageBar[];
  todaySpend: number;
  todayTokens: number;
  lastUpdated: string;
};

type TokenData = {
  overview: UsageOverview;
  sessions: CcusageSession[];
  daily: DailyEntry[];
  agentBreakdown: AgentTokenData[];
  savings: SavingsSnapshot | null;
};

/** Per-tool savings snapshot */
type ToolSavings = {
  tool: string;
  active: boolean;
  totalSaved: number;
  avgSavingsPct: number;
  history: { time: string; savedTokens: number; savedPct: number; cmd?: string }[];
  extra?: Record<string, unknown>;
};

/** Combined savings data from all tools */
type SavingsSnapshot = {
  combinedSaved: number;
  tools: ToolSavings[];
  collectedAt: string;
};

/** Payload pushed by external cron script via webhook */
type WebhookPayload = {
  type: "ccusage-sync";
  /** Rate limit usage bars — the core data for the dashboard */
  usage?: UsageBar[];
  /** Today's spend in dollars */
  todaySpend?: number;
  /** Today's total tokens used */
  todayTokens?: number;
  /** Optional session-level data */
  sessions?: CcusageSession[];
  daily?: DailyEntry[];
  /** Token savings from tools (RTK, Headroom, jCodeMunch, jDocMunch) */
  savings?: SavingsSnapshot;
};

type BudgetState = {
  monthlyLimitCents: number;
  alertThresholdPercent: number;
  updatedAt: string;
};

// ── Defaults ───────────────────────────────────────────────────────────────

const defaultOverview: UsageOverview = {
  bars: [],
  todaySpend: 0,
  todayTokens: 0,
  lastUpdated: new Date().toISOString(),
};

// ── In-memory cache ────────────────────────────────────────────────────────

let cached: TokenData = {
  overview: { ...defaultOverview },
  sessions: [],
  daily: [],
  agentBreakdown: [],
  savings: null,
};

// ── Helpers ────────────────────────────────────────────────────────────────

function matchSessionToAgent(
  session: CcusageSession,
  agentMap: Map<string, { id: string; name: string }>,
): { agentId: string; agentName: string } | null {
  const pp = session.projectPath ?? session.sessionId;
  const projectMatch = pp.match(/projects-[^-]+-([0-9a-f-]{36})/);
  if (projectMatch) {
    const id = projectMatch[1];
    const agent = agentMap.get(id);
    if (agent) return { agentId: agent.id, agentName: agent.name };
    return { agentId: id, agentName: `Agent ${id.slice(0, 8)}` };
  }
  const wsMatch = pp.match(/workspaces-([0-9a-f-]{36})/);
  if (wsMatch) {
    return { agentId: wsMatch[1], agentName: `Workspace ${wsMatch[1].slice(0, 8)}` };
  }
  return null;
}

async function buildAgentMap(ctx: PluginContext): Promise<Map<string, { id: string; name: string }>> {
  const agentMap = new Map<string, { id: string; name: string }>();
  try {
    const companies = await ctx.companies.list();
    for (const co of companies) {
      const agents = await ctx.agents.list({ companyId: co.id });
      for (const a of agents) {
        agentMap.set(a.id, { id: a.id, name: a.name });
      }
    }
  } catch {
    /* no company access */
  }
  return agentMap;
}

function computeTodaySpend(daily: DailyEntry[]): number {
  const today = new Date().toISOString().slice(0, 10);
  return daily.filter((d) => d.date === today).reduce((s, d) => s + d.totalCost, 0);
}

function computeTodayTokens(daily: DailyEntry[]): number {
  const today = new Date().toISOString().slice(0, 10);
  return daily.filter((d) => d.date === today).reduce((s, d) => s + d.totalTokens, 0);
}

async function processWebhookData(ctx: PluginContext, payload: WebhookPayload): Promise<void> {
  const agentMap = await buildAgentMap(ctx);

  if (payload.sessions) cached.sessions = payload.sessions;
  if (payload.daily) cached.daily = payload.daily;
  if (payload.savings) cached.savings = payload.savings;

  // Update usage bars (the core data)
  const bars = payload.usage ?? cached.overview.bars;
  const todaySpend = payload.todaySpend ?? computeTodaySpend(cached.daily);
  const todayTokens = payload.todayTokens ?? computeTodayTokens(cached.daily);

  // Build agent breakdown from sessions
  const agentAgg = new Map<string, AgentTokenData>();
  for (const session of cached.sessions) {
    const match = matchSessionToAgent(session, agentMap);
    if (!match) continue;

    const existing = agentAgg.get(match.agentId);
    if (existing) {
      existing.sessionCount += 1;
      existing.totalTokens += session.totalTokens;
      existing.totalCost += session.totalCost;
      existing.inputTokens += session.inputTokens;
      existing.outputTokens += session.outputTokens;
      existing.cacheReadTokens += session.cacheReadTokens;
      existing.cacheCreationTokens += session.cacheCreationTokens;
      if (session.lastActivity > existing.lastActivity) existing.lastActivity = session.lastActivity;
      for (const m of session.modelsUsed) {
        if (!existing.modelsUsed.includes(m)) existing.modelsUsed.push(m);
      }
    } else {
      agentAgg.set(match.agentId, {
        agentId: match.agentId,
        agentName: match.agentName,
        sessionCount: 1,
        totalTokens: session.totalTokens,
        totalCost: session.totalCost,
        inputTokens: session.inputTokens,
        outputTokens: session.outputTokens,
        cacheReadTokens: session.cacheReadTokens,
        cacheCreationTokens: session.cacheCreationTokens,
        lastActivity: session.lastActivity,
        modelsUsed: [...session.modelsUsed],
      });
    }
  }

  cached.agentBreakdown = [...agentAgg.values()].sort((a, b) => b.totalCost - a.totalCost);

  cached.overview = {
    bars,
    todaySpend,
    todayTokens,
    lastUpdated: new Date().toISOString(),
  };

  // Persist to state
  await ctx.state.set({ scopeKind: "instance", stateKey: STATE_KEYS.tokenData }, cached);

  // Notify UI
  try {
    ctx.streams.emit(STREAM_CHANNELS.tokenUpdates, {
      type: "overview-updated",
      overview: cached.overview,
    });
  } catch {
    /* stream not connected */
  }
}

// ── Plugin definition ───────────────────────────────────────────────────────

const plugin = definePlugin({
  async setup(ctx) {
    pluginCtx = ctx;
    ctx.logger.info("Token Tools plugin starting");

    // Load persisted data from state
    try {
      const stored = (await ctx.state.get({
        scopeKind: "instance",
        stateKey: STATE_KEYS.tokenData,
      })) as TokenData | null;
      if (stored) {
        cached = stored;
        ctx.logger.info("Loaded cached token data", {
          sessions: cached.sessions.length,
          bars: cached.overview.bars.length,
        });
      }
    } catch {
      ctx.logger.info("No cached token data found, starting fresh");
    }

    // ── Data handlers ──────────────────────────────────────────────────────

    ctx.data.register(DATA_KEYS.overview, async () => cached.overview);

    ctx.data.register(DATA_KEYS.sessions, async () => ({
      sessions: cached.sessions,
      daily: cached.daily,
    }));

    ctx.data.register(DATA_KEYS.agentBreakdown, async () => ({
      agents: cached.agentBreakdown,
    }));

    ctx.data.register(DATA_KEYS.budgetStatus, async () => {
      let budget: BudgetState | null = null;
      try {
        budget = (await ctx.state.get({
          scopeKind: "instance",
          stateKey: STATE_KEYS.tokenBudget,
        })) as BudgetState | null;
      } catch {
        /* not set */
      }
      return {
        budget,
        currentSpend: cached.overview.todaySpend,
        utilization: null,
      };
    });

    ctx.data.register(DATA_KEYS.savingsReport, async () => ({}));

    ctx.data.register(DATA_KEYS.savings, async () => cached.savings);

    // ── Actions ────────────────────────────────────────────────────────────

    ctx.actions.register(ACTION_KEYS.refreshTokenData, async () => {
      return { ok: true, lastUpdated: cached.overview.lastUpdated, note: "Push data via webhook to update" };
    });

    ctx.actions.register(ACTION_KEYS.setTokenBudget, async (params) => {
      const p = params as { monthlyLimitCents?: number; alertThresholdPercent?: number };
      const budget: BudgetState = {
        monthlyLimitCents: p.monthlyLimitCents ?? 0,
        alertThresholdPercent: p.alertThresholdPercent ?? 80,
        updatedAt: new Date().toISOString(),
      };
      await ctx.state.set({ scopeKind: "instance", stateKey: STATE_KEYS.tokenBudget }, budget);
      ctx.logger.info("Token budget updated", p);

      await ctx.state.set({ scopeKind: "instance", stateKey: STATE_KEYS.tokenData }, cached);

      return { ok: true };
    });

    // ── Job handler ────────────────────────────────────────────────────────

    ctx.jobs.register(JOB_KEYS.collectTokens, async (_job: PluginJobContext) => {
      ctx.logger.info("Running scheduled token aggregation");

      // Recompute today's spend/tokens from daily data
      cached.overview = {
        ...cached.overview,
        todaySpend: computeTodaySpend(cached.daily),
        todayTokens: computeTodayTokens(cached.daily),
        lastUpdated: new Date().toISOString(),
      };
      await ctx.state.set({ scopeKind: "instance", stateKey: STATE_KEYS.tokenData }, cached);

      ctx.logger.info("Token aggregation complete", {
        bars: cached.overview.bars.length,
        todaySpend: cached.overview.todaySpend,
      });
    });

    // ── Events ─────────────────────────────────────────────────────────────

    ctx.events.on("agent.run.finished", async (event) => {
      ctx.logger.info("Agent run finished", { entityId: event.entityId });
    });

    ctx.events.on("cost_event.created", async (event) => {
      ctx.logger.info("Cost event recorded", { entityId: event.entityId });
    });
  },

  // ── Webhook: receive pushed ccusage data ─────────────────────────────────

  async onWebhook(input: PluginWebhookInput): Promise<void> {
    const body = input.parsedBody as WebhookPayload | undefined;

    if (!body || body.type !== "ccusage-sync") {
      pluginCtx?.logger.warn("Invalid webhook payload", { endpointKey: input.endpointKey });
      return;
    }

    if (pluginCtx) {
      await processWebhookData(pluginCtx, body);
      pluginCtx.logger.info("Webhook data processed", {
        sessions: body.sessions?.length ?? 0,
        hasUsage: !!body.usage,
      });
    }
  },

  async onHealth() {
    const barCount = cached.overview.bars.length;
    const lastUpdated = cached.overview.lastUpdated;

    return {
      status: "ok" as const,
      message: barCount > 0
        ? `${barCount} usage windows, $${cached.overview.todaySpend.toFixed(2)} today`
        : "Awaiting data — push via webhook",
      details: { barCount, todaySpend: cached.overview.todaySpend, lastUpdated },
    };
  },
});

// Module-level ctx reference for onWebhook (set in setup)
let pluginCtx: PluginContext | null = null;

export default plugin;
runWorker(plugin, import.meta.url);
