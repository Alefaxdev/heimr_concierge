'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { marked } from 'marked'
import { colors } from '@/lib/theme'
import GuestPanel from '@/components/GuestPanel'

type Message = { role: 'user' | 'assistant'; content: string }
type Me = {
  hotel: { id: string; name: string; concierge_name: string | null }
  user: { name: string; role: 'staff' | 'concierge' }
  openQuestions: number
}

function parseMarkdown(text: string): string {
  return marked.parse(text, { async: false }) as string
}

function greeting() {
  const h = Number(new Intl.DateTimeFormat('nb-NO', { timeZone: 'Europe/Oslo', hour: 'numeric' }).format(new Date()))
  if (h < 10) return 'God morgen'
  if (h < 17) return 'God dag'
  return 'God kveld'
}

function newId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, c => (+c ^ (Math.random() * 16) >> (+c / 4)).toString(16))
}

export default function ConciergePage() {
  const [me, setMe] = useState<Me | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [conversationId, setConversationId] = useState(newId)
  const [copied, setCopied] = useState<number | null>(null)
  const [fixing, setFixing] = useState<number | null>(null)
  const [fixText, setFixText] = useState('')
  const [fixBusy, setFixBusy] = useState(false)
  const [fixed, setFixed] = useState<Record<number, string>>({})
  const [guestsOpen, setGuestsOpen] = useState(false)
  const [vipCount, setVipCount] = useState<number | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    fetch('/api/hotel').then(async r => {
      if (r.status === 401) { window.location.href = '/login'; return }
      if (r.ok) setMe(await r.json())
    })
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function autoResize() {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
  }

  const prefill = useCallback((text: string) => {
    setInput(text)
    requestAnimationFrame(() => {
      const el = inputRef.current
      if (!el) return
      el.focus()
      el.setSelectionRange(text.length, text.length)
      autoResize()
    })
  }, [])

  async function send() {
    if (!input.trim() || loading) return
    const newMessages: Message[] = [...messages, { role: 'user', content: input.trim() }]
    setMessages([...newMessages, { role: 'assistant', content: '' }])
    setInput('')
    if (inputRef.current) inputRef.current.style.height = 'auto'
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, conversationId }),
      })
      if (res.status === 401) { window.location.href = '/login'; return }
      if (!res.ok || !res.body) throw new Error()

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let text = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        text += decoder.decode(value, { stream: true })
        setMessages([...newMessages, { role: 'assistant', content: text }])
      }
      if (!text.trim()) setMessages([...newMessages, { role: 'assistant', content: '_Fikk ikke noe svar. Prøv igjen._' }])
    } catch {
      setMessages([...newMessages, { role: 'assistant', content: '_Noe gikk galt. Sjekk nettet og prøv igjen._' }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  function newConversation() {
    if (loading) return
    setMessages([])
    setConversationId(newId())
    setInput('')
    inputRef.current?.focus()
  }

  function startFix(i: number) {
    setFixing(i)
    setFixText('')
  }

  async function saveFix(i: number) {
    if (!fixText.trim()) return
    const question = [...messages.slice(0, i)].reverse().find(m => m.role === 'user')?.content ?? ''
    setFixBusy(true)
    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, answer: messages[i]?.content ?? '', correction: fixText }),
    })
    const d = await res.json().catch(() => ({}))
    setFixBusy(false)
    if (!res.ok) { setFixed(f => ({ ...f, [i]: d.error ?? 'Kunne ikke lagre' })); return }
    setFixed(f => ({
      ...f,
      [i]: d.saved === 'knowledge'
        ? '✓ Lagret i kunnskapsbasen. Assistenten bruker det fra neste spørsmål.'
        : `✓ Sendt til ${conciergeName}. Takk!`,
    }))
    setFixing(null)
    setFixText('')
  }

  async function copy(i: number, text: string) {
    // Fjern verktøy-notiser og markdown-stjerner før kopiering
    const clean = text.replace(/\n*> [📨✓][^\n]*\n*/g, '\n').replace(/\*\*(.+?)\*\*/g, '$1').trim()
    try {
      await navigator.clipboard.writeText(clean)
      setCopied(i)
      setTimeout(() => setCopied(null), 1500)
    } catch {}
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/login'
  }

  const isConcierge = me?.user.role === 'concierge'
  const conciergeName = me?.hotel.concierge_name || 'concierge'
  const firstName = me?.user.name.split(' ')[0] ?? ''
  const isEmpty = messages.length === 0

  const quickActions = [
    { label: 'E-post til gjest', hint: 'Ferdig tekst, klar til å sende', text: 'Skriv en e-post til gjesten [navn] om ' },
    { label: 'Svar på gjestemelding', hint: 'Lim inn meldingen du fikk', text: 'En gjest skrev dette – lag et svar:\n\n' },
    { label: 'Restaurant i kveld', hint: 'Forslag fra våre anbefalinger', text: 'Anbefal en restaurant i kveld for [antall] personer. Ønsker: ' },
    { label: 'Dagsplan', hint: 'Program tilpasset gjesten', text: 'Lag en dagsplan for [antall] gjester som liker ' },
    ...(isConcierge ? [
      { label: 'Husk at …', hint: 'Lagre ny kunnskap', text: 'Husk at ' },
    ] : []),
  ]

  return (
    <div className="app">
      {/* Header */}
      <header className="top">
        <div className="brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/heimr-logo.png" alt="HEIMR Collection" className="wordmark" width={479} height={301} />
          {me && <span className="hotel-tag">{me.hotel.name}</span>}
        </div>
        <nav className="nav">
          {!isEmpty && <button onClick={newConversation} className="nav-btn" disabled={loading}>Ny samtale</button>}
          <a href="/bestillinger" className="nav-btn">Bestillinger</a>
          <button onClick={() => setGuestsOpen(true)} className="nav-btn show-narrow">
            Gjester{vipCount ? <span className="count">{vipCount}</span> : null}
          </button>
          {isConcierge && (
            <a href="/admin/sporsmal" className="nav-btn">
              Spørsmål{me!.openQuestions > 0 && <span className="count">{me!.openQuestions}</span>}
            </a>
          )}
          {isConcierge && <a href="/admin" className="nav-btn hide-sm">Admin</a>}
          <button onClick={logout} className="nav-btn" title={me ? `Innlogget som ${me.user.name}` : undefined}>Logg ut</button>
        </nav>
      </header>

      <div className="body">
      <div className="chat-col">
      {/* Innhold */}
      <main className="scroll">
        {isEmpty ? (
          <section className="welcome">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/heimr-emblem.png" alt="" className="emblem" width={87} height={88} />
            <p className="eyebrow">{me ? `${me.hotel.name} Concierge` : 'Concierge'}</p>
            <h1>{greeting()}{firstName ? `, ${firstName}` : ''}.</h1>
            <p className="lead">
              {isConcierge
                ? 'Hva skal vi få til i dag?'
                : `Spør som om du spurte ${conciergeName}. Vet jeg ikke svaret, sender jeg spørsmålet videre til ${conciergeName}.`}
            </p>
            <div className="actions">
              {quickActions.map(a => (
                <button key={a.label} onClick={() => prefill(a.text)} className="action">
                  <span className="action-label">{a.label}</span>
                  <span className="action-hint">{a.hint}</span>
                </button>
              ))}
            </div>
          </section>
        ) : (
          <div className="thread">
            {messages.map((m, i) => (
              m.role === 'user' ? (
                <div key={i} className="row-user">
                  <div className="bubble-user">{m.content}</div>
                </div>
              ) : (
                <div key={i} className="row-assistant">
                  {m.content ? (
                    <div className="answer" dangerouslySetInnerHTML={{ __html: parseMarkdown(m.content) }} />
                  ) : (
                    <div className="typing" aria-label="Skriver"><span /><span /><span /></div>
                  )}
                  {m.content && !(loading && i === messages.length - 1) && (
                    <div className="msg-actions">
                      <button onClick={() => copy(i, m.content)} className="copy-btn">
                        {copied === i ? 'Kopiert' : 'Kopier'}
                      </button>
                      {fixing !== i && !fixed[i]?.startsWith('✓') && (
                        <button onClick={() => startFix(i)} className="copy-btn">Rett svaret</button>
                      )}
                    </div>
                  )}
                  {fixing === i && (
                    <div className="fix">
                      <label htmlFor={`fix-${i}`}>
                        {isConcierge ? 'Hva er riktig? Dette lagres i kunnskapsbasen.' : `Hva er riktig? Dette sendes til ${conciergeName}.`}
                      </label>
                      <textarea
                        id={`fix-${i}`}
                        autoFocus
                        rows={3}
                        value={fixText}
                        onChange={e => setFixText(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveFix(i) }}
                        placeholder="F.eks. «Kontrast har stengt mandager. Anbefal heller Bass.»"
                      />
                      <div className="fix-row">
                        <button className="fix-save" onClick={() => saveFix(i)} disabled={fixBusy || !fixText.trim()}>
                          {fixBusy ? 'Lagrer …' : isConcierge ? 'Lagre rettelse' : 'Send til ' + conciergeName}
                        </button>
                        <button className="copy-btn" onClick={() => setFixing(null)}>Avbryt</button>
                      </div>
                    </div>
                  )}
                  {fixed[i] && <div className={`fix-done ${fixed[i].startsWith('✓') ? '' : 'err'}`}>{fixed[i]}</div>}
                </div>
              )
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </main>

      {/* Input */}
      <footer className="composer-wrap">
        <div className="composer-inner">
          {!isEmpty && (
            <div className="chips">
              {quickActions.map(a => (
                <button key={a.label} onClick={() => prefill(a.text)} className="chip">{a.label}</button>
              ))}
            </div>
          )}
          <div className="composer">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => { setInput(e.target.value); autoResize() }}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder={isConcierge ? 'Skriv et spørsmål, be om et utkast, eller «husk at …»' : 'Skriv et spørsmål …'}
              disabled={loading}
              rows={1}
            />
            <button onClick={send} disabled={loading || !input.trim()} aria-label="Send" className="send">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      </footer>
      </div>

      <GuestPanel open={guestsOpen} onClose={() => setGuestsOpen(false)} onUse={prefill} onCount={setVipCount} />
      </div>

      <style>{`
        .app { display: flex; flex-direction: column; height: 100dvh; background: ${colors.bg}; color: ${colors.text}; }

        .top {
          height: 60px; flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; gap: 12px;
          padding: 0 20px; background: ${colors.surface}; border-bottom: 1px solid ${colors.border};
        }
        .brand { display: flex; align-items: center; gap: 12px; min-width: 0; }
        .wordmark { height: 44px; width: auto; max-width: none; display: block; flex-shrink: 0; }
        .brand { flex-shrink: 0; }
        @media (max-width: 560px) { .hotel-tag { display: none; } .wordmark { height: 38px; } }
        .hotel-tag {
          font-size: 12px; font-weight: 600; color: ${colors.accentHover}; background: ${colors.accentSoft};
          padding: 4px 10px; border-radius: 999px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .nav { display: flex; gap: 4px; align-items: center; }
        .nav-btn {
          display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: ${colors.text};
          background: transparent; border: none; padding: 8px 10px; border-radius: 8px; cursor: pointer; text-decoration: none; white-space: nowrap;
        }
        .nav-btn:hover { background: ${colors.surfaceHover}; color: ${colors.ink}; }
        .nav-btn:disabled { opacity: 0.4; cursor: default; }
        .count {
          font-size: 11px; font-weight: 700; color: ${colors.accentText}; background: ${colors.accent};
          min-width: 18px; height: 18px; border-radius: 9px; display: inline-flex; align-items: center; justify-content: center; padding: 0 5px;
        }

        .body { flex: 1; display: flex; min-height: 0; }
        .chat-col { flex: 1; display: flex; flex-direction: column; min-width: 0; }
        .scroll { flex: 1; overflow-y: auto; }
        .show-narrow { display: none; }
        @media (max-width: 1099px) { .show-narrow { display: inline-flex; } }

        .welcome { max-width: 760px; margin: 0 auto; padding: 12vh 20px 32px; }
        .emblem { width: 40px; height: auto; display: block; margin-bottom: 22px; opacity: .9; }
        .eyebrow { margin: 0 0 14px; font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: ${colors.accent}; }
        .welcome h1 { margin: 0 0 12px; font-size: clamp(30px, 5vw, 44px); font-weight: 700; letter-spacing: -0.03em; line-height: 1.1; color: ${colors.ink}; }
        .lead { margin: 0 0 36px; font-size: 16px; line-height: 1.6; color: ${colors.muted}; max-width: 520px; }
        .actions { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; }
        .action {
          display: flex; flex-direction: column; gap: 4px; text-align: left; cursor: pointer;
          background: ${colors.surface}; border: 1px solid ${colors.border}; border-radius: 12px; padding: 14px 16px;
          transition: border-color .15s, transform .15s, box-shadow .15s;
        }
        .action:hover { border-color: ${colors.accent}; background: ${colors.surfaceHover}; transform: translateY(-1px); }
        .action-label { font-size: 14px; font-weight: 700; color: ${colors.ink}; }
        .action-hint { font-size: 13px; color: ${colors.muted}; }

        .thread { max-width: 760px; margin: 0 auto; padding: 28px 20px 12px; display: flex; flex-direction: column; gap: 22px; }
        .row-user { display: flex; justify-content: flex-end; }
        .bubble-user {
          max-width: 80%; background: ${colors.userBg}; color: ${colors.ink}; border: 1px solid ${colors.borderStrong}; padding: 11px 16px; border-radius: 18px 18px 4px 18px;
          font-size: 15px; line-height: 1.55; white-space: pre-wrap; overflow-wrap: anywhere;
        }
        .row-assistant { max-width: 100%; }
        .answer { font-size: 15px; line-height: 1.7; color: ${colors.text}; overflow-wrap: anywhere; }
        .answer p { margin: 0 0 12px; }
        .answer p:last-child { margin-bottom: 0; }
        .answer ul, .answer ol { margin: 4px 0 12px; padding-left: 22px; }
        .answer ul { list-style: disc; }
        .answer ol { list-style: decimal; }
        .answer li::marker { color: ${colors.muted}; }
        .answer li { margin-bottom: 6px; }
        .answer strong { font-weight: 700; color: ${colors.accentHover}; }
        .answer h1, .answer h2, .answer h3 { font-size: 16px; font-weight: 700; margin: 16px 0 6px; color: ${colors.ink}; letter-spacing: -0.01em; }
        .answer a { color: ${colors.accentHover}; text-underline-offset: 3px; }
        .answer code { font-size: 13px; background: ${colors.surface}; border: 1px solid ${colors.border}; padding: 1px 6px; border-radius: 4px; }
        .answer hr { border: none; border-top: 1px solid ${colors.border}; margin: 16px 0; }
        .answer blockquote {
          margin: 12px 0; padding: 7px 12px; background: ${colors.accentSoft}; color: ${colors.accentHover};
          border-radius: 8px; font-size: 13px; font-weight: 600; display: inline-block;
        }
        .answer blockquote p { margin: 0; }
        .msg-actions { display: flex; gap: 2px; margin-left: -8px; }
        .msg-actions .copy-btn { margin-left: 0; }
        .fix { margin-top: 10px; padding: 12px; border: 1px solid ${colors.accent}; border-radius: 12px; background: ${colors.surface}; display: flex; flex-direction: column; gap: 8px; }
        .fix label { font-size: 12px; font-weight: 600; color: ${colors.muted}; }
        .fix textarea { width: 100%; box-sizing: border-box; resize: vertical; padding: 10px 12px; font-size: 14px; line-height: 1.5; color: ${colors.ink}; background: ${colors.bg}; border: 1px solid ${colors.border}; border-radius: 10px; outline: none; }
        .fix textarea:focus { border-color: ${colors.accent}; }
        .fix-row { display: flex; gap: 6px; align-items: center; }
        .fix-save { font-size: 13px; font-weight: 700; padding: 7px 14px; border-radius: 9px; border: none; cursor: pointer; background: ${colors.accent}; color: ${colors.accentText}; }
        .fix-save:disabled { opacity: .4; cursor: not-allowed; }
        .fix-done { margin-top: 6px; font-size: 12px; font-weight: 600; color: ${colors.accentHover}; }
        .fix-done.err { color: ${colors.danger}; }
        .copy-btn {
          margin-top: 8px; background: none; border: 1px solid transparent; border-radius: 6px; padding: 3px 8px; margin-left: -8px;
          font-size: 12px; font-weight: 600; color: ${colors.muted}; cursor: pointer;
        }
        .copy-btn:hover { color: ${colors.accent}; border-color: ${colors.border}; background: ${colors.surface}; }
        .typing { display: flex; gap: 5px; padding: 8px 0; }
        .typing span { width: 7px; height: 7px; border-radius: 50%; background: ${colors.borderStrong}; animation: blink 1.2s infinite ease-in-out; }
        .typing span:nth-child(2) { animation-delay: .15s; }
        .typing span:nth-child(3) { animation-delay: .3s; }
        @keyframes blink { 0%, 80%, 100% { opacity: .35; transform: translateY(0) } 40% { opacity: 1; transform: translateY(-2px) } }

        .composer-wrap { flex-shrink: 0; padding: 10px 20px 18px; background: linear-gradient(to bottom, rgba(12,31,15,0), ${colors.bg} 30%); }
        .composer-inner { max-width: 760px; margin: 0 auto; }
        .chips { display: flex; gap: 6px; overflow-x: auto; margin-bottom: 10px; padding-bottom: 2px; scrollbar-width: none; }
        .chip {
          flex-shrink: 0; font-size: 12px; font-weight: 600; color: ${colors.text}; background: ${colors.surface};
          border: 1px solid ${colors.border}; border-radius: 999px; padding: 6px 12px; cursor: pointer; white-space: nowrap;
        }
        .chip:hover { border-color: ${colors.accent}; color: ${colors.accent}; }
        .composer {
          display: flex; align-items: flex-end; gap: 10px; background: ${colors.surface};
          border: 1px solid ${colors.border}; border-radius: 16px; padding: 10px 10px 10px 18px;
          box-shadow: 0 8px 28px rgba(0,0,0,.25); transition: border-color .15s;
        }
        .composer:focus-within { border-color: ${colors.accent}; }
        .composer textarea {
          flex: 1; border: none; outline: none; resize: none; background: transparent; color: ${colors.ink};
          font-size: 15px; line-height: 1.55; min-height: 24px; max-height: 200px; padding: 6px 0;
        }
        .composer textarea::placeholder { color: ${colors.muted}; }
        .send {
          width: 38px; height: 38px; flex-shrink: 0; border-radius: 12px; border: none; cursor: pointer;
          background: ${colors.accent}; color: ${colors.accentText}; display: flex; align-items: center; justify-content: center; transition: background .15s, opacity .15s;
        }
        .send:hover:not(:disabled) { background: ${colors.accentHover}; }
        .send:disabled { opacity: .3; cursor: not-allowed; }

        @media (max-width: 560px) {
          .top { padding: 0 12px; }
          .nav { gap: 0; }
          .nav-btn { padding: 8px 6px; font-size: 12px; }
          .hide-sm { display: none; }
          .welcome { padding-top: 8vh; }
          .actions { grid-template-columns: 1fr 1fr; }
          .action-hint { display: none; }
          .composer-wrap { padding: 8px 12px 12px; }
          .thread { padding: 20px 16px 8px; }
        }
      `}</style>
    </div>
  )
}
