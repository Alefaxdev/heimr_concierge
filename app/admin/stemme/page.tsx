'use client'
import { useEffect, useState } from 'react'
import AdminHeader from '@/components/AdminHeader'

type Voice = { concierge_name: string; voice_guide: string; voice_examples: string; mews_enterprise_id: string }
type Enterprise = { id: string; name: string }

export default function VoicePage() {
  const [voice, setVoice] = useState<Voice>({ concierge_name: '', voice_guide: '', voice_examples: '', mews_enterprise_id: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [dirty, setDirty] = useState(false)
  const [enterprises, setEnterprises] = useState<Enterprise[] | null>(null)
  const [entBusy, setEntBusy] = useState(false)
  const [entError, setEntError] = useState('')

  useEffect(() => {
    fetch('/api/hotel').then(r => r.json()).then(d => {
      const h = d.hotel ?? {}
      setVoice({ concierge_name: h.concierge_name ?? '', voice_guide: h.voice_guide ?? '', voice_examples: h.voice_examples ?? '', mews_enterprise_id: h.mews_enterprise_id ?? '' })
      setLoading(false)
    })
  }, [])

  function set<K extends keyof Voice>(k: K, v: string) {
    setVoice(p => ({ ...p, [k]: v }))
    setDirty(true)
  }

  async function loadEnterprises() {
    setEntBusy(true)
    setEntError('')
    const res = await fetch('/api/mews/enterprises')
    const d = await res.json().catch(() => ({}))
    setEntBusy(false)
    if (!res.ok) { setEntError(d.error ?? 'Kunne ikke hente fra Mews'); return }
    setEnterprises(d.enterprises ?? [])
  }

  async function save() {
    setSaving(true)
    const res = await fetch('/api/hotel', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(voice) })
    setSaving(false)
    setMsg(res.ok ? { ok: true, text: 'Lagret. Assistenten bruker dette fra neste melding.' } : { ok: false, text: 'Kunne ikke lagre.' })
    if (res.ok) setDirty(false)
    setTimeout(() => setMsg(null), 3500)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F5F2EC', color: '#33373B' }}>
      <AdminHeader />
      <div style={{ padding: '24px 16px 48px', maxWidth: 760, margin: '0 auto' }}>
        <p style={{ fontSize: 14, color: '#555', lineHeight: 1.7, margin: '0 0 24px' }}>
          Stemmen er det som gjør at assistenten høres ut som deg og ikke som en AI. Jo mer ekte eksempler, jo bedre treffer den.
        </p>

        {loading ? <div style={{ color: '#888', fontSize: 14 }}>Laster…</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            <section style={card}>
              <label style={label} htmlFor="name">Concierge-navn</label>
              <p style={help}>Navnet resepsjonen kjenner, f.eks. «Celine». Brukes i chatten («Spør Celine…»).</p>
              <input id="name" value={voice.concierge_name} onChange={e => set('concierge_name', e.target.value)} style={input} />
            </section>

            <section style={card}>
              <label style={label} htmlFor="guide">Stemmeguide</label>
              <p style={help}>
                Beskriv hvordan du skriver: tone, hvor formell, du/De, hilsen og avslutning, ord du bruker og ord du aldri bruker.
                Eksempel: «Alltid du, aldri De. Starter med &lsquo;Hei [navn]&rsquo;. Korte setninger. Avslutter med &lsquo;Varm hilsen, Celine&rsquo;. Aldri utropstegn i første setning.»
              </p>
              <textarea id="guide" value={voice.voice_guide} onChange={e => set('voice_guide', e.target.value)} rows={8} style={{ ...input, resize: 'vertical', lineHeight: 1.6 }} />
            </section>

            <section style={card}>
              <label style={label} htmlFor="ex">Ekte eksempler</label>
              <p style={help}>
                Lim inn 10–20 e-poster eller meldinger du faktisk har sendt til gjester, på norsk og engelsk. Fjern gjestenes etternavn og kontaktinfo.
                Skill eksemplene med en linje med <code>---</code>.
              </p>
              <textarea id="ex" value={voice.voice_examples} onChange={e => set('voice_examples', e.target.value)} rows={16}
                placeholder={'Hei Maria,\n\nSå hyggelig at dere kommer…\n\n---\n\nDear Mr. Smith,\n…'}
                style={{ ...input, resize: 'vertical', lineHeight: 1.6, fontSize: 13 }} />
              <div style={{ fontSize: 11, color: '#aaa', marginTop: 6 }}>
                {voice.voice_examples.split(/\n-{3,}\n/).filter(s => s.trim()).length} eksempler
              </div>
            </section>

            <section style={card}>
              <label style={label} htmlFor="mews">Mews-kobling</label>
              <p style={help}>
                Hvilket hotell i Mews dette er. Brukes til panelet med dagens VIP-gjester i chatten.
                Trykk «Finn i Mews» for å velge fra listen over hotellene tokenet har tilgang til.
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input id="mews" value={voice.mews_enterprise_id} onChange={e => set('mews_enterprise_id', e.target.value)}
                  placeholder="Enterprise-ID fra Mews" style={{ ...input, flex: '1 1 260px', fontFamily: 'ui-monospace, monospace', fontSize: 13 }} />
                <button onClick={loadEnterprises} disabled={entBusy} style={secondaryBtn}>{entBusy ? 'Henter…' : 'Finn i Mews'}</button>
              </div>
              {entError && <div style={{ fontSize: 13, color: '#B91C1C', marginTop: 8 }}>{entError}</div>}
              {enterprises && (
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto' }}>
                  {enterprises.length === 0 && <div style={{ fontSize: 13, color: '#777' }}>Fant ingen hotell for tokenet.</div>}
                  {enterprises.map(e => {
                    const chosen = voice.mews_enterprise_id === e.id
                    return (
                      <button key={e.id} onClick={() => set('mews_enterprise_id', e.id)} style={{
                        display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', textAlign: 'left',
                        padding: '10px 12px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
                        border: `1px solid ${chosen ? '#C17A3A' : '#E5E1D9'}`, background: chosen ? '#FBF3EA' : '#FAF9F7',
                      }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#16181A' }}>{e.name}</span>
                        <span style={{ fontSize: 12, color: chosen ? '#C17A3A' : '#999', fontWeight: 600 }}>{chosen ? 'Valgt' : 'Velg'}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </section>

            <div style={{ display: 'flex', gap: 12, alignItems: 'center', position: 'sticky', bottom: 16 }}>
              <button onClick={save} disabled={saving || !dirty} style={{
                padding: '12px 28px', fontSize: 13, fontFamily: 'inherit', background: saving || !dirty ? '#C9CFCB' : '#0C1F0F', color: '#fff', border: 'none', borderRadius: 10,
                cursor: saving || !dirty ? 'not-allowed' : 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              }}>{saving ? 'Lagrer…' : 'Lagre'}</button>
              {msg && <span style={{ fontSize: 13, color: msg.ok ? '#15803D' : '#B91C1C' }}>{msg.text}</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const secondaryBtn: React.CSSProperties = { padding: '10px 16px', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', background: '#fff', color: '#0C1F0F', border: '1px solid #D3CDC2', borderRadius: 10, cursor: 'pointer', whiteSpace: 'nowrap' }
const card: React.CSSProperties = { background: '#fff', border: '1px solid #E5E1D9', borderRadius: 12, padding: 20 }
const label: React.CSSProperties = { display: 'block', fontSize: 14, fontWeight: 700, color: '#16181A', marginBottom: 6 }
const help: React.CSSProperties = { fontSize: 13, color: '#777', lineHeight: 1.6, margin: '0 0 12px' }
const input: React.CSSProperties = { width: '100%', padding: '10px 12px', fontSize: 14, border: '1px solid #E5E1D9', borderRadius: 10, fontFamily: 'inherit', boxSizing: 'border-box', background: '#FAF9F7', outline: 'none' }
