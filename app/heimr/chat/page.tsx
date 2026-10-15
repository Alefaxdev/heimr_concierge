'use client'
import { useState, useRef, useEffect } from 'react'
import { marked } from 'marked'

type Message = { role: 'user' | 'assistant'; content: string }

function parseMarkdown(text: string): string {
  return marked.parse(text, { async: false }) as string
}

export default function HeimrtChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function autoResize() {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }

  async function send() {
    if (!input.trim() || loading) return
    const userMsg: Message = { role: 'user', content: input }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    if (inputRef.current) inputRef.current.style.height = 'auto'
    setLoading(true)

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: newMessages }),
    })

    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let assistantText = ''
    setMessages(prev => [...prev, { role: 'assistant', content: '' }])

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      assistantText += decoder.decode(value)
      setMessages(prev => [
        ...prev.slice(0, -1),
        { role: 'assistant', content: assistantText },
      ])
    }
    setLoading(false)
  }

  const isEmpty = messages.length === 0

  const colors = {
    bg: '#0C1F0F',           // mørk skoggrønn
    surface: '#142518',      // litt lysere grønn for overflater
    border: '#1E3422',       // subtil border
    copper: '#C17A3A',       // terrakotta/kobber – tittelfargen
    copperLight: '#D4956A',  // lysere kobber for hover
    text: '#E8E2D8',         // off-white brødtekst
    muted: '#8A9E8C',        // dempet grønn-grå
    userBg: '#1A3020',       // bruker-boble
  }

  const suggestions = [
    'Hva er rutinen ved sykemelding?',
    'Hvordan håndterer vi gjestklagsaker?',
    'Hva er retningslinjene for overtid?',
  ]

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100vh',
      background: colors.bg, fontFamily: "'Georgia', 'Times New Roman', serif",
    }}>

      {/* Header */}
      <div style={{
        background: colors.bg,
        padding: '0 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: `1px solid ${colors.border}`,
        height: 64, flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            fontSize: 18, letterSpacing: '0.22em', textTransform: 'uppercase',
            color: colors.copper, fontWeight: 400,
          }}>
            HEIMR
          </div>
          <div style={{ width: 1, height: 20, background: colors.border }} />
          <div style={{
            fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase',
            color: colors.muted, fontWeight: 400,
          }}>
            Intern assistent
          </div>
        </div>
        <a href="/chat/admin" style={{
          fontSize: 11, color: colors.muted, textDecoration: 'none',
          letterSpacing: '0.12em', textTransform: 'uppercase',
          padding: '6px 14px', border: `1px solid ${colors.border}`,
          borderRadius: 2, transition: 'all 0.2s',
        }}>
          Admin
        </a>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '32px 0' }}>
        {isEmpty ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', height: '100%', gap: 36, padding: '0 24px',
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 16,
                justifyContent: 'center', marginBottom: 24,
              }}>
                <div style={{ width: 40, height: 1, background: colors.copper, opacity: 0.4 }} />
                <div style={{ fontSize: 18, color: colors.copper, opacity: 0.6 }}>◆</div>
                <div style={{ width: 40, height: 1, background: colors.copper, opacity: 0.4 }} />
              </div>
              <div style={{
                fontSize: 28, fontWeight: 400, color: colors.copper,
                marginBottom: 12, letterSpacing: '0.04em',
              }}>
                God dag
              </div>
              <div style={{
                fontSize: 14, color: colors.text, maxWidth: 340,
                lineHeight: 1.9, letterSpacing: '0.02em', opacity: 0.8,
              }}>
                Hvordan kan jeg hjelpe deg i dag?
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 420 }}>
              {suggestions.map(q => (
                <button key={q} onClick={() => { setInput(q); inputRef.current?.focus() }} style={{
                  padding: '13px 20px', fontSize: 13, textAlign: 'left',
                  border: `1px solid ${colors.border}`,
                  borderRadius: 2, background: colors.surface,
                  color: colors.text, cursor: 'pointer', fontFamily: 'inherit',
                  letterSpacing: '0.02em', lineHeight: 1.4, opacity: 0.85,
                  transition: 'all 0.2s',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = colors.copper
                    e.currentTarget.style.color = colors.copper
                    e.currentTarget.style.opacity = '1'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = colors.border
                    e.currentTarget.style.color = colors.text
                    e.currentTarget.style.opacity = '0.85'
                  }}
                >
                  <span>{q}</span>
                  <span style={{ fontSize: 14, opacity: 0.4 }}>→</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ maxWidth: 700, margin: '0 auto', padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 28 }}>
            {messages.map((m, i) => (
              <div key={i} style={{
                display: 'flex',
                flexDirection: m.role === 'user' ? 'row-reverse' : 'row',
                gap: 14, alignItems: 'flex-start',
              }}>
                {/* Avatar */}
                <div style={{
                  width: 30, height: 30, flexShrink: 0,
                  background: m.role === 'user' ? colors.userBg : colors.surface,
                  border: `1px solid ${m.role === 'user' ? colors.copper : colors.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, fontWeight: 400, letterSpacing: '0.08em',
                  color: m.role === 'user' ? colors.copper : colors.muted,
                  marginTop: 2,
                }}>
                  {m.role === 'user' ? 'DEG' : '◆'}
                </div>

                {/* Bubble */}
                <div
                  className={m.role === 'assistant' ? 'msg-bubble' : undefined}
                  style={{
                    maxWidth: '78%',
                    padding: '14px 20px',
                    borderRadius: 2,
                    background: m.role === 'user' ? colors.userBg : colors.surface,
                    color: m.role === 'user' ? colors.text : colors.text,
                    fontSize: 14, lineHeight: 1.8,
                    border: `1px solid ${m.role === 'user' ? colors.copper : colors.border}`,
                    whiteSpace: m.role === 'user' ? 'pre-wrap' : undefined,
                    letterSpacing: '0.01em',
                  }}
                  dangerouslySetInnerHTML={
                    m.role === 'assistant' && m.content
                      ? { __html: parseMarkdown(m.content) }
                      : undefined
                  }
                >
                  {m.role === 'user' ? m.content : !m.content ? (
                    <span style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: colors.copper, animation: 'pulse 1.4s ease-in-out infinite' }} />
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: colors.copper, animation: 'pulse 1.4s ease-in-out 0.2s infinite' }} />
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: colors.copper, animation: 'pulse 1.4s ease-in-out 0.4s infinite' }} />
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{
        borderTop: `1px solid ${colors.border}`,
        background: colors.surface, padding: '20px 24px', flexShrink: 0,
      }}>
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          <div style={{
            display: 'flex', gap: 12, alignItems: 'flex-end',
            border: `1px solid ${colors.border}`,
            borderRadius: 2, padding: '12px 12px 12px 18px',
            background: colors.bg,
            transition: 'border-color 0.2s',
          }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => { setInput(e.target.value); autoResize() }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send()
                }
              }}
              placeholder="Still et spørsmål..."
              disabled={loading}
              rows={1}
              style={{
                flex: 1, border: 'none', outline: 'none', resize: 'none',
                fontSize: 14, lineHeight: 1.6, fontFamily: 'inherit',
                background: 'transparent', color: colors.text,
                minHeight: 24, maxHeight: 160,
                letterSpacing: '0.01em',
              }}
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              style={{
                width: 36, height: 36, borderRadius: 2, flexShrink: 0,
                background: loading || !input.trim() ? colors.surface : colors.copper,
                border: `1px solid ${loading || !input.trim() ? colors.border : colors.copper}`,
                cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 12V2M2 7l5-5 5 5"
                  stroke={loading || !input.trim() ? colors.muted : '#fff'}
                  strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
          <div style={{
            fontSize: 10, color: colors.muted, textAlign: 'center',
            marginTop: 8, letterSpacing: '0.1em', textTransform: 'uppercase', opacity: 0.5,
          }}>
            Enter for å sende · Shift+Enter for ny linje
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.2 }
          50% { opacity: 1 }
        }
        .msg-bubble p { margin: 0 0 10px; }
        .msg-bubble p:last-child { margin: 0; }
        .msg-bubble ul, .msg-bubble ol { margin: 4px 0 10px; padding-left: 20px; }
        .msg-bubble li { margin-bottom: 5px; }
        .msg-bubble strong { font-weight: 600; color: #C17A3A; }
        .msg-bubble h1, .msg-bubble h2, .msg-bubble h3 {
          font-size: 15px; font-weight: 600; margin: 10px 0 5px;
          letter-spacing: 0.04em; color: #C17A3A;
        }
        .msg-bubble code {
          font-size: 12px; background: #1E3422;
          padding: 1px 6px; border-radius: 2px; color: #C17A3A;
        }
        textarea::placeholder { color: #8A9E8C; opacity: 0.6; }
      `}</style>
    </div>
  )
}