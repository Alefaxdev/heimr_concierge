import { db } from '@/lib/db'
import { requireSession } from '@/lib/session'
import { cleanDate } from '@/lib/knowledge'

const STATUSES = ['draft', 'sent', 'confirmed', 'cancelled']

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession()
  if (session instanceof Response) return session
  const { id } = await params
  const b = await req.json().catch(() => ({}))

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (STATUSES.includes(b.status)) update.status = b.status
  if ('booking_date' in b) update.booking_date = cleanDate(b.booking_date)
  if (typeof b.booking_time === 'string') update.booking_time = /^\d{2}:\d{2}$/.test(b.booking_time) ? b.booking_time : null
  if ('persons' in b) update.persons = Number(b.persons) > 0 ? Math.min(Number(b.persons), 500) : null
  for (const k of ['wishes', 'email_subject', 'email_body'] as const) {
    if (typeof b[k] === 'string') update[k] = b[k].trim() || null
  }

  const { error } = await db.from('concierge_bookings').update(update).eq('id', id).eq('hotel_id', session.hotel)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession('concierge')
  if (session instanceof Response) return session
  const { id } = await params
  const { error } = await db.from('concierge_bookings').delete().eq('id', id).eq('hotel_id', session.hotel)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
