'use client'
import { useEffect, useState } from 'react'
import { colors } from '@/lib/theme'

type Guest = {
  reservationId: string
  number: string
  name: string
  room: string | null
  arrival: string
  departure: string
  state: string
  persons: number
  classifications: string[]
  notes: string | null
  loyaltyCode: string | null
}

type Data =
  | { configured: false; keyVaultError?: string | null }
  | { configured: true; error: string; needsSetup?: boolean }
  | { configured: true; arrivals: Guest[]; inHouse: Guest[]; totalArrivals: number; totalInHouse: number; fetchedAt: string }

const LABELS: Record<string, string> = {
  VeryImportant: 'VVIP',
  Important: 'VIP',
  TopManagement: 'Toppledelse',
  Media: 'Presse',
  Returning: 'Gjenganger',
  LoyaltyProgram: 'Lojalitet',
  PreviousComplaint: 'Tidligere klage',
  FriendOrFamily: 'Venn/familie',
  Staff: 'Ansatt',
  DisabledPerson: 'Tilrettelegging',
  Airline: 'Flyselskap',
}
const STRONG = new Set(['VeryImportant', 'Important', 'TopManagement', 'Media'])

function day(iso: string) {
  return new Intl.DateTimeFormat('nb-NO', { timeZone: 'Europe/Oslo', day: 'numeric', month: 'short' }).format(new Date(iso)).replace('.', '')
}
function time(iso: string) {
  return new Intl.DateTimeFormat('nb-NO', { timeZone: 'Europe/Oslo', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}
function bookHref(g: Guest) {
  const p = new URLSearchParams({ guest: g.reservationId, number: g.number, name: g.name, arrival: g.arrival, departure: g.departure })
  if (g.room) p.set('room', g.room)
  if (g.persons) p.set('persons', String(g.persons))
  return `/bestillinger?${p.toString()}`
}

function nights(a: string, b: string) {
  return Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000))
}

type Props = {
  open: boolean
  onClose: () => void
  onUse: (text: string) => void
  onCount?: (n: number) => void
}

export default function GuestPanel({ open, onClose, onUse, onCount }: Props) {
  const [data, setData] = useState<Data | null>(null)
  const [tab, setTab] = useState<'arrivals' | 'inHouse'>('arrivals')
  const [reloadKey, setReloadKey] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/guests${reloadKey ? '?fresh=1' : ''}`)
      .then(r => r.json())
      .catch(() => ({ configured: true, error: 'Fikk ikke kontakt med serveren' }))
      .then((d: Data) => {
        if (cancelled) return
        setData(d)
        setRefreshing(false)
        if (d.configured && 'arrivals' in d) onCount?.(d.arrivals.length + d.inHouse.length)
      })
    return () => { cancelled = true }
  }, [reloadKey, onCount])

  function refresh() {
    setRefreshing(true)
    setReloadKey(k => k + 1)
  }

  const ok = data && data.configured && 'arrivals' in data ? data : null
  const list = ok ? (tab === 'arrivals' ? ok.arrivals : ok.inHouse) : []

  function welcome(g: Guest) {
    const where = g.room ? ` på rom ${g.room}` : ''
    const stay = `${day(g.arrival)}–${day(g.departure)}`
    onUse(`Skriv en personlig velkomsthilsen til ${g.name}${where} (${stay}). ${g.notes ? 'Ta hensyn til notatene fra Mews. ' : ''}Forslag til en liten oppmerksomhet: `)
    onClose()
  }

  function ask(g: Guest) {
    onUse(`Hva bør vi vite og gjøre for ${g.name}${g.room ? ` (rom ${g.room})` : ''} under oppholdet?`)
    onClose()
  }

  return (
    <>
      {open && <div className="gp-backdrop" onClick={onClose} aria-hidden="true" />}
      <aside className={`gp ${open ? 'gp-open' : ''}`} aria-label="Dagens VIP-gjester">
        <div className="gp-head">
          <div>
            <div className="gp-eyebrow">Fra Mews</div>
            <h2>Dagens VIP-gjester</h2>
          </div>
          <div className="gp-head-actions">
            {ok && (
              <button onClick={refresh} className="gp-icon" aria-label="Oppdater" title="Oppdater" disabled={refreshing}>
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" className={refreshing ? 'spin' : undefined}>
                  <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2.5v3h-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}
            <button onClick={onClose} className="gp-icon gp-close" aria-label="Lukk">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
            </button>
          </div>
        </div>

        {!data ? (
          <div className="gp-state">
            {[0, 1, 2].map(i => <div key={i} className="gp-skeleton" />)}
          </div>
        ) : !data.configured ? (
          <div className="gp-state gp-msg">
            <strong>Ikke koblet til Mews ennå</strong>
            {data.keyVaultError ? (
              <p>Fikk ikke hentet tokens fra Key Vault: {data.keyVaultError}</p>
            ) : (
              <p>Legg inn <code>MEWS_CLIENT_TOKEN</code> og <code>MEWS_ACCESS_TOKEN</code> i <code>.env</code> og start appen på nytt.</p>
            )}
          </div>
        ) : 'error' in data ? (
          <div className="gp-state gp-msg">
            <strong>Fikk ikke hentet gjester</strong>
            <p>{data.error}</p>
            <div style={{ display: 'flex', gap: 6 }}>
              {data.needsSetup && <a href="/admin/stemme" className="gp-retry" style={{ textDecoration: 'none' }}>Velg hotell</a>}
              <button onClick={refresh} className="gp-retry">Prøv igjen</button>
            </div>
          </div>
        ) : (
          <>
            <div className="gp-tabs" role="tablist">
              <button role="tab" aria-selected={tab === 'arrivals'} onClick={() => setTab('arrivals')} className={tab === 'arrivals' ? 'on' : ''}>
                Ankommer i dag <span>{ok!.arrivals.length}</span>
              </button>
              <button role="tab" aria-selected={tab === 'inHouse'} onClick={() => setTab('inHouse')} className={tab === 'inHouse' ? 'on' : ''}>
                I huset <span>{ok!.inHouse.length}</span>
              </button>
            </div>
            <div className="gp-sub">
              {tab === 'arrivals'
                ? `${ok!.arrivals.length} VIP av ${ok!.totalArrivals} ankomster`
                : `${ok!.inHouse.length} VIP av ${ok!.totalInHouse} innsjekkede`}
            </div>

            <div className="gp-list">
              {list.length === 0 ? (
                <div className="gp-empty">{tab === 'arrivals' ? 'Ingen VIP-ankomster i dag.' : 'Ingen VIP-gjester i huset nå.'}</div>
              ) : list.map(g => (
                <article key={g.reservationId} className="gp-card">
                  <div className="gp-row">
                    <div className="gp-name">{g.name}</div>
                    <div className={`gp-room ${g.room ? '' : 'none'}`}>{g.room ? `Rom ${g.room}` : 'Uten rom'}</div>
                  </div>
                  <div className="gp-meta">
                    {day(g.arrival)}–{day(g.departure)} · {nights(g.arrival, g.departure)} {nights(g.arrival, g.departure) === 1 ? 'natt' : 'netter'}
                    {g.persons ? ` · ${g.persons} pers.` : ''}
                    {g.state === 'Started' && tab === 'arrivals' ? ` · innsjekket ${time(g.arrival)}` : ''}
                  </div>
                  {g.classifications.length > 0 && (
                    <div className="gp-tags">
                      {g.classifications.map(c => (
                        <span key={c} className={STRONG.has(c) ? 'strong' : ''}>{LABELS[c] ?? c}</span>
                      ))}
                    </div>
                  )}
                  {g.notes && <p className="gp-notes">{g.notes}</p>}
                  <div className="gp-actions">
                    <button onClick={() => welcome(g)}>Velkomsthilsen</button>
                    <a href={bookHref(g)} className="ghost">Bestill</a>
                    <button onClick={() => ask(g)} className="ghost">Hva bør vi vite?</button>
                  </div>
                </article>
              ))}
            </div>

            <div className="gp-foot">Oppdatert {time(ok!.fetchedAt)}</div>
          </>
        )}
      </aside>

      <style>{`
        .gp {
          width: 340px; flex-shrink: 0; display: flex; flex-direction: column; min-height: 0;
          background: ${colors.surface}; border-left: 1px solid ${colors.border};
        }
        .gp-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; padding: 20px 18px 12px; }
        .gp-eyebrow { font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: ${colors.accent}; margin-bottom: 4px; }
        .gp h2 { margin: 0; font-size: 17px; font-weight: 700; letter-spacing: -.01em; color: ${colors.ink}; }
        .gp-head-actions { display: flex; gap: 4px; }
        .gp-icon {
          width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center; border-radius: 8px;
          background: transparent; border: 1px solid ${colors.border}; color: ${colors.muted}; cursor: pointer;
        }
        .gp-icon:hover:not(:disabled) { color: ${colors.accent}; border-color: ${colors.accent}; }
        .gp-close { display: none; }
        .spin { animation: gp-spin .8s linear infinite; }
        @keyframes gp-spin { to { transform: rotate(360deg) } }

        .gp-tabs { display: flex; gap: 4px; padding: 0 18px; border-bottom: 1px solid ${colors.border}; }
        .gp-tabs button {
          display: inline-flex; align-items: center; gap: 6px; padding: 10px 6px 11px; margin-bottom: -1px; background: none; border: none;
          border-bottom: 2px solid transparent; font-size: 13px; font-weight: 600; color: ${colors.muted}; cursor: pointer;
        }
        .gp-tabs button.on { color: ${colors.ink}; border-bottom-color: ${colors.accent}; }
        .gp-tabs span {
          font-size: 11px; font-weight: 700; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px;
          display: inline-flex; align-items: center; justify-content: center; background: ${colors.border}; color: ${colors.text};
        }
        .gp-tabs button.on span { background: ${colors.accent}; color: ${colors.accentText}; }
        .gp-sub { padding: 10px 18px 4px; font-size: 12px; color: ${colors.muted}; }

        .gp-list { flex: 1; overflow-y: auto; padding: 8px 12px 12px; display: flex; flex-direction: column; gap: 8px; }
        .gp-card { background: ${colors.bg}; border: 1px solid ${colors.border}; border-radius: 12px; padding: 12px 14px; }
        .gp-row { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }
        .gp-name { font-size: 14px; font-weight: 700; color: ${colors.ink}; overflow-wrap: anywhere; }
        .gp-room { font-size: 12px; font-weight: 700; color: ${colors.accentHover}; white-space: nowrap; }
        .gp-room.none { color: ${colors.muted}; font-weight: 600; }
        .gp-meta { margin-top: 3px; font-size: 12px; color: ${colors.muted}; }
        .gp-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px; }
        .gp-tags span { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 999px; background: ${colors.border}; color: ${colors.text}; }
        .gp-tags span.strong { background: ${colors.accentSoft}; color: ${colors.accentHover}; }
        .gp-notes {
          margin: 8px 0 0; font-size: 12px; line-height: 1.5; color: ${colors.text}; opacity: .85;
          display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; white-space: pre-line;
        }
        .gp-actions { display: flex; gap: 6px; margin-top: 10px; }
        .gp-actions a.ghost { display: inline-flex; align-items: center; text-decoration: none; font-size: 12px; font-weight: 700; padding: 6px 10px; border-radius: 8px; background: transparent; color: ${colors.text}; border: 1px solid ${colors.border}; }
        .gp-actions a.ghost:hover { color: ${colors.accent}; border-color: ${colors.accent}; }
        .gp-actions { flex-wrap: wrap; }
        .gp-actions button {
          font-size: 12px; font-weight: 700; padding: 6px 10px; border-radius: 8px; cursor: pointer;
          background: ${colors.accent}; color: ${colors.accentText}; border: 1px solid ${colors.accent};
        }
        .gp-actions button:hover { background: ${colors.accentHover}; border-color: ${colors.accentHover}; }
        .gp-actions button.ghost { background: transparent; color: ${colors.text}; border-color: ${colors.border}; }
        .gp-actions button.ghost:hover { color: ${colors.accent}; border-color: ${colors.accent}; }

        .gp-state { padding: 12px 18px; display: flex; flex-direction: column; gap: 8px; }
        .gp-skeleton { height: 92px; border-radius: 12px; background: ${colors.bg}; border: 1px solid ${colors.border}; animation: gp-pulse 1.4s ease-in-out infinite; }
        @keyframes gp-pulse { 50% { opacity: .5 } }
        .gp-msg strong { font-size: 14px; color: ${colors.ink}; }
        .gp-msg p { margin: 0; font-size: 13px; line-height: 1.6; color: ${colors.muted}; overflow-wrap: anywhere; }
        .gp-msg code { font-size: 12px; color: ${colors.accentHover}; }
        .gp-retry { align-self: flex-start; font-size: 12px; font-weight: 700; padding: 6px 12px; border-radius: 8px; background: ${colors.accent}; color: ${colors.accentText}; border: none; cursor: pointer; }
        .gp-empty { padding: 24px 6px; text-align: center; font-size: 13px; color: ${colors.muted}; }
        .gp-foot { padding: 10px 18px 14px; font-size: 11px; color: ${colors.muted}; border-top: 1px solid ${colors.border}; }
        .gp-backdrop { display: none; }

        @media (max-width: 1099px) {
          .gp {
            position: fixed; top: 0; right: 0; bottom: 0; z-index: 40; width: min(380px, 92vw);
            transform: translateX(100%); transition: transform .22s ease; box-shadow: -12px 0 40px rgba(0,0,0,.35);
          }
          .gp-open { transform: translateX(0); }
          .gp-close { display: inline-flex; }
          .gp-backdrop { display: block; position: fixed; inset: 0; z-index: 39; background: rgba(0,0,0,.45); }
        }
      `}</style>
    </>
  )
}
