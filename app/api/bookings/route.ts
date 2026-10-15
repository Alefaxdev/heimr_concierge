import { db, todayOslo } from '@/lib/db'
import { requireSession } from '@/lib/session'
import { cleanDate } from '@/lib/knowledge'

const FIELDS = 'id, partner_id, partner_name, category, guest_name, reservation_id, reservation_number, room, booking_date, booking_time, persons, wishes, status, email_subject, email_body, created_by, created_at, updated_at'
const STATUSES = ['draft', 'sent', 'confirmed', 'cancelled']

const str = (v: unknown, max = 500) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)
const time = (v: unknown) => (typeof v === 'string' && /^\d{2}:\d{2}$/.test(v) ? v : null)

// Kommende bestillinger (fra i går) – eller ?view=past for de siste 60 dagene
export async function GET(req: Request) {
  const session = await requireSession()
  if (session instanceof Response) return session
  const view = new URL(req.url).searchParams.get('view')

  const today = todayOslo()
  const yesterday = new Date(Date.parse(today) - 86400000).toISOString().slice(0, 10)
  let q = db.from('concierge_bookings').select(FIELDS).eq('hotel_id', session.hotel)
  if (view === 'past') {
    const from = new Date(Date.parse(today) - 60 * 86400000).toISOString().slice(0, 10)
    q = q.lt('booking_date', yesterday).gte('booking_date', from).order('booking_date', { ascending: false })
  } else {
    q = q.or(`booking_date.gte.${yesterday},booking_date.is.null`).order('booking_date', { ascending: true, nullsFirst: true }).order('booking_time')
  }
  const { data, error } = await q.limit(300)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ bookings: data ?? [] })
}

export async function POST(req: Request) {
  const session = await requireSession()
  if (session instanceof Response) return session
  const b = await req.json().catch(() => ({}))

  const guest = str(b.guest_name, 200)
  if (!guest) return Response.json({ error: 'Gjestens navn må fylles ut' }, { status: 400 })

  const { data, error } = await db.from('concierge_bookings').insert({
    hotel_id: session.hotel,
    partner_id: typeof b.partner_id === 'string' && b.partner_id ? b.partner_id : null,
    partner_name: str(b.partner_name, 200),
    category: str(b.category, 50),
    guest_name: guest,
    reservation_id: str(b.reservation_id, 100),
    reservation_number: str(b.reservation_number, 50),
    room: str(b.room, 20),
    booking_date: cleanDate(b.booking_date),
    booking_time: time(b.booking_time),
    persons: Number.isFinite(Number(b.persons)) && Number(b.persons) > 0 ? Math.min(Number(b.persons), 500) : null,
    wishes: str(b.wishes, 2000),
    status: STATUSES.includes(b.status) ? b.status : 'draft',
    email_subject: str(b.email_subject, 300),
    email_body: str(b.email_body, 10000),
    created_by: session.name,
  }).select('id').single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true, id: data.id })
}
