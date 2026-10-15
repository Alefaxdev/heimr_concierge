import { db } from '@/lib/db'
import { requireSession } from '@/lib/session'
import { cleanPartner } from '@/lib/partners'

const scope = (hotel: string) => `hotel_id.eq.${hotel},hotel_id.is.null`

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession('concierge')
  if (session instanceof Response) return session
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const p = cleanPartner(body)
  if (!p.name) return Response.json({ error: 'Navn må fylles ut' }, { status: 400 })

  const { error } = await db.from('concierge_partners')
    .update({ ...p, hotel_id: body.shared === true ? null : session.hotel, updated_at: new Date().toISOString() })
    .eq('id', id).or(scope(session.hotel))
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession('concierge')
  if (session instanceof Response) return session
  const { id } = await params
  const { error } = await db.from('concierge_partners').delete().eq('id', id).or(scope(session.hotel))
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
