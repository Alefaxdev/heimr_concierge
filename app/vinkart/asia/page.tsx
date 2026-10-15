'use client'

import { useEffect, useState, useRef } from 'react'
import wineData from '../../data/vinliste_asia.json'

interface Wine {
  country: string
  region: string
  vintage: string
  name: string
  type: string
  note: string | null
  grapes: string
  price_raw: string
  price_nok: number
}

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const wines = wineData as Wine[]
const TYPES = ['Alle', ...Array.from(new Set(wines.map(w => w.type))).sort()]

const colors = {
  rust: '#C8472A',
  rustDark: '#A83820',
  rustLight: '#D4604A',
  bg: '#F5F0EA',
  dark: '#111111',
  mid: '#3A2A20',
  muted: '#8A6A5A',
  border: '#E0D5C8',
  chatBg: '#FDFAF7',
  userBubble: '#C8472A',
  asstBubble: '#EDE5DC',
}

export default function Vinkart() {
  const [filter, setFilter] = useState('Alle')
  const [search, setSearch] = useState('')
  const [chatOpen, setChatOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = wines.filter(w => {
    const matchType = filter === 'Alle' || w.type === filter
    const matchSearch = search === '' ||
      w.name.toLowerCase().includes(search.toLowerCase()) ||
      (w.country ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (w.grapes ?? '').toLowerCase().includes(search.toLowerCase())
    return matchType && matchSearch
  })

  const grouped = filtered.reduce((acc, w) => {
    if (!acc[w.type]) acc[w.type] = []
    acc[w.type].push(w)
    return acc
  }, {} as Record<string, Wine[]>)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (chatOpen) setTimeout(() => inputRef.current?.focus(), 300)
  }, [chatOpen])

  const sendMessage = async () => {
    if (!input.trim() || loading) return
    const userMessage = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setLoading(true)
    try {
      const res = await fetch('/api/vinkart-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage, history: messages }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Beklager, noe gikk galt.' }])
    } finally {
      setLoading(false)
    }
  }

  const suggestions = [
    'Hva passer til sashimi?',
    'Anbefal en champagne',
    'Beste vin under 800kr',
  ]

  return (
    <div style={{ background: colors.bg, minHeight: '100vh', color: colors.dark, fontFamily: 'Georgia, serif' }}>

      {/* Header */}
      <div style={{ background: colors.rust, padding: '48px 40px 40px', marginBottom: 48 }}>
        <p style={{ fontSize: '0.7rem', letterSpacing: '0.25em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.5)', marginBottom: 12, fontFamily: 'sans-serif' }}>
          Asia Aker Brygge
        </p>
        <h1 style={{ fontSize: '3.5rem', fontWeight: 800, letterSpacing: '-0.01em', color: colors.dark, margin: 0, lineHeight: 1, fontFamily: 'sans-serif' }}>
          Vinkart.
        </h1>
      </div>

      {/* Søk + filter */}
      <div style={{ maxWidth: 900, margin: '0 auto 40px', padding: '0 24px' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Søk etter vin, land, drue..."
          style={{
            width: '100%', background: 'transparent', border: 'none',
            borderBottom: `1px solid ${colors.border}`, color: colors.dark,
            fontFamily: 'Georgia, serif', fontSize: '1rem',
            padding: '10px 0', marginBottom: 28, outline: 'none',
            letterSpacing: '0.02em', boxSizing: 'border-box',
          }}
        />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {TYPES.map(t => (
            <button key={t} onClick={() => setFilter(t)} style={{
              background: filter === t ? colors.rust : 'transparent',
              border: `1px solid ${filter === t ? colors.rust : colors.border}`,
              color: filter === t ? '#fff' : colors.muted,
              fontFamily: 'sans-serif', fontSize: '0.68rem',
              letterSpacing: '0.1em', textTransform: 'uppercase',
              padding: '6px 16px', borderRadius: 2, cursor: 'pointer', transition: 'all 0.15s',
            }}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Vinliste */}
      <div style={{ maxWidth: 900, margin: '0 auto 120px', padding: '0 24px' }}>
        {Object.entries(grouped).map(([type, typeWines]) => (
          <div key={type} style={{ marginBottom: 48 }}>
            <h2 style={{
              fontSize: '0.6rem', letterSpacing: '0.3em', textTransform: 'uppercase',
              color: colors.rust, marginBottom: 16, paddingBottom: 10,
              borderBottom: `1px solid ${colors.border}`, fontFamily: 'sans-serif',
            }}>
              {type}
            </h2>
            {typeWines.map((wine, i) => (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '1fr auto', gap: 24,
                padding: '16px 0', borderBottom: `1px solid ${colors.border}`, alignItems: 'start',
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
                    <span style={{ fontSize: '0.95rem', letterSpacing: '0.01em', color: colors.dark }}>{wine.name}</span>
                    {wine.vintage && wine.vintage !== 'NaN' && wine.vintage !== 'null' && (
                      <span style={{ fontSize: '0.68rem', color: colors.muted, fontFamily: 'sans-serif' }}>{wine.vintage}</span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: colors.muted, letterSpacing: '0.06em', marginBottom: 2, fontFamily: 'sans-serif' }}>
                    {[wine.country, wine.region !== 'NaN' && wine.region !== 'null' ? wine.region : null].filter(Boolean).join(' · ')}
                  </div>
                  {wine.grapes && wine.grapes !== 'NaN' && wine.grapes !== 'null' && (
                    <div style={{ fontSize: '0.67rem', color: colors.border, fontStyle: 'italic', color: '#B0A090' }}>
                      {wine.grapes}
                    </div>
                  )}
                  {wine.note && wine.note !== 'null' && (
                    <div style={{ fontSize: '0.7rem', color: colors.muted, marginTop: 4, lineHeight: 1.5, fontStyle: 'italic' }}>
                      {wine.note}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right', paddingTop: 2 }}>
                  <span style={{ fontSize: '0.9rem', color: colors.rust, fontFamily: 'sans-serif', fontWeight: 600 }}>{wine.price_raw}</span>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Chat-knapp */}
      <button
        onClick={() => setChatOpen(o => !o)}
        style={{
          position: 'fixed', bottom: 28, right: 28, zIndex: 200,
          width: 56, height: 56, borderRadius: '50%',
          background: chatOpen ? colors.bg : colors.rust,
          border: chatOpen ? `1px solid ${colors.border}` : 'none',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
          transition: 'all 0.2s',
        }}
      >
        {chatOpen ? (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 2l12 12M14 2L2 14" stroke={colors.rust} strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </button>

      {/* Chat-vindu */}
      <div style={{
        position: 'fixed', bottom: 96, right: 28, zIndex: 199,
        width: 360, height: 480,
        background: colors.chatBg,
        border: `1px solid ${colors.border}`,
        borderRadius: 10,
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 8px 40px rgba(0,0,0,0.15)',
        transform: chatOpen ? 'scale(1) translateY(0)' : 'scale(0.92) translateY(20px)',
        opacity: chatOpen ? 1 : 0,
        pointerEvents: chatOpen ? 'all' : 'none',
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        transformOrigin: 'bottom right',
      }}>

        {/* Header */}
        <div style={{
          padding: '14px 18px',
          background: colors.rust,
          borderRadius: '10px 10px 0 0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#fff', fontFamily: 'sans-serif', letterSpacing: '0.04em' }}>
              Sommelier
            </div>
            <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.65)', fontFamily: 'sans-serif', marginTop: 1 }}>
              Asia Aker Brygge
            </div>
          </div>
          <button onClick={() => setChatOpen(false)} style={{
            background: 'rgba(0,0,0,0.15)', border: 'none', cursor: 'pointer',
            color: '#fff', fontSize: 14, padding: '4px 8px', lineHeight: 1,
            borderRadius: 4, fontFamily: 'sans-serif',
          }}>✕</button>
        </div>

        {/* Meldinger */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {messages.length === 0 && (
            <div>
              <p style={{ color: colors.muted, fontSize: '0.82rem', fontStyle: 'italic', lineHeight: 1.7, marginBottom: 14 }}>
                Kan jeg hjelpe deg med å finne den rette vinen i kveld?
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {suggestions.map(s => (
                  <button key={s} onClick={() => { setInput(s); inputRef.current?.focus() }} style={{
                    background: 'transparent', border: `1px solid ${colors.border}`,
                    color: colors.muted, fontFamily: 'Georgia, serif',
                    fontSize: '0.72rem', padding: '7px 12px', borderRadius: 4,
                    cursor: 'pointer', fontStyle: 'italic', textAlign: 'left',
                    transition: 'all 0.15s',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = colors.rust; e.currentTarget.style.color = colors.rust }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = colors.border; e.currentTarget.style.color = colors.muted }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '82%', padding: '9px 13px',
                borderRadius: msg.role === 'user' ? '14px 14px 3px 14px' : '14px 14px 14px 3px',
                background: msg.role === 'user' ? colors.rust : colors.asstBubble,
                color: msg.role === 'user' ? '#fff' : colors.dark,
                fontSize: '0.82rem', lineHeight: 1.65,
                fontStyle: msg.role === 'assistant' ? 'italic' : 'normal',
                whiteSpace: 'pre-wrap',
              }}>
                {msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{
                padding: '10px 14px', borderRadius: '14px 14px 14px 3px',
                background: colors.asstBubble,
                display: 'flex', gap: 5, alignItems: 'center',
              }}>
                {[0, 0.2, 0.4].map((delay, i) => (
                  <div key={i} style={{
                    width: 6, height: 6, borderRadius: '50%', background: colors.rust,
                    animation: `pulse 1.2s ease-in-out ${delay}s infinite`,
                  }} />
                ))}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div style={{
          padding: '12px 14px', borderTop: `1px solid ${colors.border}`,
          display: 'flex', gap: 8, alignItems: 'center',
          borderRadius: '0 0 10px 10px',
        }}>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder="Spør om vin..."
            style={{
              flex: 1, background: '#F0EAE2', border: `1px solid ${colors.border}`,
              borderRadius: 6, color: colors.dark, fontFamily: 'Georgia, serif',
              fontSize: '0.84rem', padding: '8px 12px', outline: 'none',
              letterSpacing: '0.01em',
            }}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            style={{
              width: 34, height: 34, borderRadius: 6, flexShrink: 0,
              background: input.trim() && !loading ? colors.rust : colors.border,
              border: 'none', cursor: input.trim() && !loading ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 12V2M2 7l5-5 5 5"
                stroke={input.trim() && !loading ? '#fff' : colors.muted}
                strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.2; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1); }
        }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${colors.border}; border-radius: 2px; }
        input::placeholder { color: ${colors.muted}; opacity: 0.6; }
      `}</style>
    </div>
  )
}