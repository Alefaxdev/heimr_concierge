import { db } from '@/lib/db'
import { requireSession } from '@/lib/session'

export async function GET() {
  const session = await requireSession('concierge')
  if (session instanceof Response) return session
  const { data } = await db.from('knowledge_folders').select('*').order('created_at')
  return Response.json({ folders: data ?? [] })
}

export async function POST(req: Request) {
  const session = await requireSession('concierge')
  if (session instanceof Response) return session
  const { name, category } = await req.json().catch(() => ({}))
  if (typeof name !== 'string' || typeof category !== 'string' || !name.trim() || !category.trim()) {
    return Response.json({ error: 'Navn og kategori må fylles ut' }, { status: 400 })
  }
  const { error } = await db.from('knowledge_folders').insert({ name: name.trim(), category: category.trim() })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}

export async function DELETE(req: Request) {
  const session = await requireSession('concierge')
  if (session instanceof Response) return session
  const { name, category } = await req.json().catch(() => ({}))
  if (typeof name !== 'string' || typeof category !== 'string') {
    return Response.json({ error: 'Navn og kategori må fylles ut' }, { status: 400 })
  }
  // Slett dokumentene i mappen som tilhører dette hotellet eller er felles
  await db.from('knowledge_base').delete()
    .eq('folder', name).eq('category', category)
    .or(`hotel_id.eq.${session.hotel},hotel_id.is.null`)
  await db.from('knowledge_folders').delete().eq('name', name).eq('category', category)
  return Response.json({ ok: true })
}
