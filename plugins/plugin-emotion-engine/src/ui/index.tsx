import { useState, useEffect, type CSSProperties } from 'react'
import {
  usePluginAction,
  usePluginData,
  type PluginPageProps,
  type PluginWidgetProps,
  type PluginSettingsPageProps,
} from '@paperclipai/plugin-sdk/ui'
import { DATA_KEYS, ACTION_KEYS, EMOTION_NAMES } from '../constants.js'

// ── Types ──────────────────────────────────────────────────────────────────

type Emotions = Record<string, number>

type EmotionState = {
  agentId: string
  emotions: Emotions
  personality: { name: string; temperament: string }
  lastUpdated: string
  consecutiveFailures: number
  consecutiveSuccesses: number
  idleTicks: number
  taskQueueSize: number
}

type AllEmotionsData = { agents: EmotionState[] }
type PersonalitiesData = { presets: Record<string, { name: string; temperament: string }> }

// ── Styles ─────────────────────────────────────────────────────────────────

const mono: CSSProperties = {
  fontFamily: 'var(--font-mono, ui-monospace, monospace)',
  fontVariantNumeric: 'tabular-nums',
}

const mutedText: CSSProperties = {
  color: 'hsl(var(--muted-foreground, 220 9% 55%))',
  fontSize: '0.75rem',
}

const sectionHeading: CSSProperties = {
  fontSize: '0.6875rem',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.16em',
  color: 'hsl(var(--muted-foreground, 220 9% 55%))',
  fontWeight: 600,
}

const cardStyle: CSSProperties = {
  border: '1px solid hsl(var(--border, 220 13% 20%))',
  borderRadius: '0.5rem',
  padding: '1rem 1.25rem',
  background: 'hsl(var(--card, 222 17% 12%))',
}

// ── Helpers ────────────────────────────────────────────────────────────────

const EMOTION_COLORS: Record<string, string> = {
  frustration: '#ef4444',
  curiosity: '#3b82f6',
  satisfaction: '#22c55e',
  motivation: '#f59e0b',
  anxiety: '#f97316',
  calm: '#06b6d4',
  trust: '#8b5cf6',
  insecurity: '#ec4899',
  surprise: '#a855f7',
}

function getAgentStatusColor(emotions: Emotions): string {
  if (emotions.frustration > 0.6 && emotions.anxiety > 0.6) return '#ef4444' // spiral - red
  if (emotions.frustration > 0.5 || emotions.anxiety > 0.5) return '#f59e0b' // warning - yellow
  if (emotions.motivation < 0.2 && emotions.satisfaction < 0.2) return '#3b82f6' // standby - blue
  return '#22c55e' // healthy - green
}

function EmotionBar({ name, value, compact = false }: { name: string; value: number; compact?: boolean }) {
  const color = EMOTION_COLORS[name] ?? '#888'
  const height = compact ? 4 : 6
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <span style={{ ...mutedText, width: compact ? 60 : 80, fontSize: compact ? '0.625rem' : '0.6875rem', textAlign: 'right' }}>
        {name}
      </span>
      <div style={{ flex: 1, height, borderRadius: height / 2, background: 'hsl(var(--border, 220 13% 20%))' }}>
        <div
          style={{
            height: '100%',
            width: `${Math.min(100, value * 100)}%`,
            borderRadius: height / 2,
            background: color,
            transition: 'width 0.4s ease',
          }}
        />
      </div>
      <span style={{ ...mono, fontSize: compact ? '0.625rem' : '0.6875rem', width: 32, textAlign: 'right' }}>
        {value.toFixed(2)}
      </span>
    </div>
  )
}

function AgentEmotionCard({ state, compact = false }: { state: EmotionState; compact?: boolean }) {
  const statusColor = getAgentStatusColor(state.emotions)
  return (
    <div style={{ ...cardStyle, padding: compact ? '0.5rem 0.75rem' : '1rem 1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: compact ? '0.25rem' : '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor, display: 'inline-block' }} />
          <span style={{ fontWeight: 500, fontSize: compact ? '0.75rem' : '0.875rem' }}>
            {state.agentId.slice(0, 8)}
          </span>
          <span style={{ ...mutedText, fontSize: '0.625rem' }}>{state.personality.name}</span>
        </div>
        <span style={{ ...mutedText, fontSize: '0.625rem' }}>
          Q:{state.taskQueueSize} F:{state.consecutiveFailures} S:{state.consecutiveSuccesses}
        </span>
      </div>
      <div style={{ display: 'grid', gap: compact ? '0.125rem' : '0.25rem' }}>
        {EMOTION_NAMES.map((name) => (
          <EmotionBar key={name} name={name} value={state.emotions[name] ?? 0} compact={compact} />
        ))}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD WIDGET
// ═══════════════════════════════════════════════════════════════════════════════

export function DashboardWidget(_props: PluginWidgetProps) {
  const { data, loading, error, refresh } = usePluginData<AllEmotionsData>(DATA_KEYS.allEmotions)

  useEffect(() => {
    const id = setInterval(() => { void refresh() }, 30_000)
    return () => clearInterval(id)
  }, [refresh])

  if (loading) return <div style={mutedText}>Loading emotions...</div>
  if (error) return <div style={{ color: '#ef4444', fontSize: '0.75rem' }}>Error loading emotions</div>
  if (!data || data.agents.length === 0) {
    return (
      <div style={{ display: 'grid', gap: '0.5rem' }}>
        <span style={sectionHeading}>AGENT EMOTIONS</span>
        <div style={mutedText}>No agents enrolled. Use the enroll action to add agents.</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gap: '0.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={sectionHeading}>AGENT EMOTIONS</span>
        <button
          onClick={() => { void refresh() }}
          style={{ background: 'none', border: '1px solid hsl(var(--border))', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', color: 'inherit', fontSize: '0.7rem' }}
        >
          ↻
        </button>
      </div>
      {data.agents.map((agent) => (
        <AgentEmotionCard key={agent.agentId} state={agent} compact />
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// EMOTION PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export function EmotionPage(_props: PluginPageProps) {
  const { data, loading, refresh } = usePluginData<AllEmotionsData>(DATA_KEYS.allEmotions)
  const { data: personalities } = usePluginData<PersonalitiesData>(DATA_KEYS.personalities)
  const resetAction = usePluginAction(ACTION_KEYS.resetEmotions)
  const [tab, setTab] = useState<'live' | 'personalities'>('live')

  useEffect(() => {
    const id = setInterval(() => { void refresh() }, 15_000)
    return () => clearInterval(id)
  }, [refresh])

  if (loading) return <div style={{ padding: '2rem', ...mutedText }}>Loading emotion data...</div>

  const tabBtn = (t: typeof tab): CSSProperties => ({
    padding: '0.5rem 1rem',
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    borderBottom: tab === t ? '2px solid hsl(var(--primary, 0 0% 100%))' : '2px solid transparent',
    color: tab === t ? 'inherit' : 'hsl(var(--muted-foreground))',
    fontSize: '0.875rem',
    fontWeight: tab === t ? 500 : 400,
  })

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Emotion Engine</h2>
        <button
          onClick={() => { void refresh() }}
          style={{ background: 'none', border: '1px solid hsl(var(--border))', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', color: 'inherit', fontSize: '0.8rem' }}
        >
          Refresh
        </button>
      </div>

      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid hsl(var(--border))' }}>
        {([['live', 'Live State'], ['personalities', 'Personalities']] as const).map(([t, label]) => (
          <button key={t} style={tabBtn(t)} onClick={() => setTab(t)}>{label}</button>
        ))}
      </div>

      {tab === 'live' && (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {!data || data.agents.length === 0 ? (
            <div style={{ ...mutedText, padding: '2rem', textAlign: 'center' }}>
              No agents enrolled in emotion system.
            </div>
          ) : (
            data.agents.map((agent) => (
              <div key={agent.agentId}>
                <AgentEmotionCard state={agent} />
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button
                    onClick={() => { void resetAction({ agentId: agent.agentId }) }}
                    style={{ ...mutedText, background: 'none', border: '1px solid hsl(var(--border))', borderRadius: 4, padding: '4px 8px', cursor: 'pointer', color: 'inherit' }}
                  >
                    Reset
                  </button>
                  <span style={{ ...mutedText, alignSelf: 'center' }}>
                    Updated: {new Date(agent.lastUpdated).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'personalities' && personalities && (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {Object.entries(personalities.presets).map(([name, preset]) => (
            <div key={name} style={cardStyle}>
              <div style={{ fontWeight: 500, fontSize: '0.875rem', marginBottom: '0.25rem' }}>{name}</div>
              <div style={mutedText}>{preset.temperament}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// SETTINGS PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export function SettingsPage(_props: PluginSettingsPageProps) {
  const { data } = usePluginData<AllEmotionsData>(DATA_KEYS.allEmotions)
  const { data: personalities } = usePluginData<PersonalitiesData>(DATA_KEYS.personalities)
  const setPersonality = usePluginAction(ACTION_KEYS.setPersonality)
  const enrollAgent = usePluginAction(ACTION_KEYS.enrollAgent)
  const [enrollId, setEnrollId] = useState('')
  const [enrollRole, setEnrollRole] = useState('backend-engineer')

  return (
    <div style={{ display: 'grid', gap: '1.5rem', maxWidth: 600 }}>
      <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>Emotion Engine Settings</h3>

      <div style={cardStyle}>
        <div style={{ ...sectionHeading, marginBottom: '0.75rem' }}>ENROLL AGENT</div>
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          <input
            type="text"
            value={enrollId}
            onChange={(e) => setEnrollId(e.target.value)}
            placeholder="Agent ID"
            style={{ width: '100%', padding: '0.5rem', borderRadius: 4, border: '1px solid hsl(var(--border))', background: 'hsl(var(--background))', color: 'inherit', fontSize: '0.875rem' }}
          />
          <select
            value={enrollRole}
            onChange={(e) => setEnrollRole(e.target.value)}
            style={{ width: '100%', padding: '0.5rem', borderRadius: 4, border: '1px solid hsl(var(--border))', background: 'hsl(var(--background))', color: 'inherit', fontSize: '0.875rem' }}
          >
            {['ceo', 'cto', 'pm', 'dispatcher', 'frontend-engineer', 'backend-engineer', 'sql-engineer', 'security-engineer', 'qa-engineer', 'seo-specialist', 'devops-engineer'].map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <button
            onClick={() => { void enrollAgent({ agentId: enrollId, role: enrollRole }); setEnrollId('') }}
            disabled={!enrollId}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: 6,
              cursor: enrollId ? 'pointer' : 'default',
              background: 'hsl(var(--primary, 0 0% 100%))',
              color: 'hsl(var(--primary-foreground, 0 0% 0%))',
              border: 'none',
              fontWeight: 500,
              fontSize: '0.875rem',
              opacity: enrollId ? 1 : 0.5,
            }}
          >
            Enroll
          </button>
        </div>
      </div>

      {data && data.agents.length > 0 && (
        <div style={cardStyle}>
          <div style={{ ...sectionHeading, marginBottom: '0.75rem' }}>ENROLLED AGENTS</div>
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {data.agents.map((agent) => (
              <div key={agent.agentId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.25rem 0' }}>
                <span style={{ fontSize: '0.8125rem' }}>{agent.agentId.slice(0, 8)} — {agent.personality.name}</span>
                {personalities && (
                  <select
                    value={agent.personality.name}
                    onChange={(e) => { void setPersonality({ agentId: agent.agentId, preset: e.target.value }) }}
                    style={{ padding: '0.25rem', borderRadius: 4, border: '1px solid hsl(var(--border))', background: 'hsl(var(--background))', color: 'inherit', fontSize: '0.75rem' }}
                  >
                    {Object.keys(personalities.presets).map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
