import { db } from '@/lib/db'
import { requireSession } from '@/lib/session'
import { cleanDate } from '@/lib/knowledge'

export async function GET(req: Request) {
  const session = await requireSession('concierge')
  if (session instanceof Response) return session
  const status = new URL(req.url).searchParams.get('status') ?? 'open'

  let q = db.from('concierge_questions')
    .select('id, question, context, asked_by, status, answer, knowledge_id, created_at, answered_at')
    .eq('hotel_id', session.hotel)
  if (status !== 'all') q = q.eq('status', status)
  const { data, error } = await q.order('created_at', { ascending: false }).limit(200)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ questions: data ?? [] })
}

// Svar på / avvis et spørsmål. Svaret kan lagres rett i kunnskapsbasen.
export async function PATCH(req: Request) {
  const session = await requireSession('concierge')
  if (session instanceof Response) return session
  const { id, action, answer, title, category, shared, valid_until } = await req.json().catch(() => ({}))
  if (typeof id !== 'string') return Response.json({ error: 'Mangler id' }, { status: 400 })

  const { data: q } = await db.from('concierge_questions').select('id, question').eq('id', id).eq('hotel_id', session.hotel).maybeSingle()
  if (!q) return Response.json({ error: 'Fant ikke spørsmålet' }, { status: 404 })

  if (action === 'dismiss') {
    await db.from('concierge_questions').update({ status: 'dismissed', answered_at: new Date().toISOString() }).eq('id', id)
    return Response.json({ ok: true })
  }

  if (action === 'reopen') {
    await db.from('concierge_questions').update({ status: 'open', answered_at: null }).eq('id', id)
    return Response.json({ ok: true })
  }

  if (action !== 'answer' || typeof answer !== 'string' || !answer.trim()) {
    return Response.json({ error: 'Skriv et svar' }, { status: 400 })
  }

  const { data: k, error: kErr } = await db.from('knowledge_base').insert({
    title: (typeof title === 'string' && title.trim()) ? title.trim() : q.question.slice(0, 200),
    content: answer.trim(),
    category: typeof category === 'string' && category.trim() ? category.trim() : null,
    hotel_id: shared === true ? null : session.hotel,
    valid_until: cleanDate(valid_until),
    source: 'spørsmålskø',
  }).select('id').single()
  if (kErr) return Response.json({ error: kErr.message }, { status: 500 })

  await db.from('concierge_questions').update({
    status: 'answered',
    answer: answer.trim(),
    knowledge_id: k.id,
    answered_at: new Date().toISOString(),
  }).eq('id', id)

  return Response.json({ ok: true })
}
