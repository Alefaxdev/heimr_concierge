import { requireSession } from '@/lib/session'
import { listEnterprises, mewsConfigured } from '@/lib/mews'
import { keyVaultError, keyVaultUrl } from '@/lib/secrets'

// Lister hotellene (enterprises) Mews-tokenet har tilgang til (kun concierge)
export async function GET() {
  const session = await requireSession('concierge')
  if (session instanceof Response) return session
  if (!(await mewsConfigured(session.hotel))) {
    const kv = keyVaultError()
    return Response.json({
      error: kv
        ? `Fikk ikke hentet Mews-tokens fra Key Vault (${keyVaultUrl}): ${kv}`
        : `Fant ikke Mews-tokens i Key Vault (${keyVaultUrl}). Sjekk navnene på hemmelighetene.`,
    }, { status: 400 })
  }
  try {
    return Response.json({ enterprises: await listEnterprises(session.hotel) })
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Ukjent feil' }, { status: 502 })
  }
}
