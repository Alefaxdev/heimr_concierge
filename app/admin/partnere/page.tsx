'use client'
import { useEffect, useMemo, useState } from 'react'
import AdminHeader from '@/components/AdminHeader'

const CATEGORIES = ['Restaurant', 'Taxi', 'Transport', 'Opplevelse', 'Spa', 'Annet'] as const

type Partner = {
  id: string
  hotel_id: string | null
  name: string
  category: string
  email: string | null
  phone: string | null
  booking_url: string | null
  address: string | null
  contact_name: string | null
  notes: string | null
  active: boolean
}

type Form = {
  name: string; category: string; shared: boolean; email: string; phone: string; booking_url: string
  address: string; contact_name: string; notes: string; active: boolean
}

const EMPTY: Form = { name: '', category: 'Restaurant', shared: false, email: '', phone: '', booking_url: '', address: '', contact_name: '', notes: '', active: true }

function toForm(p: Partner): Form {
  return {
    name: p.name, category: p.category, shared: p.hotel_id === null, email: p.email ?? '', phone: p.phone ?? '',
    booking_url: p.booking_url ?? '', address: p.address ?? '', contact_name: p.contact_name ?? '', notes: p.notes ?? '', active: p.active,
  }
}

export default function PartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)
  const [filter, setFilter] = useState<string>('Alle')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [form, setForm] = useState<Form>(EMPTY)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/partners?all=1').then(r => r.json()).catch(() => ({})).then(d => {
      if (cancelled) return
      setPartners(d.partners ?? [])
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [reloadKey])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return partners.filter(p =>
      (filter === 'Alle' || p.category === filter) &&
      (!q || [p.name, p.address, p.contact_name, p.notes].some(v => v?.toLowerCase().includes(q))),
    )
  }, [partners, filter, search])

  const counts = useMemo(() => {
    const c: Record<string, number> = { Alle: partners.length }
    for (const p of partners) c[p.category] = (c[p.category] ?? 0) + 1
    return c
  }, [partners])

  function startNew() {
    setEditing('new')
    setForm({ ...EMPTY, category: filter !== 'Alle' ? filter : 'Restaurant' })
    setError('')
  }

  function startEdit(p: Partner) {
    setEditing(p.id)
    setForm(toForm(p))
    setError('')
  }

  async function save() {
    if (!form.name.trim()) { setError('Navn må fylles ut'); return }
    setBusy(true)
    setError('')
    const res = await fetch(editing === 'new' ? '/api/partners' : `/api/partners/${editing}`, {
      method: editing === 'new' ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setBusy(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? 'Kunne ikke lagre')
      return
    }
    setEditing(null)
    setReloadKey(k => k + 1)
  }

  async function remove(id: string) {
    await fetch(`/api/partners/${id}`, { method: 'DELETE' })
    setConfirmDelete(null)
    if (editing === id) setEditing(null)
    setReloadKey(k => k + 1)
  }

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm(f => ({ ...f, [k]: v }))

  const formCard = (
    <div style={{ ...card, borderColor: '#C17A3A' }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#16181A', marginBottom: 14 }}>
        {editing === 'new' ? 'Ny partner' : `Endre ${form.name || 'partner'}`}
      </div>
      <div style={grid}>
        <Field label="Navn *" span={2}><input value={form.name} onChange={e => set('name', e.target.value)} style={input} placeholder="F.eks. Kontrast" autoFocus /></Field>
        <Field label="Kategori">
          <select value={form.category} onChange={e => set('category', e.target.value)} style={input}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Gjelder for">
          <select value={form.shared ? 's' : 'h'} onChange={e => set('shared', e.target.value === 's')} style={input}>
            <option value="h">Bare dette hotellet</option>
            <option value="s">Alle HEIMR-hotell</option>
          </select>
        </Field>
        <Field label="Telefon"><input value={form.phone} onChange={e => set('phone', e.target.value)} style={input} placeholder="+47 …" inputMode="tel" /></Field>
        <Field label="E-post (for bestilling)"><input value={form.email} onChange={e => set('email', e.target.value)} style={input} placeholder="booking@…" inputMode="email" /></Field>
        <Field label="Bookinglenke" span={2}><input value={form.booking_url} onChange={e => set('booking_url', e.target.value)} style={input} placeholder="https://…" inputMode="url" /></Field>
        <Field label="Adresse"><input value={form.address} onChange={e => set('address', e.target.value)} style={input} /></Field>
        <Field label="Kontaktperson"><input value={form.contact_name} onChange={e => set('contact_name', e.target.value)} style={input} /></Field>
        <Field label="Notater" span={2}>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} style={{ ...input, resize: 'vertical', lineHeight: 1.5 }}
            placeholder="F.eks. «Spør etter Lars og si at dere kommer fra Opus. Holder av bardisken for oss til kl. 18.»" />
        </Field>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#33373B', marginTop: 12 }}>
        <input type="checkbox" checked={form.active} onChange={e => set('active', e.target.checked)} /> Aktiv (vises i bestillinger og i chatten)
      </label>
      {error && <div style={{ fontSize: 13, color: '#B91C1C', marginTop: 10 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button onClick={save} disabled={busy} style={btn(busy)}>{busy ? 'Lagrer…' : 'Lagre'}</button>
        <button onClick={() => setEditing(null)} style={ghost}>Avbryt</button>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#F5F2EC', color: '#33373B' }}>
      <AdminHeader />
      <div style={{ padding: '24px 16px 48px', maxWidth: 992, margin: '0 auto', boxSizing: 'border-box' }}>
        <p style={{ fontSize: 14, color: '#555', lineHeight: 1.6, margin: '0 0 18px', maxWidth: 640 }}>
          Restauranter, taxi og andre samarbeidspartnere. Brukes på bestillingssiden og av assistenten når den anbefaler steder.
        </p>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(['Alle', ...CATEGORIES] as string[]).map(c => (
              <button key={c} onClick={() => setFilter(c)} style={chip(filter === c)}>
                {c}{counts[c] ? ` ${counts[c]}` : ''}
              </button>
            ))}
          </div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Søk …" style={{ ...input, width: 200, marginLeft: 'auto', padding: '8px 12px' }} />
          <button onClick={startNew} style={btn(false)}>+ Ny partner</button>
        </div>

        {editing === 'new' && <div style={{ marginBottom: 14 }}>{formCard}</div>}

        {loading ? (
          <div style={{ color: '#888', fontSize: 14 }}>Laster …</div>
        ) : visible.length === 0 && editing !== 'new' ? (
          <div style={{ ...card, textAlign: 'center', padding: '40px 20px', color: '#888', fontSize: 14 }}>
            {partners.length === 0 ? 'Ingen partnere ennå. Legg til restaurantene og taxiselskapene dere bruker mest.' : 'Ingen treff.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {visible.map(p => editing === p.id ? <div key={p.id}>{formCard}</div> : (
              <div key={p.id} style={{ ...card, display: 'flex', gap: 16, alignItems: 'flex-start', opacity: p.active ? 1 : 0.55 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#16181A' }}>{p.name}</span>
                    <span style={badge('#F1EEE8', '#57534E')}>{p.category}</span>
                    {p.hotel_id === null && <span style={badge('#FBF3EA', '#A0602A')}>Felles HEIMR</span>}
                    {!p.active && <span style={badge('#F5F5F4', '#78716C')}>Inaktiv</span>}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', marginTop: 6, fontSize: 13, color: '#666' }}>
                    {p.phone && <a href={`tel:${p.phone.replace(/\s/g, '')}`} style={link}>{p.phone}</a>}
                    {p.email && <a href={`mailto:${p.email}`} style={link}>{p.email}</a>}
                    {p.booking_url && <a href={p.booking_url} target="_blank" rel="noopener noreferrer" style={link}>Bookingside ↗</a>}
                    {p.address && <span>{p.address}</span>}
                    {p.contact_name && <span>Kontakt: {p.contact_name}</span>}
                  </div>
                  {p.notes && <div style={{ fontSize: 13, color: '#555', marginTop: 6, lineHeight: 1.5 }}>{p.notes}</div>}
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {confirmDelete === p.id ? (
                    <>
                      <button onClick={() => remove(p.id)} style={{ ...ghost, background: '#B91C1C', color: '#fff', borderColor: '#B91C1C' }}>Slett</button>
                      <button onClick={() => setConfirmDelete(null)} style={ghost}>Avbryt</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => startEdit(p)} style={ghost}>Endre</button>
                      <button onClick={() => setConfirmDelete(p.id)} style={{ ...ghost, color: '#999' }} aria-label={`Slett ${p.name}`}>✕</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, span = 1, children }: { label: string; span?: 1 | 2; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, gridColumn: span === 2 ? '1 / -1' : undefined }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: '#16181A' }}>{label}</span>
      {children}
    </label>
  )
}

const card: React.CSSProperties = { background: '#fff', border: '1px solid #E5E1D9', borderRadius: 12, padding: '16px 18px' }
const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }
const input: React.CSSProperties = { width: '100%', padding: '10px 12px', fontSize: 14, border: '1px solid #E5E1D9', borderRadius: 10, fontFamily: 'inherit', boxSizing: 'border-box', background: '#FAF9F7', outline: 'none', color: '#16181A' }
const btn = (disabled: boolean): React.CSSProperties => ({ padding: '9px 18px', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', background: disabled ? '#C9CFCB' : '#0C1F0F', color: '#fff', border: 'none', borderRadius: 10, cursor: disabled ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' })
const ghost: React.CSSProperties = { padding: '7px 12px', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', background: '#fff', color: '#33373B', border: '1px solid #E5E1D9', borderRadius: 10, cursor: 'pointer' }
const chip = (on: boolean): React.CSSProperties => ({ padding: '6px 12px', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', borderRadius: 999, cursor: 'pointer', border: `1px solid ${on ? '#0C1F0F' : '#E5E1D9'}`, background: on ? '#0C1F0F' : '#fff', color: on ? '#fff' : '#555' })
const badge = (bg: string, color: string): React.CSSProperties => ({ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: bg, color })
const link: React.CSSProperties = { color: '#A0602A', textDecoration: 'none', fontWeight: 600 }
