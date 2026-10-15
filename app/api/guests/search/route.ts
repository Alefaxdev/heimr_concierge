import { requireSession } from '@/lib/session'
import { getHotel } from '@/lib/knowledge'
import { mewsConfigured, searchGuests } from '@/lib/mews'
import { ensureEnterpriseId } from '@/lib/mews-hotel'

// Søk etter gjester i Mews (innsjekkede + ankomster neste 3 uker)
export async function GET(req: Request) {
  const session = await requireSession()
  if (session instanceof Response) return session

  const q = (new URL(req.url).searchParams.get('q') ?? '').slice(0, 80)
  if (!(await mewsConfigured(session.hotel))) return Response.json({ configured: false, guests: [] })

  const hotel = await getHotel(session.hotel)
  if (!hotel) return Response.json({ error: 'Fant ikke hotellet' }, { status: 404 })

  try {
    const guests = await searchGuests(hotel.id, await ensureEnterpriseId(hotel), q)
    return Response.json({ configured: true, guests }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    return Response.json({ configured: true, guests: [], error: err instanceof Error ? err.message : 'Ukjent feil' }, { status: 502 })
  }
}
