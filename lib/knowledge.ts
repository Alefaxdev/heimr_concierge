import { db, todayOslo, type Hotel, type KnowledgeEntry } from './db'

const FIELDS = 'id, title, content, category, folder, source, hotel_id, valid_until, created_at'

/** Kunnskap som gjelder for et hotell: hotellets egen + felles HEIMR. */
export async function getKnowledgeForHotel(hotelId: string, opts: { includeExpired?: boolean } = {}): Promise<KnowledgeEntry[]> {
  let q = db.from('knowledge_base').select(FIELDS).or(`hotel_id.eq.${hotelId},hotel_id.is.null`)
  if (!opts.includeExpired) q = q.or(`valid_until.is.null,valid_until.gte.${todayOslo()}`)
  const { data, error } = await q.order('category', { nullsFirst: false }).order('title')
  if (error) throw new Error(error.message)
  return (data ?? []) as KnowledgeEntry[]
}

export async function getHotel(hotelId: string): Promise<Hotel | null> {
  const { data } = await db
    .from('concierge_hotels')
    .select('id, name, concierge_name, voice_guide, voice_examples, mews_enterprise_id')
    .eq('id', hotelId)
    .maybeSingle()
  return (data as Hotel) ?? null
}

/** Godtar 'YYYY-MM-DD' eller tomt; alt annet blir null. */
export function cleanDate(v: unknown): string | null {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null
}
