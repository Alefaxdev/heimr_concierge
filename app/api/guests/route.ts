import { requireSession } from '@/lib/session'
import { getHotel } from '@/lib/knowledge'
import { getGuestOverview, mewsConfigured } from '@/lib/mews'
import { ensureEnterpriseId } from '@/lib/mews-hotel'
import { keyVaultError } from '@/lib/secrets'

// Dagens VIP-gjester fra Mews (alle innloggede)
export async function GET(req: Request) {
  const session = await requireSession()
  if (session instanceof Response) return session

  if (!(await mewsConfigured(session.hotel))) return Response.json({ configured: false, keyVaultError: keyVaultError() })

  const hotel = await getHotel(session.hotel)
  if (!hotel) return Response.json({ error: 'Fant ikke hotellet' }, { status: 404 })

  const fresh = new URL(req.url).searchParams.get('fresh') === '1'
  const enterpriseId = await ensureEnterpriseId(hotel)
  try {
    const data = await getGuestOverview(hotel.id, enterpriseId, { fresh })
    return Response.json({ configured: true, ...data }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    let message = err instanceof Error ? err.message : 'Ukjent feil'
    if (message.includes('enterprise-ID')) {
      message = `Fant ikke «${hotel.name}» automatisk i Mews. Velg riktig hotell under Admin → Oppsett → «Finn i Mews».`
    }
    console.error('Mews feil:', message)
    return Response.json({ configured: true, error: message, needsSetup: !enterpriseId }, { status: 502 })
  }
}
