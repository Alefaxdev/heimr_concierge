import { db } from '@/lib/db'
import { requireSession } from '@/lib/session'
import { cleanPartner, getPartners } from '@/lib/partners'

// GET: alle innloggede (trengs for bestillinger). POST: kun concierge.
export async function GET(req: Request) {
  const session = await requireSession()
  if (session instanceof Response) return session
  const all = new URL(req.url).searchParams.get('all') === '1' && session.role === 'concierge'
  return Response.json({ partners: await getPartners(session.hotel, { includeInactive: all }) })
}

export async function POST(req: Request) {
  const session = await requireSession('concierge')
  if (session instanceof Response) return session
  const body = await req.json().catch(() => ({}))
  const p = cleanPartner(body)
  if (!p.name) return Response.json({ error: 'Navn må fylles ut' }, { status: 400 })

  const { data, error } = await db.from('concierge_partners')
    .insert({ ...p, hotel_id: body.shared === true ? null : session.hotel })
    .select('id').single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true, id: data.id })
}
