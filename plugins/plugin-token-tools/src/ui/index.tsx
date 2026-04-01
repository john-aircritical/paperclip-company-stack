import { useState, useEffect, type CSSProperties, type ReactNode } from "react";
import {
  usePluginAction,
  usePluginData,
  useHostContext,
  type PluginPageProps,
  type PluginWidgetProps,
  type PluginSettingsPageProps,
} from "@paperclipai/plugin-sdk/ui";
import { DATA_KEYS, ACTION_KEYS } from "../constants.js";

// ── Types ────────────────────────────────────────────────────────────────────

type UsageBar = {
  label: string;
  percent: number;
  resetLabel: string;
  pacePercent: number;
  barColor: string;
  ticks?: number[];
};

type UsageOverview = {
  bars: UsageBar[];
  todaySpend: number;
  todayTokens: number;
  lastUpdated: string;
};

type AgentUsage = {
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

type AgentBreakdownData = { agents: AgentUsage[] };

type SessionEntry = {
  sessionId: string;
  totalTokens: number;
  totalCost: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  lastActivity: string;
  modelsUsed: string[];
  projectPath: string;
};

type DailyEntry = { date: string; totalTokens: number; totalCost: number };
type SessionData = { sessions: SessionEntry[]; daily: DailyEntry[] };

type ToolSavings = {
  tool: string;
  active: boolean;
  totalSaved: number;
  avgSavingsPct: number;
  history: { time: string; savedTokens: number; savedPct: number; cmd?: string }[];
  extra?: Record<string, unknown>;
};

type SavingsSnapshot = {
  combinedSaved: number;
  tools: ToolSavings[];
  collectedAt: string;
};

// ── Shared styles ────────────────────────────────────────────────────────────

const mono: CSSProperties = {
  fontFamily: "var(--font-mono, ui-monospace, monospace)",
  fontVariantNumeric: "tabular-nums",
};

const mutedText: CSSProperties = {
  color: "hsl(var(--muted-foreground, 220 9% 55%))",
  fontSize: "0.75rem",
};

const sectionHeading: CSSProperties = {
  fontSize: "0.6875rem",
  textTransform: "uppercase" as const,
  letterSpacing: "0.16em",
  color: "hsl(var(--muted-foreground, 220 9% 55%))",
  fontWeight: 600,
};

const cardStyle: CSSProperties = {
  border: "1px solid hsl(var(--border, 220 13% 20%))",
  borderRadius: "0.5rem",
  padding: "1rem 1.25rem",
  background: "hsl(var(--card, 222 17% 12%))",
};

// ── Format helpers ───────────────────────────────────────────────────────────

function formatTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatCost(dollars: number): string {
  return `$${dollars.toFixed(2)}`;
}

const TOOL_COLORS: Record<string, string> = {
  rtk: "#f59e0b",
  headroom: "#8b5cf6",
  jcodemunch: "#06b6d4",
  jdocmunch: "#10b981",
};

// ── Usage Bar Component ──────────────────────────────────────────────────────

function UsageBarRow({ bar, compact = false }: { bar: UsageBar; compact?: boolean }) {
  const paceColor = bar.pacePercent > 0 ? "#ef4444" : "#22c55e";
  const paceLabel =
    bar.pacePercent > 0
      ? `+${bar.pacePercent}% over pace`
      : bar.pacePercent < 0
        ? `${Math.abs(bar.pacePercent)}% under pace`
        : "on pace";
  const barHeight = compact ? 8 : 10;
  const fontSize = compact ? "0.75rem" : "0.8125rem";

  return (
    <div style={{ display: "grid", gap: compact ? "0.125rem" : "0.25rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontSize, fontWeight: 500 }}>{bar.label}</span>
        <span
          style={{
            ...mono,
            fontSize: compact ? "0.875rem" : "1rem",
            fontWeight: 700,
            color: bar.percent > 85 ? "#ef4444" : bar.percent > 60 ? "#f59e0b" : "inherit",
          }}
        >
          {bar.percent}%
        </span>
      </div>
      <div
        style={{
          position: "relative",
          height: barHeight,
          borderRadius: barHeight / 2,
          background: "hsl(var(--border, 220 13% 20%))",
          overflow: "visible",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${Math.min(100, bar.percent)}%`,
            borderRadius: barHeight / 2,
            background: bar.barColor,
            transition: "width 0.6s ease",
            boxShadow: `0 0 6px ${bar.barColor}66`,
          }}
        />
        {bar.ticks?.map((tick) => (
          <div
            key={tick}
            style={{
              position: "absolute",
              left: `${tick}%`,
              top: -2,
              width: 2,
              height: barHeight + 4,
              background: "hsl(var(--foreground, 0 0% 100%))",
              opacity: 0.5,
              borderRadius: 1,
            }}
          />
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ ...mutedText, fontSize: compact ? "0.6875rem" : "0.75rem" }}>
          {bar.resetLabel}
        </span>
        <span
          style={{ ...mono, fontSize: compact ? "0.6875rem" : "0.75rem", color: paceColor, fontWeight: 500 }}
        >
          {paceLabel}
        </span>
      </div>
    </div>
  );
}

// ── Savings Section Component ────────────────────────────────────────────────

const TIME_WINDOWS = [
  { label: "5m", seconds: 300 },
  { label: "15m", seconds: 900 },
  { label: "1h", seconds: 3600 },
  { label: "6h", seconds: 21600 },
  { label: "24h", seconds: 86400 },
  { label: "All", seconds: 0 },
] as const;

function filterByWindow(
  history: { time: string; savedTokens: number; savedPct: number }[],
  windowSeconds: number,
): { time: string; savedTokens: number; savedPct: number }[] {
  if (windowSeconds === 0) return history;
  const cutoff = Date.now() - windowSeconds * 1000;
  return history.filter((h) => new Date(h.time).getTime() >= cutoff);
}

function sumSaved(history: { savedTokens: number }[]): number {
  return history.reduce((s, h) => s + h.savedTokens, 0);
}

function SavingsSection({ savings, compact = false }: { savings: SavingsSnapshot | null; compact?: boolean }) {
  const [window, setWindow] = useState(0); // 0 = all time

  if (!savings || !savings.tools || savings.tools.length === 0) {
    return compact ? null : (
      <div style={{ ...mutedText, padding: "0.5rem 0" }}>
        No savings data. Push via webhook to see tool savings.
      </div>
    );
  }

  const windowBtnStyle = (active: boolean): CSSProperties => ({
    padding: compact ? "1px 6px" : "2px 8px",
    fontSize: compact ? "0.625rem" : "0.6875rem",
    borderRadius: 3,
    border: active ? "1px solid hsl(var(--primary, 0 0% 100%))" : "1px solid hsl(var(--border))",
    background: active ? "hsl(var(--primary, 0 0% 100%) / 0.15)" : "none",
    color: "inherit",
    cursor: "pointer",
    fontFamily: "inherit",
  });

  // Compute per-tool savings for selected window
  const toolStats = savings.tools
    .filter((t) => t.active)
    .map((t) => {
      const filtered = filterByWindow(t.history, window);
      const saved = window === 0 ? t.totalSaved : sumSaved(filtered);
      return { ...t, windowSaved: saved, windowEvents: filtered.length };
    })
    .sort((a, b) => b.windowSaved - a.windowSaved);

  const combinedWindowSaved = window === 0
    ? savings.combinedSaved
    : toolStats.reduce((s, t) => s + t.windowSaved, 0);

  return (
    <div style={{ display: "grid", gap: compact ? "0.375rem" : "0.5rem" }}>
      {/* Header with time window selector */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={sectionHeading}>TOKEN SAVINGS</span>
        <div style={{ display: "flex", gap: "0.25rem" }}>
          {TIME_WINDOWS.map((tw) => (
            <button
              key={tw.label}
              onClick={() => setWindow(tw.seconds)}
              style={windowBtnStyle(window === tw.seconds)}
            >
              {tw.label}
            </button>
          ))}
        </div>
      </div>

      {/* Combined total */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontSize: compact ? "0.75rem" : "0.8125rem", fontWeight: 500 }}>
          Combined
        </span>
        <span style={{ ...mono, fontSize: compact ? "0.875rem" : "1rem", fontWeight: 700, color: "#22c55e" }}>
          {formatTokens(combinedWindowSaved)}
        </span>
      </div>

      {/* Per-tool breakdown */}
      {toolStats.map((t) => (
        <div key={t.tool} style={{ display: "grid", gap: "0.125rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: TOOL_COLORS[t.tool] ?? "#888",
                  display: "inline-block",
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: compact ? "0.6875rem" : "0.75rem", fontWeight: 500 }}>
                {t.tool}
              </span>
            </div>
            <span style={{ ...mono, fontSize: compact ? "0.75rem" : "0.8125rem", color: "#22c55e" }}>
              {formatTokens(t.windowSaved)}
            </span>
          </div>
          {/* Mini bar showing this tool's share */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div
              style={{
                flex: 1,
                height: compact ? 3 : 4,
                borderRadius: 2,
                background: "hsl(var(--border, 220 13% 20%))",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${combinedWindowSaved > 0 ? Math.max(1, (t.windowSaved / combinedWindowSaved) * 100) : 0}%`,
                  background: TOOL_COLORS[t.tool] ?? "#888",
                  borderRadius: 2,
                }}
              />
            </div>
            <span style={{ ...mutedText, fontSize: compact ? "0.5625rem" : "0.625rem", minWidth: "2.5rem", textAlign: "right" }}>
              {t.avgSavingsPct > 0 ? `${t.avgSavingsPct.toFixed(0)}% avg` : ""}
            </span>
          </div>
        </div>
      ))}

      {/* Timestamp */}
      {!compact && savings.collectedAt && (
        <div style={{ ...mutedText, textAlign: "right", marginTop: "0.25rem" }}>
          collected {new Date(savings.collectedAt).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD WIDGET — compact usage bars + savings for the main dashboard
// ═══════════════════════════════════════════════════════════════════════════════

export function DashboardWidget(_props: PluginWidgetProps) {
  const { data, loading, error, refresh } = usePluginData<UsageOverview>(DATA_KEYS.overview);
  const { data: savings, refresh: refreshSavings } = usePluginData<SavingsSnapshot>(DATA_KEYS.savings);

  // Auto-poll every 30s
  useEffect(() => {
    const id = setInterval(() => { void refresh(); void refreshSavings(); }, 30_000);
    return () => clearInterval(id);
  }, [refresh, refreshSavings]);

  if (loading) return <div style={mutedText}>Loading usage data...</div>;
  if (error) {
    return (
      <div style={{ color: "#ef4444", fontSize: "0.75rem" }}>
        Usage error: {String((error as { message?: string }).message ?? error)}
      </div>
    );
  }

  const hasBars = data && data.bars && data.bars.length > 0;
  const hasSavings = savings && savings.tools && savings.tools.length > 0;

  if (!hasBars && !hasSavings) {
    return (
      <div style={{ display: "grid", gap: "0.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={sectionHeading}>CLAUDE USAGE</span>
          <button
            onClick={() => { void refresh(); void refreshSavings(); }}
            style={{
              background: "none",
              border: "1px solid hsl(var(--border))",
              borderRadius: 4,
              padding: "2px 8px",
              cursor: "pointer",
              color: "inherit",
              fontSize: "0.7rem",
            }}
          >
            ↻
          </button>
        </div>
        <div style={{ ...mutedText, padding: "0.5rem 0" }}>
          No usage data yet. Push data via the token-ingest webhook.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: "0.75rem" }}>
      {/* Header */}
      {hasBars && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={sectionHeading}>CLAUDE USAGE</span>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <span style={{ ...mutedText, ...mono }}>
                {formatTokens(data!.todayTokens ?? 0)} tokens today
              </span>
              <button
                onClick={() => { void refresh(); void refreshSavings(); }}
                style={{
                  background: "none",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 4,
                  padding: "2px 8px",
                  cursor: "pointer",
                  color: "inherit",
                  fontSize: "0.7rem",
                }}
              >
                ↻
              </button>
            </div>
          </div>
          {data!.bars.map((bar, i) => (
            <UsageBarRow key={i} bar={bar} compact />
          ))}
        </>
      )}

      {/* Savings section */}
      {hasSavings && (
        <div style={{ marginTop: hasBars ? "0.25rem" : 0 }}>
          <SavingsSection savings={savings!} compact />
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOKENS PAGE — full usage analytics view
// ═══════════════════════════════════════════════════════════════════════════════

function Expandable({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ ...cardStyle, padding: 0 }}>
      <div
        style={{
          padding: "0.75rem 1rem",
          cursor: "pointer",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
        onClick={() => setOpen(!open)}
      >
        <span style={{ fontWeight: 500, fontSize: "0.875rem" }}>{title}</span>
        <span style={{ ...mutedText, fontSize: "1rem" }}>{open ? "▾" : "▸"}</span>
      </div>
      {open && (
        <div style={{ padding: "0 1rem 1rem", borderTop: "1px solid hsl(var(--border, 220 13% 20%))" }}>
          {children}
        </div>
      )}
    </div>
  );
}

export function TokensPage(_props: PluginPageProps) {
  const { data: overview, loading: lo, refresh: refreshOverview } = usePluginData<UsageOverview>(DATA_KEYS.overview);
  const { data: sessionData, loading: ls, refresh: refreshSessions } = usePluginData<SessionData>(DATA_KEYS.sessions);
  const { data: agentData, loading: la, refresh: refreshAgents } = usePluginData<AgentBreakdownData>(DATA_KEYS.agentBreakdown);
  const { data: savings, refresh: refreshSavings } = usePluginData<SavingsSnapshot>(DATA_KEYS.savings);
  const [tab, setTab] = useState<"usage" | "savings" | "agents" | "sessions" | "daily">("usage");

  const refreshAll = () => {
    void refreshOverview();
    void refreshSessions();
    void refreshAgents();
    void refreshSavings();
  };

  // Auto-poll every 30s
  useEffect(() => {
    const id = setInterval(refreshAll, 30_000);
    return () => clearInterval(id);
  }, [refreshOverview, refreshSessions, refreshAgents, refreshSavings]);

  const loading = lo || ls || la;

  if (loading) {
    return (
      <div style={{ padding: "2rem" }}>
        <div style={mutedText}>Loading token data...</div>
      </div>
    );
  }

  const tabBtn = (t: typeof tab): CSSProperties => ({
    padding: "0.5rem 1rem",
    cursor: "pointer",
    background: "none",
    border: "none",
    borderBottom: tab === t
      ? "2px solid hsl(var(--primary, 0 0% 100%))"
      : "2px solid transparent",
    color: tab === t ? "inherit" : "hsl(var(--muted-foreground))",
    fontSize: "0.875rem",
    fontWeight: tab === t ? 500 : 400,
  });

  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0 }}>Claude Usage</h2>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          {overview && (
            <span style={{ ...mutedText, ...mono }}>
              {formatTokens(overview.todayTokens ?? 0)} tokens today
            </span>
          )}
          <button
            onClick={refreshAll}
            style={{
              background: "none",
              border: "1px solid hsl(var(--border))",
              borderRadius: 6,
              padding: "6px 14px",
              cursor: "pointer",
              color: "inherit",
              fontSize: "0.8rem",
            }}
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Usage bars — always visible at top */}
      {overview && overview.bars && overview.bars.length > 0 && (
        <div style={{ ...cardStyle, display: "grid", gap: "1rem" }}>
          {overview.bars.map((bar, i) => (
            <UsageBarRow key={i} bar={bar} />
          ))}
        </div>
      )}

      {(!overview || !overview.bars || overview.bars.length === 0) && (
        <div style={{ ...cardStyle, ...mutedText, textAlign: "center", padding: "2rem" }}>
          No usage data yet. Push data via the token-ingest webhook to see rate limit utilization.
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid hsl(var(--border))" }}>
        {(
          [
            ["usage", "Usage"],
            ["savings", "Savings"],
            ["agents", "By Agent"],
            ["sessions", "Sessions"],
            ["daily", "Daily"],
          ] as const
        ).map(([t, label]) => (
          <button key={t} style={tabBtn(t)} onClick={() => setTab(t)}>
            {label}
          </button>
        ))}
      </div>

      {/* Tab: Usage detail */}
      {tab === "usage" && overview && (
        <div style={{ display: "grid", gap: "1rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
            <StatTile label="Tokens Today" value={formatTokens(overview.todayTokens ?? 0)} />
            <StatTile label="Last Updated" value={new Date(overview.lastUpdated).toLocaleTimeString()} />
            <StatTile label="Bars" value={String(overview.bars?.length ?? 0)} subtitle="rate limit windows" />
          </div>
          {overview.bars && overview.bars.length > 0 && (
            <div style={{ display: "grid", gap: "0.5rem" }}>
              {overview.bars.map((bar, i) => (
                <div key={i} style={cardStyle}>
                  <UsageBarRow bar={bar} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Savings */}
      {tab === "savings" && (
        <div style={cardStyle}>
          <SavingsSection savings={savings ?? null} />
        </div>
      )}

      {/* Tab: Agents */}
      {tab === "agents" && agentData && (
        <div style={{ display: "grid", gap: "0.5rem" }}>
          {agentData.agents.length === 0 ? (
            <div style={{ ...mutedText, padding: "2rem", textAlign: "center" }}>
              No agent data yet. Agent usage appears after agents run tasks.
            </div>
          ) : (
            agentData.agents.map((agent) => (
              <Expandable key={agent.agentId} title={`${agent.agentName} — ${formatCost(agent.totalCost)}`}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr",
                    gap: "0.75rem",
                    paddingTop: "0.75rem",
                    fontSize: "0.8125rem",
                  }}
                >
                  <div><div style={sectionHeading}>Sessions</div><div style={mono}>{agent.sessionCount}</div></div>
                  <div><div style={sectionHeading}>Total Tokens</div><div style={mono}>{formatTokens(agent.totalTokens)}</div></div>
                  <div><div style={sectionHeading}>Cost</div><div style={mono}>{formatCost(agent.totalCost)}</div></div>
                  <div><div style={sectionHeading}>Input</div><div style={mono}>{formatTokens(agent.inputTokens)}</div></div>
                  <div><div style={sectionHeading}>Output</div><div style={mono}>{formatTokens(agent.outputTokens)}</div></div>
                  <div><div style={sectionHeading}>Cache Read</div><div style={mono}>{formatTokens(agent.cacheReadTokens)}</div></div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <div style={sectionHeading}>Models</div>
                    <div style={{ ...mono, fontSize: "0.75rem" }}>{agent.modelsUsed.join(", ")}</div>
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <div style={sectionHeading}>Last Activity</div>
                    <div style={mutedText}>{agent.lastActivity}</div>
                  </div>
                </div>
              </Expandable>
            ))
          )}
        </div>
      )}

      {/* Tab: Sessions */}
      {tab === "sessions" && sessionData && (
        <div>
          {sessionData.sessions.length === 0 ? (
            <div style={{ ...mutedText, padding: "2rem", textAlign: "center" }}>No sessions found.</div>
          ) : (
            <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid hsl(var(--border))" }}>
                    {["Session", "Tokens", "Cost", "Last Active", "Models"].map((h) => (
                      <th key={h} style={{ ...sectionHeading, padding: "0.75rem", textAlign: "left" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sessionData.sessions.slice(0, 50).map((s) => (
                    <tr key={s.sessionId} style={{ borderBottom: "1px solid hsl(var(--border, 220 13% 20%) / 0.5)" }}>
                      <td style={{ padding: "0.5rem 0.75rem", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {s.projectPath || s.sessionId}
                      </td>
                      <td style={{ ...mono, padding: "0.5rem 0.75rem" }}>{formatTokens(s.totalTokens)}</td>
                      <td style={{ ...mono, padding: "0.5rem 0.75rem" }}>{formatCost(s.totalCost)}</td>
                      <td style={{ ...mutedText, padding: "0.5rem 0.75rem" }}>{s.lastActivity}</td>
                      <td style={{ ...mono, padding: "0.5rem 0.75rem", fontSize: "0.7rem" }}>
                        {s.modelsUsed.map((m) => m.replace("claude-", "")).join(", ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: Daily */}
      {tab === "daily" && sessionData && (
        <div>
          {sessionData.daily.length === 0 ? (
            <div style={{ ...mutedText, padding: "2rem", textAlign: "center" }}>No daily data found.</div>
          ) : (
            <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid hsl(var(--border))" }}>
                    {["Date", "Tokens", "Cost"].map((h) => (
                      <th key={h} style={{ ...sectionHeading, padding: "0.75rem", textAlign: "left" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...sessionData.daily].reverse().map((d) => (
                    <tr key={d.date} style={{ borderBottom: "1px solid hsl(var(--border, 220 13% 20%) / 0.5)" }}>
                      <td style={{ padding: "0.5rem 0.75rem" }}>{d.date}</td>
                      <td style={{ ...mono, padding: "0.5rem 0.75rem" }}>{formatTokens(d.totalTokens)}</td>
                      <td style={{ ...mono, padding: "0.5rem 0.75rem" }}>{formatCost(d.totalCost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      {overview && (
        <div style={{ ...mutedText, textAlign: "right" }}>
          Last updated: {new Date(overview.lastUpdated).toLocaleString()}
        </div>
      )}
    </div>
  );
}

function StatTile({ label, value, subtitle }: { label: string; value: string; subtitle?: string }) {
  return (
    <div style={cardStyle}>
      <div style={sectionHeading}>{label}</div>
      <div style={{ ...mono, fontSize: "1.125rem", fontWeight: 600, marginTop: "0.25rem" }}>{value}</div>
      {subtitle && <div style={mutedText}>{subtitle}</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SETTINGS PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export function SettingsPage(_props: PluginSettingsPageProps) {
  const { data: budgetData } = usePluginData<{
    budget: { monthlyLimitCents?: number; alertThresholdPercent?: number } | null;
  }>(DATA_KEYS.budgetStatus);
  const setBudget = usePluginAction(ACTION_KEYS.setTokenBudget);
  const [limitInput, setLimitInput] = useState("");
  const [thresholdInput, setThresholdInput] = useState("80");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await setBudget({
        monthlyLimitCents: Math.round(parseFloat(limitInput || "0") * 100),
        alertThresholdPercent: parseInt(thresholdInput, 10) || 80,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: "1.5rem", maxWidth: 500 }}>
      <h3 style={{ fontSize: "1rem", fontWeight: 600, margin: 0 }}>Token Budget</h3>
      <div style={cardStyle}>
        <div style={{ display: "grid", gap: "1rem" }}>
          <div>
            <label style={{ ...sectionHeading, display: "block", marginBottom: "0.5rem" }}>Monthly Limit ($)</label>
            <input
              type="number"
              value={limitInput}
              onChange={(e) => setLimitInput(e.target.value)}
              placeholder={budgetData?.budget?.monthlyLimitCents ? String(budgetData.budget.monthlyLimitCents / 100) : "0 (unlimited)"}
              style={{ width: "100%", padding: "0.5rem", borderRadius: 4, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))", color: "inherit", fontSize: "0.875rem" }}
            />
          </div>
          <div>
            <label style={{ ...sectionHeading, display: "block", marginBottom: "0.5rem" }}>Alert Threshold (%)</label>
            <input
              type="number"
              value={thresholdInput}
              onChange={(e) => setThresholdInput(e.target.value)}
              placeholder="80"
              min={1}
              max={100}
              style={{ width: "100%", padding: "0.5rem", borderRadius: 4, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))", color: "inherit", fontSize: "0.875rem" }}
            />
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: 6,
              cursor: "pointer",
              background: "hsl(var(--primary, 0 0% 100%))",
              color: "hsl(var(--primary-foreground, 0 0% 0%))",
              border: "none",
              fontWeight: 500,
              fontSize: "0.875rem",
              opacity: saving ? 0.5 : 1,
            }}
          >
            {saving ? "Saving..." : "Save Budget"}
          </button>
        </div>
      </div>
      {budgetData?.budget && (
        <div style={mutedText}>
          Current: ${((budgetData.budget.monthlyLimitCents ?? 0) / 100).toFixed(2)}/mo · Alert at {budgetData.budget.alertThresholdPercent ?? 80}%
        </div>
      )}
    </div>
  );
}
