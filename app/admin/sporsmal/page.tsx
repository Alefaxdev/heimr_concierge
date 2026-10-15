'use client'
import { useEffect, useState } from 'react'
import AdminHeader from '@/components/AdminHeader'

type Question = {
  id: string
  question: string
  context: string | null
  asked_by: string | null
  status: 'open' | 'answered' | 'dismissed'
  answer: string | null
  created_at: string
  answered_at: string | null
}

type Filter = 'open' | 'answered' | 'dismissed'

const CATEGORIES = ['Restauranter', 'Opplevelser', 'Transport', 'Hotellinfo', 'Rutiner', 'Leverandører', 'Salg']

function fmt(d: string) {
  return new Date(d).toLocaleString('nb-NO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function QuestionsPage() {
  const [filter, setFilter] = useState<Filter>('open')
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [draft, setDraft] = useState({ title: '', answer: '', category: '', shared: false, valid_until: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/questions?status=${filter}`)
      .then(r => r.json())
      .catch(() => ({}))
      .then(data => {
        if (cancelled) return
        setQuestions(data.questions ?? [])
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [filter, reloadKey])

  function load() {
    setReloadKey(k => k + 1)
  }

  function open(q: Question) {
    setActiveId(q.id)
    setError('')
    setDraft({ title: q.question.slice(0, 120), answer: '', category: '', shared: false, valid_until: '' })
  }

  async function act(id: string, action: 'answer' | 'dismiss' | 'reopen') {
    setBusy(true)
    setError('')
    const res = await fetch('/api/questions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action, ...(action === 'answer' ? { ...draft, valid_until: draft.valid_until || null } : {}) }),
    })
    setBusy(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Noe gikk galt')
      return
    }
    setActiveId(null)
    load()
  }

  const tab = (f: Filter, label: string) => (
    <button onClick={() => { if (f !== filter) { setLoading(true); setFilter(f) } setActiveId(null) }} style={{
      padding: '6px 14px', fontSize: 12, borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit',
      border: filter === f ? '1px solid #0C1F0F' : '1px solid #E5E1D9',
      background: filter === f ? '#0C1F0F' : '#fff', color: filter === f ? '#fff' : '#555',
    }}>{label}</button>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#F5F2EC', color: '#33373B' }}>
      <AdminHeader />
      <div style={{ padding: '24px 16px', maxWidth: 992, margin: '0 auto', boxSizing: 'border-box' }}>
        <p style={{ fontSize: 14, color: '#555', lineHeight: 1.6, margin: '0 0 18px', maxWidth: 620 }}>
          Spørsmål assistenten ikke kunne svare på. Når du svarer, havner svaret i kunnskapsbasen, så neste gang svarer assistenten selv.
        </p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {tab('open', 'Ubesvarte')}
          {tab('answered', 'Besvarte')}
          {tab('dismissed', 'Avviste')}
        </div>

        {loading ? (
          <div style={{ color: '#888', fontSize: 14 }}>Laster…</div>
        ) : questions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '56px 0', color: '#aaa', fontSize: 14 }}>
            {filter === 'open' ? 'Ingen ubesvarte spørsmål 🎉' : 'Ingenting her.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {questions.map(q => (
              <div key={q.id} style={{ background: '#fff', border: `1px solid ${activeId === q.id ? '#C17A3A' : '#e5e5e5'}`, borderRadius: 12, padding: '16px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.45, color: '#33373B' }}>{q.question}</div>
                    {q.context && <div style={{ fontSize: 13, color: '#666', marginTop: 6, lineHeight: 1.5 }}>{q.context}</div>}
                    <div style={{ fontSize: 11, color: '#aaa', marginTop: 8 }}>
                      {q.asked_by ? `${q.asked_by} · ` : ''}{fmt(q.created_at)}
                    </div>
                  </div>
                  {q.status === 'open' && activeId !== q.id && (
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button onClick={() => open(q)} style={btn(false)}>Svar</button>
                      <button onClick={() => act(q.id, 'dismiss')} disabled={busy} style={btnGhost}>Avvis</button>
                    </div>
                  )}
                  {q.status !== 'open' && (
                    <button onClick={() => act(q.id, 'reopen')} disabled={busy} style={{ ...btnGhost, flexShrink: 0 }}>Åpne igjen</button>
                  )}
                </div>

                {q.status === 'answered' && q.answer && (
                  <div style={{ marginTop: 12, padding: '10px 14px', background: '#F0FDF4', borderRadius: 10, fontSize: 13, color: '#14532D', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    {q.answer}
                  </div>
                )}

                {activeId === q.id && (
                  <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                      <label style={label}>Svar *</label>
                      <textarea autoFocus value={draft.answer} onChange={e => setDraft(d => ({ ...d, answer: e.target.value }))} rows={5}
                        placeholder="Svar som du ville svart en kollega – dette blir kunnskap assistenten bruker."
                        style={{ ...input, resize: 'vertical', lineHeight: 1.6 }} />
                    </div>
                    <div>
                      <label style={label}>Tittel i kunnskapsbasen</label>
                      <input value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} style={input} />
                    </div>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ flex: '1 1 160px' }}>
                        <label style={label}>Kategori</label>
                        <select value={draft.category} onChange={e => setDraft(d => ({ ...d, category: e.target.value }))} style={input}>
                          <option value="">Ingen</option>
                          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div style={{ flex: '1 1 160px' }}>
                        <label style={label}>Gjelder for</label>
                        <select value={draft.shared ? 's' : 'h'} onChange={e => setDraft(d => ({ ...d, shared: e.target.value === 's' }))} style={input}>
                          <option value="h">Bare dette hotellet</option>
                          <option value="s">Alle HEIMR-hotell</option>
                        </select>
                      </div>
                      <div style={{ flex: '1 1 160px' }}>
                        <label style={label}>Gyldig til</label>
                        <input type="date" value={draft.valid_until} onChange={e => setDraft(d => ({ ...d, valid_until: e.target.value }))} style={input} />
                      </div>
                    </div>
                    {error && <div style={{ fontSize: 13, color: '#B91C1C' }}>{error}</div>}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => act(q.id, 'answer')} disabled={busy || !draft.answer.trim()} style={btn(busy || !draft.answer.trim())}>
                        {busy ? 'Lagrer…' : 'Lagre svar'}
                      </button>
                      <button onClick={() => setActiveId(null)} style={btnGhost}>Avbryt</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const label: React.CSSProperties = {
  display: 'block', fontSize: 13, fontWeight: 600, color: '#16181A', marginBottom: 6,
}
const input: React.CSSProperties = {
  width: '100%', padding: '10px 12px', fontSize: 14, border: '1px solid #E5E1D9', borderRadius: 10,
  fontFamily: 'inherit', boxSizing: 'border-box', background: '#FAF9F7', outline: 'none',
}
const btn = (disabled: boolean): React.CSSProperties => ({
  padding: '8px 18px', fontSize: 13, fontFamily: 'inherit', background: disabled ? '#C9CFCB' : '#0C1F0F',
  color: '#fff', border: 'none', borderRadius: 10, cursor: disabled ? 'not-allowed' : 'pointer',
})
const btnGhost: React.CSSProperties = {
  padding: '8px 14px', fontSize: 13, fontFamily: 'inherit', background: '#fff', color: '#555',
  border: '1px solid #E5E1D9', borderRadius: 10, cursor: 'pointer',
}
