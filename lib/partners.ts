import { db } from './db'

export const PARTNER_CATEGORIES = ['Restaurant', 'Taxi', 'Transport', 'Opplevelse', 'Spa', 'Annet'] as const

export type Partner = {
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

export const PARTNER_FIELDS = 'id, hotel_id, name, category, email, phone, booking_url, address, contact_name, notes, active'

/** Partnere for hotellet: egne + felles HEIMR. */
export async function getPartners(hotelId: string, opts: { includeInactive?: boolean } = {}): Promise<Partner[]> {
  let q = db.from('concierge_partners').select(PARTNER_FIELDS).or(`hotel_id.eq.${hotelId},hotel_id.is.null`)
  if (!opts.includeInactive) q = q.eq('active', true)
  const { data, error } = await q.order('category').order('name')
  if (error) throw new Error(error.message)
  return (data ?? []) as Partner[]
}

const str = (v: unknown, max = 500) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)

/** Rens felter fra et skjema. */
export function cleanPartner(body: Record<string, unknown>) {
  let url = str(body.booking_url, 1000)
  if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`
  return {
    name: str(body.name, 200),
    category: (PARTNER_CATEGORIES as readonly string[]).includes(body.category as string) ? (body.category as string) : 'Annet',
    email: str(body.email, 200),
    phone: str(body.phone, 50),
    booking_url: url,
    address: str(body.address, 300),
    contact_name: str(body.contact_name, 120),
    notes: str(body.notes, 2000),
    active: body.active === false ? false : true,
  }
}

export function partnersAsText(partners: Partner[], hotelName: string): string {
  if (!partners.length) return '## Partnere\n(Ingen partnere registrert ennå.)'
  const lines = partners.map(p => {
    const bits = [
      p.category,
      p.hotel_id ? hotelName : 'Felles HEIMR',
      p.address,
      p.phone && `tlf ${p.phone}`,
      p.email && `e-post ${p.email}`,
      p.booking_url && `booking ${p.booking_url}`,
      p.contact_name && `kontakt ${p.contact_name}`,
    ].filter(Boolean).join(' · ')
    return `- **${p.name}** (${bits})${p.notes ? `\n  ${p.notes.replace(/\s+/g, ' ')}` : ''}`
  })
  return `## Partnere (restauranter, taxi, opplevelser m.m. som concierge bruker)\nBestillinger gjøres på siden «Bestillinger» i appen.\n${lines.join('\n')}`
}
