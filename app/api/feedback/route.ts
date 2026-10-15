import { db } from '@/lib/db'
import { requireSession } from '@/lib/session'

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

// «Rett svaret» fra chatten.
// Concierge: rettelsen lagres rett i kunnskapsbasen.
// Resepsjon: rettelsen legges i spørsmålskøen til concierge.
export async function POST(req: Request) {
  const session = await requireSession()
  if (session instanceof Response) return session
  const b = await req.json().catch(() => ({}))

  const question = str(b.question, 2000)
  const answer = str(b.answer, 6000)
  const correction = str(b.correction, 4000)
  if (!correction) return Response.json({ error: 'Skriv hva som er riktig' }, { status: 400 })

  if (session.role === 'concierge') {
    const title = str(b.title, 200) || question.replace(/\s+/g, ' ').slice(0, 120) || 'Rettelse fra chat'
    const { error } = await db.from('knowledge_base').insert({
      title,
      content: correction,
      category: str(b.category, 50) || null,
      hotel_id: b.shared === true ? null : session.hotel,
      source: 'rettelse',
    })
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true, saved: 'knowledge' })
  }

  const { error } = await db.from('concierge_questions').insert({
    hotel_id: session.hotel,
    question: question ? `Rettelse: ${question}` : 'Rettelse av et svar i chatten',
    context: [
      `Det ${session.name} mener er riktig: ${correction}`,
      answer && `Svaret assistenten ga: ${answer.slice(0, 1500)}`,
    ].filter(Boolean).join('\n\n'),
    asked_by: session.name,
  })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true, saved: 'question' })
}
