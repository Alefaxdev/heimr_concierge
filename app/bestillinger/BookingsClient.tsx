'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { colors } from '@/lib/theme'

export type GuestRef = {
  reservationId: string | null
  number: string | null
  name: string
  room: string | null
  persons: number | null
  arrival: string | null
  departure: string | null
}

type MewsGuest = {
  reservationId: string
  number: string
  name: string
  room: string | null
  arrival: string
  departure: string
  state: string
  persons: number
  classifications: string[]
}

type Partner = {
  id: string
  name: string
  category: string
  email: string | null
  phone: string | null
  booking_url: string | null
  address: string | null
  contact_name: string | null
  notes: string | null
  description: string | null
  image_url: string | null
}

type Booking = {
  id: string
  partner_id: string | null
  partner_name: string | null
  category: string | null
  guest_name: string
  room: string | null
  booking_date: string | null
  booking_time: string | null
  persons: number | null
  wishes: string | null
  status: 'draft' | 'sent' | 'confirmed' | 'cancelled'
  email_subject: string | null
  email_body: string | null
  created_by: string | null
}

type Me = { hotel: { name: string; concierge_name: string | null }; user: { name: string; role: 'staff' | 'concierge' } }

const CATEGORIES = ['Restaurant', 'Taxi', 'Transport', 'Opplevelse', 'Spa', 'Annet']
const STATUS_LABEL: Record<Booking['status'], string> = { draft: 'Utkast', sent: 'Sendt', confirmed: 'Bekreftet', cancelled: 'Avlyst' }
const VIP = new Set(['VeryImportant', 'Important', 'TopManagement', 'Media'])

function todayOslo() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Oslo' }).format(new Date())
}
function shortDate(iso: string) {
  return new Intl.DateTimeFormat('nb-NO', { timeZone: 'Europe/Oslo', day: 'numeric', month: 'short' }).format(new Date(iso)).replace('.', '')
}
function dayLabel(date: string | null) {
  if (!date) return 'Uten dato'
  const today = todayOslo()
  const tomorrow = new Date(Date.parse(today) + 86400000).toISOString().slice(0, 10)
  const yesterday = new Date(Date.parse(today) - 86400000).toISOString().slice(0, 10)
  if (date === today) return 'I dag'
  if (date === tomorrow) return 'I morgen'
  if (date === yesterday) return 'I går'
  return new Intl.DateTimeFormat('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${date}T12:00:00Z`))
}

function PartnerImage({ src, name }: { src: string | null; name: string }) {
  const [broken, setBroken] = useState(false)
  const initials = name.split(/\s+/).filter(w => /[A-Za-zÆØÅæøå0-9]/.test(w[0] ?? '')).slice(0, 2).map(w => w[0]).join('').toUpperCase()
  return (
    <span className="p-img">
      {src && !broken
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
        : <span>{initials || '·'}</span>}
    </span>
  )
}

export default function BookingsClient({ initialGuest }: { initialGuest: GuestRef | null }) {
  const [me, setMe] = useState<Me | null>(null)
  const [partners, setPartners] = useState<Partner[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [listView, setListView] = useState<'upcoming' | 'past'>('upcoming')
  const [listKey, setListKey] = useState(0)

  // Skjema
  const [guest, setGuest] = useState<GuestRef | null>(initialGuest)
  const [manual, setManual] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<MewsGuest[]>([])
  const [searching, setSearching] = useState(false)
  const [mewsState, setMewsState] = useState<'unknown' | 'ok' | 'off' | 'error'>('unknown')
  const [category, setCategory] = useState('Restaurant')
  const [partnerId, setPartnerId] = useState('')
  const [date, setDate] = useState(todayOslo)
  const [time, setTime] = useState('19:00')
  const [persons, setPersons] = useState<string>(initialGuest?.persons ? String(initialGuest.persons) : '2')
  const [wishes, setWishes] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [drafting, setDrafting] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetch('/api/hotel').then(async r => {
      if (r.status === 401) { window.location.href = '/login?next=/bestillinger'; return }
      if (r.ok) setMe(await r.json())
    })
    fetch('/api/partners').then(r => r.json()).then(d => setPartners(d.partners ?? [])).catch(() => {})
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch(`/api/bookings${listView === 'past' ? '?view=past' : ''}`).then(r => r.json()).catch(() => ({})).then(d => {
      if (!cancelled) setBookings(d.bookings ?? [])
    })
    return () => { cancelled = true }
  }, [listView, listKey])

  const partner = partners.find(p => p.id === partnerId) ?? null
  const needsTime = category !== 'Annet'
  const partnersInCat = useMemo(() => partners.filter(p => p.category === category), [partners, category])

  function onQuery(v: string) {
    setQuery(v)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (v.trim().length < 2) { setResults([]); return }
    searchTimer.current = setTimeout(async () => {
      setSearching(true)
      const res = await fetch(`/api/guests/search?q=${encodeURIComponent(v.trim())}`)
      const d = await res.json().catch(() => ({}))
      setSearching(false)
      if (d.configured === false) { setMewsState('off'); setResults([]); return }
      if (d.error) { setMewsState('error'); setResults([]); return }
      setMewsState('ok')
      setResults(d.guests ?? [])
    }, 300)
  }

  function pickGuest(g: MewsGuest) {
    setGuest({ reservationId: g.reservationId, number: g.number, name: g.name, room: g.room, persons: g.persons || null, arrival: g.arrival, departure: g.departure })
    if (g.persons) setPersons(String(g.persons))
    setQuery('')
    setResults([])
    resetDraft()
  }

  function resetDraft() {
    setSubject('')
    setBody('')
    setSavedId(null)
  }

  function flash(ok: boolean, text: string) {
    setMessage({ ok, text })
    setTimeout(() => setMessage(null), 3500)
  }

  async function makeDraft() {
    if (!guest?.name.trim()) { flash(false, 'Velg eller skriv inn en gjest først'); return }
    if (!partner) { flash(false, 'Velg en partner først'); return }
    setDrafting(true)
    const res = await fetch('/api/bookings/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ partner_id: partner.id, guest_name: guest.name, room: guest.room, booking_date: date, booking_time: needsTime ? time : undefined, persons: Number(persons) || undefined, wishes }),
    })
    const d = await res.json().catch(() => ({}))
    setDrafting(false)
    if (!res.ok) { flash(false, d.error ?? 'Kunne ikke lage utkast'); return }
    setSubject(d.subject ?? '')
    setBody(d.body ?? '')
  }

  /** Lagrer (oppretter eller oppdaterer) bestillingen med gitt status. */
  async function save(status: Booking['status']): Promise<boolean> {
    if (!guest?.name.trim()) { flash(false, 'Velg eller skriv inn en gjest først'); return false }
    if (!partner) { flash(false, 'Velg en partner først'); return false }
    const payload = {
      partner_id: partner.id, partner_name: partner.name, category: partner.category,
      guest_name: guest.name, reservation_id: guest.reservationId, reservation_number: guest.number, room: guest.room,
      booking_date: date, booking_time: time, persons: Number(persons) || null, wishes,
      email_subject: subject, email_body: body, status,
    }
    const res = savedId
      ? await fetch(`/api/bookings/${savedId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      : await fetch('/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) { flash(false, d.error ?? 'Kunne ikke lagre'); return false }
    if (!savedId && d.id) setSavedId(d.id)
    setListKey(k => k + 1)
    return true
  }

  async function openMail() {
    if (!partner?.email) return
    if (!(await save('sent'))) return
    const href = `mailto:${partner.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    window.location.href = href
    flash(true, 'Lagret som «Sendt». Marker som bekreftet når partneren svarer.')
  }

  async function openBooking() {
    if (!partner?.booking_url) return
    window.open(partner.booking_url, '_blank', 'noopener,noreferrer')
    if (await save('draft')) flash(true, 'Lagret. Marker som bekreftet når bookingen er gjort.')
  }

  async function copyText() {
    try {
      await navigator.clipboard.writeText(`${subject}\n\n${body}`)
      flash(true, 'Kopiert')
    } catch {}
  }

  async function setStatus(id: string, status: Booking['status']) {
    setBookings(bs => bs.map(b => (b.id === id ? { ...b, status } : b)))
    await fetch(`/api/bookings/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
  }

  function newBooking() {
    setGuest(null)
    setManual(false)
    setPartnerId('')
    setWishes('')
    setPersons('2')
    setDate(todayOslo())
    resetDraft()
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/login'
  }

  const grouped = useMemo(() => {
    const m = new Map<string, Booking[]>()
    for (const b of bookings) {
      const k = b.booking_date ?? ''
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(b)
    }
    return [...m.entries()]
  }, [bookings])

  const isConcierge = me?.user.role === 'concierge'

  return (
    <div className="bk">
      <header className="top">
        <div className="brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/heimr-wordmark.png" alt="HEIMR" className="wordmark" width={250} height={45} />
          {me && <span className="hotel-tag">{me.hotel.name}</span>}
        </div>
        <nav className="nav">
          <Link href="/" className="nav-btn">Chat</Link>
          <span className="nav-btn active">Bestillinger</span>
          {isConcierge && <Link href="/admin/partnere" className="nav-btn hide-sm">Partnere</Link>}
          <button onClick={logout} className="nav-btn">Logg ut</button>
        </nav>
      </header>

      <div className="layout">
        {/* Skjema */}
        <main className="form-col">
          <div className="head-row">
            <h1>Ny bestilling</h1>
            {(guest || partnerId || body) && <button className="link-btn" onClick={newBooking}>Start på nytt</button>}
          </div>

          {/* 1. Gjest */}
          <section className="step">
            <div className="step-label"><span>1</span>Gjest</div>
            {guest ? (
              <div className="guest-chip">
                <div>
                  <div className="g-name">{guest.name}</div>
                  <div className="g-meta">
                    {guest.room ? `Rom ${guest.room}` : 'Uten rom'}
                    {guest.arrival && guest.departure ? ` · ${shortDate(guest.arrival)}–${shortDate(guest.departure)}` : ''}
                    {guest.persons ? ` · ${guest.persons} pers.` : ''}
                  </div>
                </div>
                <button className="link-btn" onClick={() => { setGuest(null); setManual(false); resetDraft() }}>Endre</button>
              </div>
            ) : manual ? (
              <div className="row2">
                <input className="field" placeholder="Gjestens navn" value={query} onChange={e => setQuery(e.target.value)} autoFocus />
                <button className="btn" disabled={!query.trim()} onClick={() => { setGuest({ reservationId: null, number: null, name: query.trim(), room: null, persons: null, arrival: null, departure: null }); setQuery('') }}>Bruk</button>
              </div>
            ) : (
              <div className="search">
                <input className="field" placeholder="Søk på navn, rom eller reservasjonsnummer …" value={query} onChange={e => onQuery(e.target.value)} autoFocus />
                {(results.length > 0 || searching || (query.trim().length >= 2 && mewsState !== 'unknown')) && (
                  <div className="results">
                    {searching && <div className="r-empty">Søker i Mews …</div>}
                    {!searching && mewsState === 'off' && <div className="r-empty">Mews er ikke koblet til. Skriv inn navnet manuelt.</div>}
                    {!searching && mewsState === 'error' && <div className="r-empty">Fikk ikke søkt i Mews akkurat nå.</div>}
                    {!searching && mewsState === 'ok' && results.length === 0 && <div className="r-empty">Ingen gjester funnet (søker blant innsjekkede og ankomster neste 3 uker).</div>}
                    {results.map(g => (
                      <button key={g.reservationId} className="r-item" onClick={() => pickGuest(g)}>
                        <span className="r-name">
                          {g.name}
                          {g.classifications.some(c => VIP.has(c)) && <em>VIP</em>}
                        </span>
                        <span className="r-meta">
                          {g.room ? `Rom ${g.room}` : 'Uten rom'} · {shortDate(g.arrival)}–{shortDate(g.departure)}{g.state === 'Started' ? ' · i huset' : ''}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                <button className="link-btn small" onClick={() => setManual(true)}>Gjesten finnes ikke i Mews? Skriv inn navn</button>
              </div>
            )}
          </section>

          {/* 2. Partner */}
          <section className="step">
            <div className="step-label"><span>2</span>Hva skal bestilles</div>
            <div className="chips">
              {CATEGORIES.map(c => (
                <button key={c} className={`chip ${category === c ? 'on' : ''}`} onClick={() => { setCategory(c); setPartnerId(''); resetDraft() }}>{c}</button>
              ))}
            </div>
            {partnersInCat.length === 0 ? (
              <div className="hint">
                Ingen partnere i «{category}» ennå.{isConcierge ? <> Legg dem inn under <Link href="/admin/partnere">Admin → Partnere</Link>.</> : ' Be concierge legge dem inn.'}
              </div>
            ) : (
              <div className="partners">
                {partnersInCat.map(p => (
                  <button key={p.id} className={`partner ${partnerId === p.id ? 'on' : ''}`} onClick={() => { setPartnerId(p.id); resetDraft() }}>
                    <PartnerImage src={p.image_url} name={p.name} />
                    <span className="p-name">{p.name}</span>
                    <span className="p-meta">{[p.address, p.booking_url ? 'online booking' : null, p.email ? 'e-post' : null].filter(Boolean).join(' · ') || ' '}</span>
                  </button>
                ))}
              </div>
            )}
            {partner?.description && <div className="desc">{partner.description}</div>}
            {partner?.notes && <div className="note">💡 {partner.notes}</div>}
          </section>

          {/* 3. Detaljer */}
          <section className="step">
            <div className="step-label"><span>3</span>Detaljer</div>
            <div className="grid">
              <label><span>Dato</span><input type="date" className="field" value={date} onChange={e => { setDate(e.target.value); resetDraft() }} /></label>
              {needsTime && <label><span>{category === 'Taxi' || category === 'Transport' ? 'Hentetid' : 'Tid'}</span><input type="time" className="field" value={time} onChange={e => { setTime(e.target.value); resetDraft() }} /></label>}
              <label><span>Personer</span><input type="number" min={1} max={500} className="field" value={persons} onChange={e => { setPersons(e.target.value); resetDraft() }} /></label>
            </div>
            <label className="full"><span>{category === 'Taxi' || category === 'Transport' ? 'Destinasjon og ønsker' : 'Ønsker'}</span>
              <textarea className="field" rows={2} value={wishes} onChange={e => { setWishes(e.target.value); resetDraft() }}
                placeholder={category === 'Taxi' ? 'F.eks. til Gardermoen, 3 kofferter, trenger barnesete' : 'F.eks. vindusbord, bryllupsdag, nøtteallergi'} />
            </label>
          </section>

          {/* 4. Send */}
          <section className="step">
            <div className="step-label"><span>4</span>Send</div>
            {!body ? (
              <div className="send-row">
                <button className="btn primary" onClick={makeDraft} disabled={drafting || !guest || !partner}>
                  {drafting ? 'Skriver …' : 'Lag e-post'}
                </button>
                {partner?.booking_url && <button className="btn" onClick={openBooking}>Gå til booking ↗</button>}
                {partner?.phone && <a className="btn" href={`tel:${partner.phone.replace(/\s/g, '')}`}>Ring {partner.phone}</a>}
              </div>
            ) : (
              <>
                <input className="field subject" value={subject} onChange={e => setSubject(e.target.value)} aria-label="Emne" />
                <textarea className="field mail" rows={10} value={body} onChange={e => setBody(e.target.value)} aria-label="E-posttekst" />
                <div className="send-row">
                  {partner?.email
                    ? <button className="btn primary" onClick={openMail}>Åpne i e-post</button>
                    : <span className="hint inline">Partneren mangler e-post</span>}
                  {partner?.booking_url && <button className="btn" onClick={openBooking}>Gå til booking ↗</button>}
                  {partner?.phone && <a className="btn" href={`tel:${partner.phone.replace(/\s/g, '')}`}>Ring</a>}
                  <button className="btn" onClick={copyText}>Kopier</button>
                  <button className="btn" onClick={makeDraft} disabled={drafting}>{drafting ? 'Skriver …' : 'Nytt utkast'}</button>
                  <button className="btn" onClick={async () => { if (await save('confirmed')) flash(true, 'Lagret som bekreftet') }}>Lagre som bekreftet</button>
                </div>
              </>
            )}
            {message && <div className={`msg ${message.ok ? 'ok' : 'err'}`} role="status">{message.text}</div>}
          </section>
        </main>

        {/* Liste */}
        <aside className="list-col">
          <div className="list-tabs">
            <button className={listView === 'upcoming' ? 'on' : ''} onClick={() => setListView('upcoming')}>Kommende</button>
            <button className={listView === 'past' ? 'on' : ''} onClick={() => setListView('past')}>Tidligere</button>
          </div>
          <div className="list">
            {grouped.length === 0 && <div className="r-empty">{listView === 'upcoming' ? 'Ingen kommende bestillinger.' : 'Ingen tidligere bestillinger.'}</div>}
            {grouped.map(([d, items]) => (
              <div key={d} className="day">
                <div className="day-label">{dayLabel(d || null)}</div>
                {items.map(b => (
                  <div key={b.id} className={`bcard ${b.status}`}>
                    <div className="b-top">
                      <span className="b-time">{b.booking_time ?? '–'}</span>
                      <span className="b-partner">{b.partner_name ?? 'Ukjent'}</span>
                    </div>
                    <div className="b-guest">{b.guest_name}{b.room ? ` · rom ${b.room}` : ''}{b.persons ? ` · ${b.persons} pers.` : ''}</div>
                    {b.wishes && <div className="b-wish">{b.wishes}</div>}
                    <div className="b-bottom">
                      <select value={b.status} onChange={e => setStatus(b.id, e.target.value as Booking['status'])} className={`status ${b.status}`} aria-label="Status">
                        {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                      {b.created_by && <span className="b-by">{b.created_by}</span>}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </aside>
      </div>

      <style>{`
        .bk { min-height: 100dvh; display: flex; flex-direction: column; background: ${colors.bg}; color: ${colors.text}; }
        .top { height: 60px; flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 0 20px; background: ${colors.surface}; border-bottom: 1px solid ${colors.border}; }
        .brand { display: flex; align-items: center; gap: 12px; }
        .wordmark { height: 14px; width: auto; display: block; }
        .hotel-tag { font-size: 12px; font-weight: 600; color: ${colors.accentHover}; background: ${colors.accentSoft}; padding: 4px 10px; border-radius: 999px; }
        .nav { display: flex; gap: 4px; align-items: center; }
        .nav-btn { font-size: 13px; font-weight: 600; color: ${colors.text}; background: none; border: none; padding: 8px 10px; border-radius: 8px; cursor: pointer; text-decoration: none; white-space: nowrap; }
        .nav-btn:hover { background: ${colors.surfaceHover}; color: ${colors.ink}; }
        .nav-btn.active { color: ${colors.accent}; cursor: default; background: none; }

        .layout { flex: 1; display: grid; grid-template-columns: minmax(0, 1fr) 380px; min-height: 0; }
        .form-col { padding: 28px 32px 48px; max-width: 760px; width: 100%; margin: 0 auto; box-sizing: border-box; }
        .head-row { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 20px; }
        h1 { margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -.03em; color: ${colors.ink}; }

        .step { background: ${colors.surface}; border: 1px solid ${colors.border}; border-radius: 14px; padding: 16px 18px; margin-bottom: 12px; }
        .step-label { display: flex; align-items: center; gap: 10px; font-size: 13px; font-weight: 700; color: ${colors.ink}; margin-bottom: 12px; }
        .step-label span { width: 22px; height: 22px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; background: ${colors.accentSoft}; color: ${colors.accentHover}; font-size: 12px; }

        .field { width: 100%; box-sizing: border-box; padding: 10px 12px; font-size: 14px; color: ${colors.ink}; background: ${colors.bg}; border: 1px solid ${colors.border}; border-radius: 10px; outline: none; font-family: inherit; }
        .field:focus { border-color: ${colors.accent}; }
        .field::placeholder { color: ${colors.muted}; }
        input[type="date"].field, input[type="time"].field { color-scheme: dark; }
        .row2 { display: flex; gap: 8px; }

        .search { position: relative; }
        .results { margin-top: 6px; border: 1px solid ${colors.border}; border-radius: 10px; background: ${colors.bg}; max-height: 300px; overflow-y: auto; }
        .r-item { display: flex; flex-direction: column; gap: 2px; width: 100%; text-align: left; padding: 10px 12px; background: none; border: none; border-bottom: 1px solid ${colors.border}; cursor: pointer; color: inherit; }
        .r-item:last-child { border-bottom: none; }
        .r-item:hover { background: ${colors.surfaceHover}; }
        .r-name { font-size: 14px; font-weight: 700; color: ${colors.ink}; display: flex; gap: 8px; align-items: center; }
        .r-name em { font-style: normal; font-size: 10px; font-weight: 700; padding: 1px 7px; border-radius: 999px; background: ${colors.accentSoft}; color: ${colors.accentHover}; }
        .r-meta { font-size: 12px; color: ${colors.muted}; }
        .r-empty { padding: 14px 12px; font-size: 13px; color: ${colors.muted}; }

        .guest-chip { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 10px; background: ${colors.bg}; border: 1px solid ${colors.accent}; }
        .g-name { font-size: 15px; font-weight: 700; color: ${colors.ink}; }
        .g-meta { font-size: 12px; color: ${colors.muted}; margin-top: 2px; }

        .link-btn { background: none; border: none; color: ${colors.accentHover}; font-size: 13px; font-weight: 600; cursor: pointer; padding: 4px 0; }
        .link-btn.small { font-size: 12px; margin-top: 8px; color: ${colors.muted}; }
        .link-btn:hover { color: ${colors.accent}; }

        .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
        .chip { font-size: 13px; font-weight: 600; padding: 6px 12px; border-radius: 999px; border: 1px solid ${colors.border}; background: ${colors.bg}; color: ${colors.text}; cursor: pointer; }
        .chip.on { background: ${colors.accent}; border-color: ${colors.accent}; color: ${colors.accentText}; }
        .partners { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px; }
        .p-img { height: 84px; margin: -10px -12px 8px; border-radius: 9px 9px 0 0; overflow: hidden; background: ${colors.surface}; display: flex; align-items: center; justify-content: center; }
        .p-img img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .p-img span { font-size: 22px; font-weight: 800; color: ${colors.accent}; letter-spacing: .04em; }
        .desc { margin-top: 10px; font-size: 13px; line-height: 1.55; color: ${colors.text}; }
        .partner { display: flex; flex-direction: column; gap: 3px; text-align: left; padding: 10px 12px; overflow: hidden; border-radius: 10px; border: 1px solid ${colors.border}; background: ${colors.bg}; cursor: pointer; color: inherit; }
        .partner:hover { border-color: ${colors.borderStrong}; }
        .partner.on { border-color: ${colors.accent}; box-shadow: inset 0 0 0 1px ${colors.accent}; }
        .p-name { font-size: 14px; font-weight: 700; color: ${colors.ink}; }
        .p-meta { font-size: 12px; color: ${colors.muted}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .note { margin-top: 10px; font-size: 13px; line-height: 1.5; padding: 8px 12px; border-radius: 8px; background: ${colors.accentSoft}; color: ${colors.text}; }
        .hint { font-size: 13px; color: ${colors.muted}; }
        .hint a { color: ${colors.accentHover}; }
        .hint.inline { align-self: center; }

        .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-bottom: 10px; }
        .grid label, .full { display: flex; flex-direction: column; gap: 6px; }
        .grid label span, .full span { font-size: 12px; font-weight: 600; color: ${colors.muted}; }

        .send-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
        .step .send-row:first-child { margin-top: 0; }
        .btn { display: inline-flex; align-items: center; font-size: 13px; font-weight: 700; padding: 9px 14px; border-radius: 10px; border: 1px solid ${colors.border}; background: ${colors.bg}; color: ${colors.text}; cursor: pointer; text-decoration: none; white-space: nowrap; font-family: inherit; }
        .btn:hover:not(:disabled) { border-color: ${colors.accent}; color: ${colors.accent}; }
        .btn.primary { background: ${colors.accent}; border-color: ${colors.accent}; color: ${colors.accentText}; }
        .btn.primary:hover:not(:disabled) { background: ${colors.accentHover}; color: ${colors.accentText}; }
        .btn:disabled { opacity: .4; cursor: not-allowed; }
        .subject { font-weight: 700; margin-bottom: 8px; }
        .mail { line-height: 1.6; resize: vertical; }
        .msg { margin-top: 10px; font-size: 13px; font-weight: 600; }
        .msg.ok { color: #8FD1A8; }
        .msg.err { color: ${colors.danger}; }

        .list-col { border-left: 1px solid ${colors.border}; background: ${colors.surface}; display: flex; flex-direction: column; min-height: 0; max-height: calc(100dvh - 60px); position: sticky; top: 0; }
        .list-tabs { display: flex; gap: 4px; padding: 14px 16px 0; border-bottom: 1px solid ${colors.border}; }
        .list-tabs button { padding: 8px 6px 10px; margin-bottom: -1px; background: none; border: none; border-bottom: 2px solid transparent; font-size: 13px; font-weight: 600; color: ${colors.muted}; cursor: pointer; }
        .list-tabs button.on { color: ${colors.ink}; border-bottom-color: ${colors.accent}; }
        .list { flex: 1; overflow-y: auto; padding: 8px 12px 16px; }
        .day-label { font-size: 12px; font-weight: 700; color: ${colors.accent}; margin: 14px 4px 6px; }
        .day-label::first-letter { text-transform: uppercase; }
        .bcard { background: ${colors.bg}; border: 1px solid ${colors.border}; border-radius: 12px; padding: 10px 12px; margin-bottom: 6px; }
        .bcard.cancelled { opacity: .5; }
        .b-top { display: flex; gap: 10px; align-items: baseline; }
        .b-time { font-size: 13px; font-weight: 800; color: ${colors.accentHover}; font-variant-numeric: tabular-nums; }
        .b-partner { font-size: 14px; font-weight: 700; color: ${colors.ink}; }
        .b-guest { font-size: 12px; color: ${colors.text}; margin-top: 3px; }
        .b-wish { font-size: 12px; color: ${colors.muted}; margin-top: 3px; }
        .b-bottom { display: flex; justify-content: space-between; align-items: center; margin-top: 8px; }
        .b-by { font-size: 11px; color: ${colors.muted}; }
        .status { font-size: 12px; font-weight: 700; padding: 3px 8px; border-radius: 999px; border: 1px solid ${colors.border}; background: ${colors.surface}; color: ${colors.text}; cursor: pointer; font-family: inherit; color-scheme: dark; }
        .status.sent { color: ${colors.accentHover}; border-color: rgba(193,122,58,.4); }
        .status.confirmed { color: #8FD1A8; border-color: rgba(143,209,168,.4); }
        .status.cancelled { color: ${colors.muted}; }

        @media (max-width: 980px) {
          .layout { grid-template-columns: 1fr; }
          .list-col { border-left: none; border-top: 1px solid ${colors.border}; max-height: none; position: static; }
          .form-col { padding: 20px 16px 24px; }
        }
        @media (max-width: 560px) {
          .top { padding: 0 12px; }
          .hide-sm { display: none; }
          .grid { grid-template-columns: 1fr 1fr; }
        }
      `}</style>
    </div>
  )
}
