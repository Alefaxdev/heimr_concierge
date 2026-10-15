// Mews Connector API – kun server.
// Tokenene hentes fra Azure Key Vault (heimr.vault.azure.net), samme som Fabric-notebookene.
// Navn på hemmelighetene (kan overstyres med miljøvariabler):
//   MEWS_CLIENT_TOKEN_SECRET   (standard «mews-client-token»)   – klient-token for «Heimr Private Integration»
//   MEWS_ACCESS_TOKEN_SECRET   (standard «mews-access-token»)   – portefølje-token, filtreres med enterprise-ID
//   mews-access-token-<hotell>                                  – valgfritt eget token per hotell, f.eks. mews-access-token-opus
// Miljøvariablene MEWS_CLIENT_TOKEN / MEWS_ACCESS_TOKEN / MEWS_ACCESS_TOKEN_<HOTELL> går foran Key Vault.
//   MEWS_PLATFORM_URL – valgfritt, standard https://api.mews.com
import { getSecret } from './secrets'

const PLATFORM = (process.env.MEWS_PLATFORM_URL || 'https://api.mews.com').replace(/\/$/, '')
const CLIENT = 'HEIMR Concierge 1.0'
const CACHE_MS = 3 * 60 * 1000
const RESOURCE_CACHE_MS = 60 * 60 * 1000

/** Klassifiseringer i Mews som regnes som VIP */
export const VIP_CLASSIFICATIONS = ['VeryImportant', 'Important', 'TopManagement', 'Media'] as const

/** Norske etiketter for klassifiseringer vi viser */
export const CLASSIFICATION_LABELS: Record<string, string> = {
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

export type Guest = {
  reservationId: string
  number: string
  name: string
  room: string | null
  arrival: string     // ISO
  departure: string   // ISO
  state: string       // Confirmed | Started | ...
  persons: number
  classifications: string[]
  notes: string | null
  loyaltyCode: string | null
}

export type GuestOverview = {
  arrivals: Guest[]       // VIP som ankommer i dag
  inHouse: Guest[]        // VIP som bor her nå (innsjekket)
  totalArrivals: number   // alle ankomster i dag
  totalInHouse: number    // alle innsjekkede
  fetchedAt: string
}

type MewsReservation = {
  Id: string
  Number: string
  State: string
  ScheduledStartUtc: string
  ActualStartUtc?: string | null
  ScheduledEndUtc: string
  AccountId: string
  AccountType: string
  AssignedResourceId?: string | null
  PersonCounts?: { Count: number }[]
}

type MewsCustomer = {
  Id: string
  FirstName?: string | null
  LastName?: string | null
  Classifications?: string[] | null
  Notes?: string | null
  LoyaltyCode?: string | null
}

type Tokens = { client: string; access: string; ownHotelToken: boolean }

const CLIENT_SECRET_NAME = process.env.MEWS_CLIENT_TOKEN_SECRET || 'mews-client-token'
const ACCESS_SECRET_NAME = process.env.MEWS_ACCESS_TOKEN_SECRET || 'mews-access-token'

/** Finn tokens for et hotell: miljøvariabel først, deretter Key Vault. */
async function tokens(hotelId: string): Promise<Tokens | null> {
  const H = hotelId.toUpperCase()
  const client = process.env.MEWS_CLIENT_TOKEN || (await getSecret(CLIENT_SECRET_NAME))
  if (!client) return null

  const ownEnv = process.env[`MEWS_ACCESS_TOKEN_${H}`]
  if (ownEnv) return { client, access: ownEnv, ownHotelToken: true }
  if (process.env.MEWS_ACCESS_TOKEN) return { client, access: process.env.MEWS_ACCESS_TOKEN, ownHotelToken: false }

  const ownVault = await getSecret(`${ACCESS_SECRET_NAME}-${hotelId.toLowerCase()}`)
  if (ownVault) return { client, access: ownVault, ownHotelToken: true }
  const shared = await getSecret(ACCESS_SECRET_NAME)
  return shared ? { client, access: shared, ownHotelToken: false } : null
}

export async function mewsConfigured(hotelId: string): Promise<boolean> {
  return !!(await tokens(hotelId))
}

async function call<T>(hotelId: string, path: string, body: Record<string, unknown>): Promise<T> {
  const t = await tokens(hotelId)
  if (!t) throw new Error('Fant ikke Mews-tokens (verken i miljøvariabler eller Key Vault)')
  const res = await fetch(`${PLATFORM}/api/connector/v1/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ClientToken: t.client,
      AccessToken: t.access,
      Client: CLIENT,
      ...body,
    }),
    cache: 'no-store',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Mews ${path}: ${res.status} ${err.Message ?? ''}`.trim())
  }
  return res.json() as Promise<T>
}

/** Henter alle sider for en getAll-operasjon */
async function getAllPages<T>(hotelId: string, path: string, key: string, body: Record<string, unknown>, max = 5000): Promise<T[]> {
  const out: T[] = []
  let cursor: string | undefined
  do {
    const data = await call<Record<string, unknown>>(hotelId, path, { ...body, Limitation: { Count: 1000, ...(cursor ? { Cursor: cursor } : {}) } })
    const items = (data[key] as T[]) ?? []
    out.push(...items)
    cursor = items.length === 1000 ? (data.Cursor as string | undefined) : undefined
  } while (cursor && out.length < max)
  return out
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/** Midnatt i Oslo for gitt dag, som UTC-dato */
function osloMidnightUtc(d: Date): Date {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Oslo', year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(d).map(p => [p.type, p.value]),
  )
  const guess = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day))
  // Finn Oslo-offset ved dette tidspunktet
  const tz = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Oslo', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      .formatToParts(new Date(guess)).map(p => [p.type, p.value]),
  )
  const tzAsUtc = Date.UTC(Number(tz.year), Number(tz.month) - 1, Number(tz.day), Number(tz.hour), Number(tz.minute))
  return new Date(guess - (tzAsUtc - guess))
}

// Enkel minne-cache per hotell
const cache = new Map<string, { at: number; data: GuestOverview }>()
const resourceCache = new Map<string, { at: number; name: string }>()

async function resourceNames(hotelId: string, ids: string[]): Promise<Map<string, string>> {
  const now = Date.now()
  const result = new Map<string, string>()
  const missing: string[] = []
  for (const id of ids) {
    const c = resourceCache.get(id)
    if (c && now - c.at < RESOURCE_CACHE_MS) result.set(id, c.name)
    else missing.push(id)
  }
  for (const part of chunk(missing, 1000)) {
    const data = await call<{ Resources: { Id: string; Name: string }[] }>(hotelId, 'resources/getAll', {
      ResourceIds: part,
      Extent: { Resources: true },
      Limitation: { Count: 1000 },
    })
    for (const r of data.Resources ?? []) {
      resourceCache.set(r.Id, { at: now, name: r.Name })
      result.set(r.Id, r.Name)
    }
  }
  return result
}

async function customersById(hotelId: string, ids: string[]): Promise<Map<string, MewsCustomer>> {
  const map = new Map<string, MewsCustomer>()
  for (const part of chunk(ids, 1000)) {
    const data = await call<{ Customers: MewsCustomer[] }>(hotelId, 'customers/getAll', {
      CustomerIds: part,
      Extent: { Customers: true, Addresses: false },
      Limitation: { Count: 1000 },
    })
    for (const c of data.Customers ?? []) map.set(c.Id, c)
  }
  return map
}

export async function getGuestOverview(hotelId: string, enterpriseId: string | null, opts: { fresh?: boolean } = {}): Promise<GuestOverview> {
  const cached = cache.get(hotelId)
  if (!opts.fresh && cached && Date.now() - cached.at < CACHE_MS) return cached.data

  const t = await tokens(hotelId)
  if (!t) throw new Error('Fant ikke Mews-tokens (verken i miljøvariabler eller Key Vault)')
  if (!t.ownHotelToken && !enterpriseId) {
    throw new Error('Mangler Mews enterprise-ID for hotellet (settes under Admin → Oppsett)')
  }
  const scope = enterpriseId ? { EnterpriseIds: [enterpriseId] } : {}

  const now = new Date()
  const todayStart = osloMidnightUtc(now)
  const tomorrowStart = osloMidnightUtc(new Date(todayStart.getTime() + 36 * 3600 * 1000))

  const [arrivalsAll, inHouseAll] = await Promise.all([
    getAllPages<MewsReservation>(hotelId, 'reservations/getAll/2023-06-06', 'Reservations', {
      ...scope,
      ScheduledStartUtc: { StartUtc: todayStart.toISOString(), EndUtc: tomorrowStart.toISOString() },
      States: ['Confirmed', 'Started'],
    }),
    getAllPages<MewsReservation>(hotelId, 'reservations/getAll/2023-06-06', 'Reservations', {
      ...scope,
      CollidingUtc: { StartUtc: now.toISOString(), EndUtc: new Date(now.getTime() + 60_000).toISOString() },
      States: ['Started'],
    }),
  ])

  const customerIds = [...new Set([...arrivalsAll, ...inHouseAll].filter(r => r.AccountType === 'Customer').map(r => r.AccountId))]
  const customers = await customersById(hotelId, customerIds)

  const isVip = (r: MewsReservation) => {
    const cls = customers.get(r.AccountId)?.Classifications ?? []
    return cls.some(c => (VIP_CLASSIFICATIONS as readonly string[]).includes(c))
  }

  const arrivalsVip = arrivalsAll.filter(isVip)
  const inHouseVip = inHouseAll.filter(r => isVip(r) && !arrivalsVip.some(a => a.Id === r.Id))
  const roomIds = [...new Set([...arrivalsVip, ...inHouseVip].map(r => r.AssignedResourceId).filter((x): x is string => !!x))]
  const rooms = await resourceNames(hotelId, roomIds)

  const toGuest = (r: MewsReservation): Guest => {
    const c = customers.get(r.AccountId)
    const name = [c?.FirstName, c?.LastName].filter(Boolean).join(' ').trim() || 'Ukjent gjest'
    return {
      reservationId: r.Id,
      number: r.Number,
      name,
      room: r.AssignedResourceId ? rooms.get(r.AssignedResourceId) ?? null : null,
      arrival: r.ActualStartUtc || r.ScheduledStartUtc,
      departure: r.ScheduledEndUtc,
      state: r.State,
      persons: (r.PersonCounts ?? []).reduce((s, p) => s + (p.Count ?? 0), 0),
      classifications: (c?.Classifications ?? []).filter(x => x in CLASSIFICATION_LABELS),
      notes: c?.Notes?.trim() || null,
      loyaltyCode: c?.LoyaltyCode || null,
    }
  }

  const rank = (g: Guest) => (g.classifications.includes('VeryImportant') ? 0 : g.classifications.includes('TopManagement') ? 1 : 2)
  const data: GuestOverview = {
    arrivals: arrivalsVip.map(toGuest).sort((a, b) => rank(a) - rank(b) || a.arrival.localeCompare(b.arrival)),
    inHouse: inHouseVip.map(toGuest).sort((a, b) => rank(a) - rank(b) || a.departure.localeCompare(b.departure)),
    totalArrivals: arrivalsAll.length,
    totalInHouse: inHouseAll.length,
    fetchedAt: now.toISOString(),
  }
  cache.set(hotelId, { at: Date.now(), data })
  return data
}

// ---------- Gjestesøk (alle gjester som bor her eller kommer de neste 3 ukene) ----------

const searchCache = new Map<string, { at: number; guests: Guest[] }>()

function buildGuest(r: MewsReservation, customers: Map<string, MewsCustomer>, rooms: Map<string, string>): Guest {
  const c = customers.get(r.AccountId)
  return {
    reservationId: r.Id,
    number: r.Number,
    name: [c?.FirstName, c?.LastName].filter(Boolean).join(' ').trim() || 'Ukjent gjest',
    room: r.AssignedResourceId ? rooms.get(r.AssignedResourceId) ?? null : null,
    arrival: r.ActualStartUtc || r.ScheduledStartUtc,
    departure: r.ScheduledEndUtc,
    state: r.State,
    persons: (r.PersonCounts ?? []).reduce((sum, p) => sum + (p.Count ?? 0), 0),
    classifications: (c?.Classifications ?? []).filter(x => x in CLASSIFICATION_LABELS),
    notes: c?.Notes?.trim() || null,
    loyaltyCode: c?.LoyaltyCode || null,
  }
}

async function upcomingGuests(hotelId: string, enterpriseId: string | null): Promise<Guest[]> {
  const hit = searchCache.get(hotelId)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.guests

  const t = await tokens(hotelId)
  if (!t) throw new Error('Fant ikke Mews-tokens (verken i miljøvariabler eller Key Vault)')
  if (!t.ownHotelToken && !enterpriseId) throw new Error('Mangler Mews enterprise-ID for hotellet (settes under Admin → Oppsett)')
  const scope = enterpriseId ? { EnterpriseIds: [enterpriseId] } : {}

  const todayStart = osloMidnightUtc(new Date())
  const from = new Date(todayStart.getTime() - 24 * 3600 * 1000)
  const to = new Date(todayStart.getTime() + 21 * 24 * 3600 * 1000)

  const reservations = await getAllPages<MewsReservation>(hotelId, 'reservations/getAll/2023-06-06', 'Reservations', {
    ...scope,
    CollidingUtc: { StartUtc: from.toISOString(), EndUtc: to.toISOString() },
    States: ['Confirmed', 'Started'],
  }, 10000)

  const personal = reservations.filter(r => r.AccountType === 'Customer')
  const customers = await customersById(hotelId, [...new Set(personal.map(r => r.AccountId))])
  const rooms = await resourceNames(hotelId, [...new Set(personal.map(r => r.AssignedResourceId).filter((x): x is string => !!x))])
  const guests = personal.map(r => buildGuest(r, customers, rooms))

  searchCache.set(hotelId, { at: Date.now(), guests })
  return guests
}

const normName = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim()

/** Søk på navn, romnummer eller reservasjonsnummer. Innsjekkede først, deretter etter ankomst. */
export async function searchGuests(hotelId: string, enterpriseId: string | null, query: string): Promise<Guest[]> {
  const q = normName(query)
  if (q.length < 2) return []
  const all = await upcomingGuests(hotelId, enterpriseId)
  const words = q.split(' ')
  return all
    .filter(g => {
      const name = normName(g.name)
      return words.every(w => name.includes(w)) || g.room === query.trim() || g.number === query.trim()
    })
    .sort((a, b) => (a.state === 'Started' ? 0 : 1) - (b.state === 'Started' ? 0 : 1) || a.arrival.localeCompare(b.arrival))
    .slice(0, 20)
}

/** Enterprises tilgjengelig for tokenet – brukes for å finne riktig ID per hotell. */
export async function listEnterprises(hotelId: string): Promise<{ id: string; name: string }[]> {
  try {
    const data = await call<{ Enterprises: { Id: string; Name: string }[] }>(hotelId, 'enterprises/getAll', {
      Limitation: { Count: 1000 },
    })
    return (data.Enterprises ?? []).map(e => ({ id: e.Id, name: e.Name }))
  } catch {
    // Enkelt-token: configuration/get gir det ene hotellet
    const data = await call<{ Enterprise: { Id: string; Name: string } }>(hotelId, 'configuration/get', {})
    return data.Enterprise ? [{ id: data.Enterprise.Id, name: data.Enterprise.Name }] : []
  }
}

/** Kort tekstversjon for assistenten */
export function guestsAsText(o: GuestOverview): string {
  const fmt = (iso: string) => new Intl.DateTimeFormat('nb-NO', { timeZone: 'Europe/Oslo', day: 'numeric', month: 'short' }).format(new Date(iso))
  const line = (g: Guest) => {
    const tags = g.classifications.map(c => CLASSIFICATION_LABELS[c] ?? c).join(', ')
    return `- ${g.name}${g.room ? `, rom ${g.room}` : ''} · ${fmt(g.arrival)}–${fmt(g.departure)} · ${g.persons || '?'} pers. · ${tags}${g.notes ? `\n  Notater i Mews: ${g.notes.replace(/\s+/g, ' ').slice(0, 400)}` : ''}`
  }
  return [
    `VIP-ankomster i dag (${o.arrivals.length} av ${o.totalArrivals} ankomster):`,
    o.arrivals.length ? o.arrivals.map(line).join('\n') : '(ingen)',
    '',
    `VIP i huset nå (${o.inHouse.length} av ${o.totalInHouse} innsjekkede):`,
    o.inHouse.length ? o.inHouse.map(line).join('\n') : '(ingen)',
  ].join('\n')
}
