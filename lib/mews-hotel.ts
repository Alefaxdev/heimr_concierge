// Kobler et HEIMR-hotell til riktig Mews-enterprise (lagres i concierge_hotels).
import { db, type Hotel } from './db'
import { listEnterprises } from './mews'

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '')

/** Returnerer lagret enterprise-ID, eller prøver å finne den ut fra hotellnavnet og lagrer den. */
export async function ensureEnterpriseId(hotel: Hotel): Promise<string | null> {
  if (hotel.mews_enterprise_id) return hotel.mews_enterprise_id
  try {
    const list = await listEnterprises(hotel.id)
    const target = norm(hotel.name)
    const matches = list.length === 1 ? list : list.filter(e => norm(e.name).includes(target))
    if (matches.length !== 1) return null
    await db.from('concierge_hotels').update({ mews_enterprise_id: matches[0].id }).eq('id', hotel.id)
    hotel.mews_enterprise_id = matches[0].id
    return matches[0].id
  } catch {
    return null
  }
}
