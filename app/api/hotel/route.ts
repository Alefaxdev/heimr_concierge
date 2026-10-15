import { db } from '@/lib/db'
import { requireSession } from '@/lib/session'
import { getHotel } from '@/lib/knowledge'

// GET: alle innloggede (chat-header). PUT: kun concierge (stemme-innstillinger).
export async function GET() {
  const session = await requireSession()
  if (session instanceof Response) return session
  const hotel = await getHotel(session.hotel)
  if (!hotel) return Response.json({ error: 'Fant ikke hotellet' }, { status: 404 })

  const { count } = session.role === 'concierge'
    ? await db.from('concierge_questions').select('id', { count: 'exact', head: true }).eq('hotel_id', session.hotel).eq('status', 'open')
    : { count: null }

  return Response.json({
    hotel: session.role === 'concierge' ? hotel : { id: hotel.id, name: hotel.name, concierge_name: hotel.concierge_name },
    user: { name: session.name, role: session.role },
    openQuestions: count ?? 0,
  })
}

export async function PUT(req: Request) {
  const session = await requireSession('concierge')
  if (session instanceof Response) return session
  const body = await req.json().catch(() => ({}))

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const k of ['concierge_name', 'voice_guide', 'voice_examples', 'mews_enterprise_id'] as const) {
    if (typeof body[k] === 'string') update[k] = body[k].trim() || null
  }

  const { error } = await db.from('concierge_hotels').update(update).eq('id', session.hotel)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
