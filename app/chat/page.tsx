'use client'
import { useState, useRef, useEffect } from 'react'
import { marked } from 'marked'

type Message = { role: 'user' | 'assistant'; content: string }

function parseMarkdown(text: string): string {
  return marked.parse(text, { async: false }) as string
}

export default function ChatPage() {
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

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100vh',
      background: '#F9F7F3', fontFamily: "'Georgia', serif",
    }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 24px', borderBottom: '1px solid #E8E4DC',
        background: '#fff',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, background: '#1a1a1a',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 4h12M2 8h8M2 12h10" stroke="#F9F7F3" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#1a1a1a', lineHeight: 1.2 }}>Intern assistent</div>
            <div style={{ fontSize: 11, color: '#999', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Toast Restaurantgruppen</div>
          </div>
        </div>
        <a href="/chat/admin" style={{
          fontSize: 12, color: '#888', textDecoration: 'none',
          padding: '6px 12px', border: '1px solid #E8E4DC', borderRadius: 6,
          letterSpacing: '0.04em', transition: 'all 0.15s',
        }}>
          Administrer →
        </a>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 0' }}>
        {isEmpty ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', height: '100%', gap: 32, padding: '0 24px',
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>◈</div>
              <div style={{ fontSize: 22, fontWeight: 400, color: '#1a1a1a', marginBottom: 8 }}>
                Hva kan jeg hjelpe deg med?
              </div>
              <div style={{ fontSize: 14, color: '#999', maxWidth: 360, lineHeight: 1.6 }}>
                Still spørsmål om rutiner, retningslinjer og informasjon fra kunnskapsbasen.
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 480 }}>
              {[
                'Hva er rutinen ved sykemelding?',
                'Hvordan håndterer vi reklamasjoner?',
                'Hva er retningslinjene for overtid?',
              ].map(q => (
                <button key={q} onClick={() => { setInput(q); inputRef.current?.focus() }} style={{
                  padding: '8px 16px', fontSize: 13, border: '1px solid #E0DCD4',
                  borderRadius: 20, background: '#fff', color: '#555',
                  cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'all 0.15s',
                }}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
            {messages.map((m, i) => (
              <div key={i} style={{
                display: 'flex',
                flexDirection: m.role === 'user' ? 'row-reverse' : 'row',
                gap: 12, alignItems: 'flex-start',
              }}>
                {/* Avatar */}
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  background: m.role === 'user' ? '#1a1a1a' : '#E8E4DC',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 600,
                  color: m.role === 'user' ? '#F9F7F3' : '#888',
                  marginTop: 2,
                }}>
                  {m.role === 'user' ? 'A' : '◈'}
                </div>

                {/* Bubble */}
                <div
                  className={m.role === 'assistant' ? 'msg-bubble' : undefined}
                  style={{
                    maxWidth: '78%',
                    padding: m.role === 'user' ? '10px 16px' : '12px 18px',
                    borderRadius: m.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                    background: m.role === 'user' ? '#1a1a1a' : '#fff',
                    color: m.role === 'user' ? '#F9F7F3' : '#1a1a1a',
                    fontSize: 14, lineHeight: 1.65,
                    border: m.role === 'assistant' ? '1px solid #E8E4DC' : 'none',
                    whiteSpace: m.role === 'user' ? 'pre-wrap' : undefined,
                  }}
                  dangerouslySetInnerHTML={
                    m.role === 'assistant' && m.content
                      ? { __html: parseMarkdown(m.content) }
                      : undefined
                  }
                >
                  {m.role === 'user' ? m.content : !m.content ? (
                    <span style={{ display: 'flex', gap: 4, alignItems: 'center', color: '#bbb' }}>
                      <span style={{ animation: 'pulse 1.2s ease-in-out infinite' }}>●</span>
                      <span style={{ animation: 'pulse 1.2s ease-in-out 0.2s infinite' }}>●</span>
                      <span style={{ animation: 'pulse 1.2s ease-in-out 0.4s infinite' }}>●</span>
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
      <div style={{ borderTop: '1px solid #E8E4DC', background: '#fff', padding: '16px 24px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div style={{
            display: 'flex', gap: 10, alignItems: 'flex-end',
            border: '1px solid #D8D4CC', borderRadius: 14,
            padding: '10px 10px 10px 16px', background: '#fff',
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
            transition: 'border-color 0.15s',
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
              placeholder="Still et spørsmål... (Enter for å sende)"
              disabled={loading}
              rows={1}
              style={{
                flex: 1, border: 'none', outline: 'none', resize: 'none',
                fontSize: 14, lineHeight: 1.5, fontFamily: 'inherit',
                background: 'transparent', color: '#1a1a1a',
                minHeight: 24, maxHeight: 160,
              }}
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              style={{
                width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                background: loading || !input.trim() ? '#E8E4DC' : '#1a1a1a',
                border: 'none', cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.15s',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 12V2M2 7l5-5 5 5" stroke={loading || !input.trim() ? '#aaa' : '#fff'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
          <div style={{ fontSize: 11, color: '#bbb', textAlign: 'center', marginTop: 8, letterSpacing: '0.03em' }}>
            Shift+Enter for ny linje
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3 }
          50% { opacity: 1 }
        }
        .msg-bubble p { margin: 0 0 8px; }
        .msg-bubble p:last-child { margin: 0; }
        .msg-bubble ul, .msg-bubble ol { margin: 4px 0 8px; padding-left: 20px; }
        .msg-bubble li { margin-bottom: 4px; }
        .msg-bubble strong { font-weight: 600; }
        .msg-bubble h1, .msg-bubble h2, .msg-bubble h3 { font-size: 15px; font-weight: 600; margin: 8px 0 4px; }
        .msg-bubble code { font-size: 12px; background: #F0EDE8; padding: 1px 5px; border-radius: 4px; }
        .msg-bubble pre { background: #F0EDE8; padding: 10px 14px; border-radius: 8px; overflow-x: auto; font-size: 12px; margin: 8px 0; }
      `}</style>
    </div>
  )
}