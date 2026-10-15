import { db } from '@/lib/db'
import { requireSession } from '@/lib/session'
import { cleanDate } from '@/lib/knowledge'

// Concierge kan bare endre/slette eget hotells kunnskap og felles HEIMR-kunnskap
function scope(hotel: string) {
  return `hotel_id.eq.${hotel},hotel_id.is.null`
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession('concierge')
  if (session instanceof Response) return session
  const { id } = await params
  const body = await req.json().catch(() => ({}))

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body.title === 'string' && body.title.trim()) update.title = body.title.trim()
  if (typeof body.content === 'string' && body.content.trim()) update.content = body.content.trim()
  if ('valid_until' in body) update.valid_until = cleanDate(body.valid_until)
  if ('shared' in body) update.hotel_id = body.shared === true ? null : session.hotel

  const { error } = await db.from('knowledge_base').update(update).eq('id', id).or(scope(session.hotel))
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession('concierge')
  if (session instanceof Response) return session
  const { id } = await params

  const { error } = await db.from('knowledge_base').delete().eq('id', id).or(scope(session.hotel))
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
