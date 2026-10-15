import { db } from '@/lib/db'
import { requireSession } from '@/lib/session'
import { cleanDate, getKnowledgeForHotel } from '@/lib/knowledge'

export async function GET() {
  const session = await requireSession('concierge')
  if (session instanceof Response) return session
  const entries = await getKnowledgeForHotel(session.hotel, { includeExpired: true })
  return Response.json({ entries: entries.sort((a, b) => b.created_at.localeCompare(a.created_at)) })
}

export async function POST(req: Request) {
  const session = await requireSession('concierge')
  if (session instanceof Response) return session

  const { title, content, category, folder, shared, valid_until } = await req.json().catch(() => ({}))
  if (typeof title !== 'string' || typeof content !== 'string' || !title.trim() || !content.trim()) {
    return Response.json({ error: 'Tittel og innhold må fylles ut' }, { status: 400 })
  }

  const { data, error } = await db.from('knowledge_base').insert({
    title: title.trim(),
    content: content.trim(),
    category: typeof category === 'string' && category.trim() ? category.trim() : null,
    folder: typeof folder === 'string' && folder.trim() ? folder.trim() : null,
    hotel_id: shared === true ? null : session.hotel,
    valid_until: cleanDate(valid_until),
  }).select('id').single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true, id: data.id })
}
