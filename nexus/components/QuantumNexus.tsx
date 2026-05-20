'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { ls } from '@/lib/storage'
import type { LogEntry, LogType, Message, CoinData, Repo, AgentVote, Keys, KanbanCol, Tab, RevParams } from '@/lib/types'

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const MODELS = [
  { id: 'anthropic/claude-sonnet-4-5',    name: '⬡ Claude',   color: '#CC785C' },
  { id: 'openai/gpt-4o',                  name: '✦ GPT-4o',   color: '#74AA9C' },
  { id: 'google/gemini-2.0-flash-001',    name: '◆ Gemini',   color: '#4285F4' },
  { id: 'x-ai/grok-2-1212',              name: '✕ Grok',     color: '#E8E8FF' },
  { id: 'deepseek/deepseek-chat',         name: '◉ DeepSeek', color: '#5B8AF0' },
  { id: 'mistralai/mistral-7b-instruct',  name: '▲ Mistral',  color: '#FF7000' },
]

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'sovereign',  label: 'SOVEREIGN HUB',  icon: '⬡' },
  { id: 'parliament', label: 'AI PARLIAMENT',  icon: '⚖' },
  { id: 'code',       label: 'KOD DERLEYİCİ', icon: '⌬' },
  { id: 'crypto',     label: 'KRİPTO',         icon: '◈' },
  { id: 'github',     label: 'GITHUB',          icon: '⌥' },
  { id: 'kanban',     label: 'KANBAN',          icon: '▦' },
  { id: 'revenue',    label: 'GELİR',           icon: '◎' },
  { id: 'keys',       label: 'API KEYS',        icon: '⊕' },
]

const AGENTS = [
  { id: 'reasoning', name: 'Grok_Reasoning',   color: '#E8E8FF', desc: 'Stratejik reasoning' },
  { id: 'core',      name: 'DeepSeek_Core',    color: '#5B8AF0', desc: 'Matematik & analiz' },
  { id: 'code',      name: 'Mistral_Code',     color: '#FF7000', desc: 'Kod & optimizasyon' },
  { id: 'general',   name: 'Claude_Sovereign', color: '#CC785C', desc: 'Sentez & koordinasyon' },
]

// ─── STYLES ───────────────────────────────────────────────────────────────────
const C = {
  bg:      '#02020C',
  panel:   '#06060F',
  border:  '#0D0D1F',
  border2: 'rgba(0,255,212,0.12)',
  teal:    '#00FFD4',
  purple:  '#7B2FFF',
  green:   '#39FF14',
  gold:    '#FFD700',
  red:     '#FF4444',
  blue:    '#00BFFF',
  discord: '#5865F2',
  dim:     '#2a2a4a',
  muted:   '#6b7280',
  text:    '#E8E8FF',
}

const panel = (accent?: string) => ({
  background: C.panel,
  border: `1px solid ${accent ?? C.border}`,
  borderRadius: 12,
  padding: 16,
  display: 'flex' as const,
  flexDirection: 'column' as const,
})

const inputStyle: React.CSSProperties = {
  background: 'rgba(0,0,0,0.7)',
  border: `1px solid ${C.dim}`,
  borderRadius: 6,
  padding: '8px 12px',
  color: C.text,
  fontFamily: 'inherit',
  fontSize: 11,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
}

const btn = (bg: string, fg: string, border?: string): React.CSSProperties => ({
  background: bg, color: fg,
  border: border ?? 'none',
  borderRadius: 6,
  padding: '8px 16px',
  fontFamily: 'inherit',
  fontSize: 11,
  fontWeight: 700,
  cursor: 'pointer',
  letterSpacing: 1,
  whiteSpace: 'nowrap',
})

const logColor = (t: LogType) =>
  t === 'error' ? C.red : t === 'success' ? C.green : t === 'warn' ? C.gold :
  t === 'agent' ? C.teal : t === 'system' ? C.purple : C.muted

// ─── COMPONENT ────────────────────────────────────────────────────────────────
export default function QuantumNexus() {
  const [mounted, setMounted] = useState(false)
  const [keys, setKeys]       = useState<Keys>({ openRouter: '', discordWebhook: '', githubToken: '' })
  const [activeTab, setActiveTab] = useState<Tab>('sovereign')

  // Logs
  const [logs, setLogs] = useState<LogEntry[]>([])
  const addLog = useCallback((msg: string, type: LogType = 'info') => {
    setLogs(p => [...p.slice(-100), { time: new Date().toLocaleTimeString('tr-TR'), msg, type }])
  }, [])

  // Telemetry
  const [tel, setTel] = useState({ uptime: 0, ram: '—', rtt: '—', agents: 4 })
  const startTs = useRef(Date.now())

  // Sovereign chat
  const [model, setModel] = useState(MODELS[0])
  const [chatIn, setChatIn] = useState('')
  const [chat, setChat]     = useState<Message[]>([])
  const [thinking, setThinking] = useState(false)

  // Parliament
  const [parlQuery, setParlQuery] = useState('')
  const [parlVotes, setParlVotes] = useState<AgentVote[]>([])
  const [consensus, setConsensus] = useState('')
  const [parlLoading, setParlLoading] = useState(false)
  const [parlConf, setParlConf] = useState(0)

  // Code
  const [codePrompt, setCodePrompt] = useState('')
  const [codeOut, setCodeOut] = useState('// Üretilecek kod burada görünecek...')

  // Crypto
  const [coins, setCoins] = useState<CoinData[]>([])
  const [coinsLoading, setCoinsLoading] = useState(false)
  const [lastCoinFetch, setLastCoinFetch] = useState<Date | null>(null)

  // GitHub
  const [ghUser, setGhUser] = useState('Erdemhasates35')
  const [repos, setRepos]   = useState<Repo[]>([])
  const [ghLoading, setGhLoading] = useState(false)

  // Kanban
  const [kanban, setKanban] = useState<Record<KanbanCol, string[]>>({ todo: [], doing: [], done: [] })
  const [newTask, setNewTask] = useState('')

  // Revenue
  const [rev, setRev] = useState<RevParams>({ users: 100, price: 29, growth: 10, churn: 5, cost: 500 })

  // Discord
  const [dc, setDc] = useState('')

  // Refs
  const chatEndRef = useRef<HTMLDivElement>(null)
  const logsEndRef = useRef<HTMLDivElement>(null)
  const parlEndRef = useRef<HTMLDivElement>(null)

  // ─── INIT ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    setMounted(true)
    setKeys(ls.get<Keys>('nexus_keys', { openRouter: '', discordWebhook: '', githubToken: '' }))
    setKanban(ls.get('nexus_kanban', { todo: [], doing: [], done: [] }))
    addLog('[SYS] QUANTUM NEXUS OS v2.0 — Sovereign AI başlatıldı.', 'system')
    addLog('[SYS] Distributed cognition katmanı hazır.', 'system')
    addLog('[SYS] API bağlantıları bekleniyor...', 'info')
  }, [addLog])

  useEffect(() => {
    const t = setInterval(() => {
      const mem = (window.performance as unknown as { memory?: { usedJSHeapSize: number } })?.memory
      const ram = mem ? `${(mem.usedJSHeapSize / 1048576).toFixed(1)}MB` : '—'
      const conn = (navigator as unknown as { connection?: { rtt: number } })?.connection
      const rtt = conn?.rtt != null ? `${conn.rtt}ms` : '—'
      setTel(p => ({ ...p, uptime: Math.floor((Date.now() - startTs.current) / 1000), ram, rtt }))
    }, 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chat, thinking])
  useEffect(() => { logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [logs])
  useEffect(() => { parlEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [parlVotes, consensus])
  useEffect(() => { if (mounted) ls.set('nexus_kanban', kanban) }, [kanban, mounted])

  // ─── API CALLS ──────────────────────────────────────────────────────────────
  const callConsensus = async (messages: Message[], systemPrompt?: string) => {
    const res = await fetch('/api/consensus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: messages.map(m => ({ role: m.role, content: m.content })), model: model.id, apiKey: keys.openRouter, systemPrompt }),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error ?? `HTTP ${res.status}`)
    }
    const data = await res.json()
    return data.content as string
  }

  const sendChat = async (isCode = false) => {
    const input = isCode ? codePrompt : chatIn
    if (!input.trim()) { addLog('[ERR] Girdi boş.', 'error'); return }
    if (!keys.openRouter) { addLog('[ERR] OpenRouter key eksik — Keys sekmesine git.', 'error'); return }

    if (!isCode) { setChatIn(''); setChat(p => [...p, { role: 'user', content: input }]) }
    else setCodeOut('// Derleniyor...')
    setThinking(true)

    const sys = isCode
      ? 'Expert software engineer. Produce only working, production-ready code. No explanations, no markdown fences.'
      : `Sen Quantum Nexus OS\'un Sovereign AI çekirdeğisin — Erdem Hasateş\'in vizyon asistanı. Türkçe yanıt ver. Dürüst, net, ve uygulanabilir ol.`

    try {
      addLog(`[API] ${model.name} → istek gönderildi...`, 'info')
      const reply = await callConsensus(
        isCode ? [{ role: 'user', content: input }] : [...chat, { role: 'user', content: input }],
        sys
      )
      if (isCode) setCodeOut(reply.replace(/```[\w]*/g, '').replace(/```/g, '').trim())
      else setChat(p => [...p, { role: 'assistant', content: reply, model: model.id }])
      addLog(`[API] ${model.name} yanıt verdi.`, 'success')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      addLog(`[API ERR] ${msg}`, 'error')
      if (isCode) setCodeOut(`// HATA: ${msg}`)
      else setChat(p => [...p, { role: 'assistant', content: `⚠ ${msg}` }])
    } finally { setThinking(false) }
  }

  const runParliament = async () => {
    if (!parlQuery.trim()) { addLog('[PARLIAMENT] Sorgu boş.', 'warn'); return }
    if (!keys.openRouter) { addLog('[PARLIAMENT] API key eksik.', 'error'); return }
    setParlLoading(true); setParlVotes([]); setConsensus('')
    addLog(`[PARLIAMENT] ${AGENTS.length} ajan parlamentoya çağrılıyor...`, 'system')
    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: parlQuery, apiKey: keys.openRouter }),
      })
      if (!res.ok) throw new Error(`Parliament HTTP ${res.status}`)
      const data = await res.json()
      setParlVotes(data.votes ?? [])
      setConsensus(data.consensus ?? '')
      setParlConf(data.avgConfidence ?? 0)
      addLog(`[PARLIAMENT] Konsensüs oluşturuldu. Ort. güven: %${data.avgConfidence}.`, 'success')
    } catch (e: unknown) {
      addLog(`[PARLIAMENT ERR] ${e instanceof Error ? e.message : String(e)}`, 'error')
    } finally { setParlLoading(false) }
  }

  const fetchCrypto = async () => {
    setCoinsLoading(true)
    addLog('[MARKET] CoinGecko API bağlantısı...', 'info')
    try {
      const res = await fetch('/api/crypto')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      const parsed: CoinData[] = Object.entries(json).map(([id, d]: [string, unknown]) => {
        const info = d as Record<string, number>
        return { id, price: info.usd ?? 0, change: info.usd_24h_change ?? 0, cap: info.usd_market_cap ?? 0, vol: info.usd_24h_vol ?? 0 }
      })
      setCoins(parsed); setLastCoinFetch(new Date())
      addLog(`[MARKET] ${parsed.length} coin verisi güncellendi.`, 'success')
    } catch (e: unknown) {
      addLog(`[MARKET ERR] ${e instanceof Error ? e.message : String(e)}`, 'error')
    } finally { setCoinsLoading(false) }
  }

  const fetchGithub = async () => {
    if (!ghUser.trim()) return
    setGhLoading(true)
    addLog(`[GITHUB] ${ghUser} repoları çekiliyor...`, 'info')
    try {
      const headers: Record<string, string> = { Accept: 'application/vnd.github.v3+json' }
      if (keys.githubToken) headers.Authorization = `token ${keys.githubToken}`
      const res = await fetch(`https://api.github.com/users/${ghUser}/repos?sort=updated&per_page=20&type=public`, { headers })
      if (res.status === 404) throw new Error(`'${ghUser}' bulunamadı`)
      if (res.status === 403) throw new Error('Rate limit — GitHub token ekle')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: Repo[] = await res.json()
      setRepos(data)
      addLog(`[GITHUB] ${data.length} repo yüklendi.`, 'success')
    } catch (e: unknown) {
      addLog(`[GITHUB ERR] ${e instanceof Error ? e.message : String(e)}`, 'error')
    } finally { setGhLoading(false) }
  }

  const sendDiscord = async () => {
    if (!keys.discordWebhook) { addLog('[DISCORD] Webhook URL eksik.', 'warn'); return }
    if (!dc.trim()) { addLog('[DISCORD] Mesaj boş.', 'warn'); return }
    try {
      const res = await fetch(keys.discordWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embeds: [{ title: '⬡ Quantum Nexus OS', description: dc, color: 0x00FFD4, footer: { text: new Date().toLocaleString('tr-TR') } }] }),
      })
      if (res.status === 204 || res.ok) { addLog('[DISCORD] Bildirim iletildi.', 'success'); setDc('') }
      else throw new Error(`HTTP ${res.status}`)
    } catch (e: unknown) {
      addLog(`[DISCORD ERR] ${e instanceof Error ? e.message : String(e)}`, 'error')
    }
  }

  const saveKeys = () => { ls.set('nexus_keys', keys); addLog('[SECURE] API anahtarları kaydedildi.', 'success') }

  // ─── KANBAN ─────────────────────────────────────────────────────────────────
  const moveTask = (col: KanbanCol, idx: number, dir: 1 | -1) => {
    const order: KanbanCol[] = ['todo', 'doing', 'done']
    const next = order[order.indexOf(col) + dir]
    if (!next) return
    const task = kanban[col][idx]
    setKanban(p => ({ ...p, [col]: p[col].filter((_, i) => i !== idx), [next]: [...p[next], task] }))
  }

  // ─── REVENUE ────────────────────────────────────────────────────────────────
  const revMonths = useMemo(() => {
    let cu = rev.users
    return Array.from({ length: 12 }, (_, i) => {
      const r = Math.round(cu * rev.price)
      const p = Math.round(r - rev.cost)
      cu = cu * (1 + rev.growth / 100) * (1 - rev.churn / 100)
      return { month: i + 1, rev: r, profit: p, users: Math.round(cu) }
    })
  }, [rev])
  const totalRev    = revMonths.reduce((a, m) => a + m.rev, 0)
  const totalProfit = revMonths.reduce((a, m) => a + m.profit, 0)
  const maxRev      = Math.max(...revMonths.map(m => m.rev), 1)

  if (!mounted) return <div style={{ minHeight: '100vh', background: C.bg }} />

  // ─── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ height: '100vh', background: C.bg, color: C.text, fontFamily: 'inherit', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Scanline overlay */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,255,212,0.008) 2px,rgba(0,255,212,0.008) 4px)' }} />

      <div style={{ maxWidth: 1700, margin: '0 auto', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 10, height: '100vh', position: 'relative', zIndex: 1, width: '100%' }}>

        {/* ── HEADER ── */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.85)', border: `1px solid ${C.border2}`, padding: '10px 20px', borderRadius: 12, flexShrink: 0, backdropFilter: 'blur(20px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ fontSize: 18, color: C.teal, letterSpacing: 5, fontWeight: 900, animation: 'flicker 4s infinite' }}>⬡ QUANTUM NEXUS OS</span>
            <span style={{ fontSize: 8, color: C.purple, border: `1px solid rgba(123,47,255,0.4)`, padding: '2px 8px', borderRadius: 4, letterSpacing: 3 }}>SOVEREIGN v2.0</span>
          </div>
          <div style={{ display: 'flex', gap: 28, fontSize: 9, color: C.muted }}>
            <span>RTT: <span style={{ color: C.green }}>{tel.rtt}</span></span>
            <span>RAM: <span style={{ color: C.gold }}>{tel.ram}</span></span>
            <span>AGENTS: <span style={{ color: C.teal }}>{tel.agents}</span></span>
            <span>UPTIME: <span style={{ color: C.teal }}>{tel.uptime}s</span></span>
            <span style={{ color: keys.openRouter ? C.green : C.red }}>{keys.openRouter ? '● ONLINE' : '○ OFFLINE'}</span>
          </div>
        </header>

        {/* ── TABS ── */}
        <div style={{ display: 'flex', gap: 4, flexShrink: 0, overflowX: 'auto' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              padding: '6px 14px', borderRadius: 8, fontSize: 9, letterSpacing: 2, textTransform: 'uppercase',
              fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap',
              border: activeTab === t.id ? `1px solid rgba(0,255,212,0.4)` : `1px solid transparent`,
              background: activeTab === t.id ? 'rgba(0,255,212,0.07)' : 'rgba(0,0,0,0.4)',
              color: activeTab === t.id ? C.teal : C.muted,
            }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* ── MAIN ── */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 250px', gap: 10, minHeight: 0 }}>

          {/* LEFT: CONTENT */}
          <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>

            {/* ── SOVEREIGN HUB ── */}
            {activeTab === 'sovereign' && (
              <div style={{ ...panel('rgba(123,47,255,0.25)'), height: '100%', minHeight: 400 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${C.border}`, paddingBottom: 10, marginBottom: 12, flexShrink: 0 }}>
                  <span style={{ color: C.purple, fontWeight: 900, fontSize: 11, letterSpacing: 3 }}>⬡ SOVEREIGN AI HUB</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {MODELS.map(m => (
                      <button key={m.id} onClick={() => setModel(m)} style={{
                        fontSize: 8, padding: '3px 8px', borderRadius: 4, fontFamily: 'inherit', cursor: 'pointer',
                        border: model.id === m.id ? `1px solid ${m.color}` : `1px solid ${C.dim}`,
                        background: model.id === m.id ? `${m.color}22` : 'transparent',
                        color: model.id === m.id ? m.color : C.muted,
                      }}>{m.name}</button>
                    ))}
                  </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 10 }}>
                  {chat.length === 0 && (
                    <div style={{ color: C.dim, fontSize: 11, textAlign: 'center', marginTop: 60, lineHeight: 2 }}>
                      Sovereign AI hazır.<br/>
                      <span style={{ fontSize: 9, color: C.muted }}>Görev ver, kod yaz, strateji oluştur.</span>
                    </div>
                  )}
                  {chat.map((m, i) => (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start', animation: 'fadeIn 0.2s ease' }}>
                      <span style={{ fontSize: 8, color: C.muted, marginBottom: 3 }}>{m.role === 'user' ? '▶ ARCHITECT' : `◀ ${MODELS.find(x => x.id === m.model)?.name ?? model.name}`}</span>
                      <div style={{ padding: '10px 14px', borderRadius: 8, maxWidth: '88%', fontSize: 11, lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: m.role === 'user' ? 'rgba(123,47,255,0.1)' : 'rgba(0,255,212,0.04)', border: m.role === 'user' ? '1px solid rgba(123,47,255,0.3)' : `1px solid ${C.border2}` }}>
                        {m.content}
                      </div>
                    </div>
                  ))}
                  {thinking && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: model.color, fontSize: 10, animation: 'pulse 1s infinite' }}>
                      ⟳ {model.name} işliyor...
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <input style={{ ...inputStyle, flex: 1 }} type="text" value={chatIn}
                    onChange={e => setChatIn(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !thinking && sendChat()}
                    placeholder="Görev ver, strateji sor, karar al..."
                    disabled={thinking}
                  />
                  <button onClick={() => sendChat()} disabled={thinking} style={{ ...btn('rgba(123,47,255,0.8)', '#fff'), padding: '8px 20px', opacity: thinking ? 0.5 : 1 }}>İLET</button>
                </div>
              </div>
            )}

            {/* ── AI PARLIAMENT ── */}
            {activeTab === 'parliament' && (
              <div style={{ ...panel('rgba(0,255,212,0.15)'), height: '100%', minHeight: 400 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexShrink: 0 }}>
                  <span style={{ color: C.teal, fontWeight: 900, fontSize: 11, letterSpacing: 3 }}>⚖ AI PARLIAMENT — GERÇEK ÇOKLU AJAN</span>
                  {parlConf > 0 && (
                    <span style={{ fontSize: 9, color: parlConf > 70 ? C.green : parlConf > 40 ? C.gold : C.red }}>
                      KONSENSÜs GÜVENİ: %{parlConf}
                    </span>
                  )}
                </div>

                {/* Agent grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 12, flexShrink: 0 }}>
                  {AGENTS.map(a => {
                    const vote = parlVotes.find(v => v.agentId === a.id)
                    return (
                      <div key={a.id} style={{ background: 'rgba(0,0,0,0.5)', border: `1px solid ${vote ? a.color + '44' : C.border}`, borderRadius: 8, padding: '8px 10px' }}>
                        <div style={{ fontSize: 9, color: a.color, fontWeight: 700, marginBottom: 4 }}>{a.name}</div>
                        <div style={{ fontSize: 8, color: C.muted, marginBottom: 6 }}>{a.desc}</div>
                        {parlLoading && !vote && (
                          <div style={{ fontSize: 8, color: a.color, animation: 'pulse 1s infinite' }}>⟳ düşünüyor...</div>
                        )}
                        {vote && (
                          <>
                            <div style={{ fontSize: 8, color: C.green }}>✓ GÜVEN: %{vote.confidence}</div>
                            <div style={{ fontSize: 9, color: C.text, marginTop: 4, lineHeight: 1.5, maxHeight: 60, overflowY: 'auto' }}>{vote.response.slice(0, 200)}{vote.response.length > 200 ? '...' : ''}</div>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Consensus */}
                {consensus && (
                  <div style={{ background: 'rgba(0,255,212,0.04)', border: `1px solid ${C.border2}`, borderRadius: 8, padding: 12, marginBottom: 12, flexShrink: 0 }}>
                    <div style={{ fontSize: 9, color: C.teal, fontWeight: 700, marginBottom: 6, letterSpacing: 2 }}>META-REASONER KONSENSÜsÜ</div>
                    <div style={{ fontSize: 11, color: C.text, lineHeight: 1.7, whiteSpace: 'pre-wrap', maxHeight: 200, overflowY: 'auto' }}>{consensus}</div>
                  </div>
                )}

                <div ref={parlEndRef} />

                <div style={{ display: 'flex', gap: 8, marginTop: 'auto', flexShrink: 0 }}>
                  <textarea value={parlQuery} onChange={e => setParlQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && e.ctrlKey && runParliament()}
                    placeholder="Tüm ajanlara soru sor... (Ctrl+Enter ile gönder)"
                    style={{ ...inputStyle, flex: 1, resize: 'none', height: 56 }}
                  />
                  <button onClick={runParliament} disabled={parlLoading} style={{ ...btn(`rgba(0,255,212,0.15)`, C.teal, `1px solid ${C.border2}`), opacity: parlLoading ? 0.5 : 1, padding: '8px 16px' }}>
                    {parlLoading ? '⟳' : '⚖ PARLAMENTOYU TOPLA'}
                  </button>
                </div>
              </div>
            )}

            {/* ── CODE ── */}
            {activeTab === 'code' && (
              <div style={{ ...panel('rgba(255,61,107,0.2)'), height: '100%', minHeight: 400 }}>
                <span style={{ color: '#FF3D6B', fontWeight: 900, fontSize: 11, letterSpacing: 3, marginBottom: 12, flexShrink: 0 }}>⌬ GERÇEK AI KOD DERLEYİCİ</span>
                <textarea value={codePrompt} onChange={e => setCodePrompt(e.target.value)}
                  placeholder="Ne yazılsın? Hangi algoritma? Hangi teknoloji?"
                  style={{ ...inputStyle, height: 80, resize: 'none', marginBottom: 10, flexShrink: 0 }}
                />
                <button onClick={() => sendChat(true)} disabled={thinking} style={{
                  ...btn('rgba(255,61,107,0.15)', '#FF3D6B', '1px solid rgba(255,61,107,0.4)'),
                  marginBottom: 10, opacity: thinking ? 0.5 : 1, flexShrink: 0,
                }}>{thinking ? 'DERLENİYOR...' : '⌬ DERLE VE ÜRET'}</button>
                <div style={{ flex: 1, background: '#000', border: `1px solid ${C.border}`, borderRadius: 8, padding: 14, fontSize: 11, color: '#A8FF78', overflowY: 'auto', whiteSpace: 'pre-wrap', lineHeight: 1.7, fontFamily: 'inherit' }}>
                  {codeOut}
                </div>
              </div>
            )}

            {/* ── CRYPTO ── */}
            {activeTab === 'crypto' && (
              <div style={{ ...panel(), gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                  <span style={{ color: C.green, fontWeight: 900, fontSize: 11, letterSpacing: 3 }}>◈ CANLI KRİPTO PİYASASI</span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {lastCoinFetch && <span style={{ fontSize: 8, color: C.muted }}>Son: {lastCoinFetch.toLocaleTimeString('tr-TR')}</span>}
                    <button onClick={fetchCrypto} disabled={coinsLoading} style={{ ...btn('rgba(57,255,20,0.1)', C.green, '1px solid rgba(57,255,20,0.25)'), opacity: coinsLoading ? 0.6 : 1 }}>
                      {coinsLoading ? '⟳ ÇEKİLİYOR...' : '↻ GÜNCELLE'}
                    </button>
                  </div>
                </div>
                {coins.length === 0
                  ? <div style={{ color: C.dim, fontSize: 11, textAlign: 'center', padding: 60 }}>Veri yok — "GÜNCELLE" butonuna tıkla.</div>
                  : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
                    {coins.map(c => (
                      <div key={c.id} style={{ background: 'rgba(0,0,0,0.6)', border: `1px solid ${c.change >= 0 ? 'rgba(57,255,20,0.2)' : 'rgba(255,68,68,0.2)'}`, borderRadius: 10, padding: 16 }}>
                        <div style={{ fontSize: 8, color: C.muted, textTransform: 'uppercase', letterSpacing: 3, marginBottom: 6 }}>{c.id}</div>
                        <div style={{ fontSize: 24, fontWeight: 900, color: C.text, marginBottom: 4 }}>${c.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                        <div style={{ fontSize: 11, color: c.change >= 0 ? C.green : C.red, marginBottom: 8 }}>{c.change >= 0 ? '▲' : '▼'} {Math.abs(c.change).toFixed(2)}%</div>
                        <div style={{ fontSize: 8, color: C.muted }}>MCap: ${(c.cap / 1e9).toFixed(1)}B · Vol: ${(c.vol / 1e9).toFixed(1)}B</div>
                      </div>
                    ))}
                  </div>
                }
              </div>
            )}

            {/* ── GITHUB ── */}
            {activeTab === 'github' && (
              <div style={{ ...panel(), gap: 12 }}>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <input type="text" value={ghUser} onChange={e => setGhUser(e.target.value)} onKeyDown={e => e.key === 'Enter' && fetchGithub()} style={{ ...inputStyle, width: 220 }} placeholder="GitHub kullanıcı adı" />
                  <button onClick={fetchGithub} disabled={ghLoading} style={{ ...btn(C.blue, '#000'), opacity: ghLoading ? 0.6 : 1 }}>{ghLoading ? '...' : '⌥ ARA'}</button>
                  {!keys.githubToken && <span style={{ fontSize: 8, color: C.gold, alignSelf: 'center' }}>⚠ Token ekle → 5000 req/sa</span>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto' }}>
                  {repos.length === 0
                    ? <div style={{ color: C.dim, fontSize: 11, textAlign: 'center', padding: 40 }}>Kullanıcı adı gir ve Ara'ya bas.</div>
                    : repos.map(r => (
                      <a key={r.id} href={r.html_url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                        <div style={{ background: 'rgba(0,0,0,0.5)', border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                          <div>
                            <div style={{ color: C.teal, fontSize: 11, fontWeight: 700 }}>{r.name}</div>
                            {r.description && <div style={{ color: C.muted, fontSize: 9, marginTop: 3 }}>{r.description.slice(0, 70)}</div>}
                            {r.language && <div style={{ color: C.purple, fontSize: 8, marginTop: 2 }}>{r.language}</div>}
                          </div>
                          <div style={{ fontSize: 9, color: C.muted }}>⭐ {r.stargazers_count}</div>
                        </div>
                      </a>
                    ))
                  }
                </div>
              </div>
            )}

            {/* ── KANBAN ── */}
            {activeTab === 'kanban' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, height: '100%', minHeight: 400 }}>
                {(['todo', 'doing', 'done'] as KanbanCol[]).map(col => (
                  <div key={col} style={{ background: 'rgba(0,0,0,0.5)', border: `1px solid ${C.border}`, borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ color: C.teal, fontWeight: 700, fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', borderBottom: `1px solid ${C.border}`, paddingBottom: 8, marginBottom: 10, flexShrink: 0 }}>
                      ▦ {col} <span style={{ color: C.muted, fontWeight: 400 }}>({kanban[col].length})</span>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {kanban[col].map((task, i) => (
                        <div key={i} style={{ background: C.panel, border: `1px solid ${C.dim}`, borderRadius: 6, padding: '7px 10px' }}>
                          <div style={{ fontSize: 10, color: '#b0b0c8', marginBottom: 6, lineHeight: 1.5 }}>{task}</div>
                          <div style={{ display: 'flex', gap: 3, justifyContent: 'flex-end' }}>
                            {col !== 'todo' && <button onClick={() => moveTask(col, i, -1)} style={{ ...btn('rgba(0,255,212,0.08)', C.teal, `1px solid ${C.border2}`), fontSize: 8, padding: '2px 6px' }}>← GERİ</button>}
                            {col !== 'done' && <button onClick={() => moveTask(col, i, 1)} style={{ ...btn('rgba(123,47,255,0.12)', C.purple, '1px solid rgba(123,47,255,0.3)'), fontSize: 8, padding: '2px 6px' }}>İLERİ →</button>}
                            <button onClick={() => setKanban(p => ({ ...p, [col]: p[col].filter((_, j) => j !== i) }))} style={{ ...btn('rgba(255,68,68,0.1)', C.red, '1px solid rgba(255,68,68,0.2)'), fontSize: 8, padding: '2px 6px' }}>✕</button>
                          </div>
                        </div>
                      ))}
                    </div>
                    {col === 'todo' && (
                      <input type="text" value={newTask} onChange={e => setNewTask(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && newTask.trim()) { setKanban(p => ({ ...p, todo: [...p.todo, newTask.trim()] })); setNewTask('') } }}
                        placeholder="+ Yeni görev (Enter)"
                        style={{ ...inputStyle, marginTop: 8, background: 'transparent', border: 'none', borderTop: `1px solid ${C.dim}`, borderRadius: 0 }}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* ── REVENUE ── */}
            {activeTab === 'revenue' && (
              <div style={{ ...panel('rgba(255,215,0,0.15)'), height: '100%', minHeight: 400 }}>
                <span style={{ color: C.gold, fontWeight: 900, fontSize: 11, letterSpacing: 3, marginBottom: 14, flexShrink: 0 }}>◎ SaaS 12 AYLIK GELİR PROJEKSİYONU</span>
                <div style={{ display: 'flex', gap: 24, flex: 1, minHeight: 0 }}>
                  <div style={{ width: 230, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {(Object.entries(rev) as [string, number][]).map(([k, v]) => (
                      <div key={k}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 10 }}>
                          <span style={{ color: C.muted, textTransform: 'uppercase', letterSpacing: 1 }}>{k}</span>
                          <span style={{ color: C.gold, fontWeight: 700 }}>{k === 'price' || k === 'cost' ? `$${v}` : `${v}%`}</span>
                        </div>
                        <input type="range" min={1} max={k === 'price' ? 999 : k === 'cost' ? 9999 : 200} value={v}
                          onChange={e => setRev(p => ({ ...p, [k]: Number(e.target.value) }))}
                          style={{ width: '100%', accentColor: C.gold }}
                        />
                      </div>
                    ))}
                    <div style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,215,0,0.15)', borderRadius: 8, padding: 12, marginTop: 6 }}>
                      <div style={{ fontSize: 8, color: C.muted, letterSpacing: 2, marginBottom: 4 }}>12 AYLIK TOPLAM</div>
                      <div style={{ fontSize: 20, fontWeight: 900, color: C.gold }}>${totalRev.toLocaleString()}</div>
                      <div style={{ fontSize: 8, color: C.muted, letterSpacing: 2, marginTop: 8, marginBottom: 4 }}>NET KÂR</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: totalProfit >= 0 ? C.green : C.red }}>${totalProfit.toLocaleString()}</div>
                    </div>
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5, overflowY: 'auto' }}>
                    <div style={{ display: 'flex', fontSize: 8, color: C.muted, gap: 8, marginBottom: 4, letterSpacing: 1 }}>
                      <span style={{ width: 24 }}>AY</span>
                      <span style={{ flex: 1 }}>GELİR</span>
                      <span style={{ width: 90, textAlign: 'right' }}>AYLIK GELİR</span>
                      <span style={{ width: 90, textAlign: 'right' }}>NET KÂR</span>
                      <span style={{ width: 80, textAlign: 'right' }}>KULLANICI</span>
                    </div>
                    {revMonths.map(m => (
                      <div key={m.month} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 9, color: C.muted, width: 24, flexShrink: 0 }}>A{m.month}</span>
                        <div style={{ flex: 1, height: 14, background: '#0a0a1a', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${(m.rev / maxRev) * 100}%`, background: m.profit >= 0 ? 'rgba(57,255,20,0.5)' : 'rgba(255,68,68,0.4)', borderRadius: 3, transition: 'width 0.3s' }} />
                        </div>
                        <span style={{ fontSize: 9, color: C.gold, width: 90, textAlign: 'right', flexShrink: 0 }}>${m.rev.toLocaleString()}</span>
                        <span style={{ fontSize: 9, width: 90, textAlign: 'right', flexShrink: 0, color: m.profit >= 0 ? C.green : C.red }}>${m.profit.toLocaleString()}</span>
                        <span style={{ fontSize: 9, color: C.muted, width: 80, textAlign: 'right', flexShrink: 0 }}>{m.users.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── KEYS ── */}
            {activeTab === 'keys' && (
              <div style={{ ...panel(), gap: 18 }}>
                <span style={{ color: C.teal, fontWeight: 900, fontSize: 11, letterSpacing: 3 }}>⊕ API ENTEGRASYONLARI</span>
                {([
                  { label: 'OPENROUTER API KEY — tüm AI modeller', key: 'openRouter' as keyof Keys, type: 'password', hint: 'openrouter.ai/keys' },
                  { label: 'DISCORD WEBHOOK URL', key: 'discordWebhook' as keyof Keys, type: 'url', hint: 'Server Ayarları → Integrations → Webhooks' },
                  { label: 'GITHUB TOKEN — opsiyonel (rate limit kaldırır)', key: 'githubToken' as keyof Keys, type: 'password', hint: 'github.com/settings/tokens' },
                ] as const).map(({ label, key, type, hint }) => (
                  <div key={key}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 9, color: C.muted, letterSpacing: 1 }}>{label}</span>
                      <span style={{ fontSize: 8, color: C.dim }}>{hint}</span>
                    </div>
                    <input type={type} value={keys[key]} onChange={e => setKeys(p => ({ ...p, [key]: e.target.value }))} style={inputStyle} autoComplete="off" />
                    {keys[key] && <div style={{ fontSize: 8, color: C.green, marginTop: 3 }}>✓ Girildi</div>}
                  </div>
                ))}
                <button onClick={saveKeys} style={{ ...btn('rgba(57,255,20,0.12)', C.green, '1px solid rgba(57,255,20,0.35)'), padding: '10px 0', letterSpacing: 2 }}>
                  ⊕ KAYDET VE SİSTEME BAĞLA
                </button>
                <div style={{ fontSize: 8, color: C.dim, lineHeight: 1.8 }}>
                  Keys yalnızca tarayıcı localStorage'ına kaydedilir — sunucuya gönderilmez.<br/>
                  OpenRouter ile Claude, GPT-4o, Gemini, Grok, DeepSeek, Mistral erişimi.
                </div>
              </div>
            )}

          </div>

          {/* RIGHT: LOGS + DISCORD */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>

            {/* LOGS */}
            <div style={{ background: '#000', border: `1px solid ${C.border}`, borderRadius: 12, padding: 12, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 3, color: C.green, textTransform: 'uppercase', borderBottom: `1px solid ${C.border}`, paddingBottom: 8, marginBottom: 8, flexShrink: 0 }}>
                ● CANLI LOG
              </div>
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
                {logs.map((log, i) => (
                  <div key={i} style={{ fontSize: 8, color: logColor(log.type), lineHeight: 1.6, wordBreak: 'break-all' }}>
                    <span style={{ opacity: 0.3 }}>[{log.time}]</span> {log.msg}
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            </div>

            {/* DISCORD */}
            <div style={{ background: 'rgba(88,101,242,0.06)', border: '1px solid rgba(88,101,242,0.25)', borderRadius: 12, padding: 12, flexShrink: 0 }}>
              <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 3, color: C.discord, marginBottom: 10 }}>DISCORD WEBHOOK</div>
              <textarea value={dc} onChange={e => setDc(e.target.value)} placeholder="Bildirim mesajı..."
                style={{ ...inputStyle, height: 48, resize: 'none', marginBottom: 8 }}
              />
              <button onClick={sendDiscord} style={{ ...btn('rgba(88,101,242,0.18)', C.discord, '1px solid rgba(88,101,242,0.35)'), width: '100%', padding: '7px 0' }}>
                DISCORD'A İLET
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
