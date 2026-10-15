import Anthropic from '@anthropic-ai/sdk'
import { db } from '@/lib/db'
import { requireSession } from '@/lib/session'
import { getHotel } from '@/lib/knowledge'
import { PARTNER_FIELDS, type Partner } from '@/lib/partners'

const anthropic = new Anthropic()
const MODEL = process.env.CONCIERGE_MODEL || 'claude-sonnet-4-6'

const str = (v: unknown, max = 500) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : '')

function dateText(iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return ''
  const d = new Date(`${iso}T12:00:00Z`)
  return new Intl.DateTimeFormat('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' }).format(d)
}

// Lager e-postutkast til partneren i concierge sin stemme. Returnerer { subject, body }.
export async function POST(req: Request) {
  const session = await requireSession()
  if (session instanceof Response) return session
  const b = await req.json().catch(() => ({}))

  const hotel = await getHotel(session.hotel)
  if (!hotel) return Response.json({ error: 'Fant ikke hotellet' }, { status: 404 })

  let partner: Partner | null = null
  if (typeof b.partner_id === 'string' && b.partner_id) {
    const { data } = await db.from('concierge_partners').select(PARTNER_FIELDS)
      .eq('id', b.partner_id).or(`hotel_id.eq.${hotel.id},hotel_id.is.null`).maybeSingle()
    partner = (data as Partner) ?? null
  }
  const partnerName = partner?.name || str(b.partner_name, 200)
  if (!partnerName) return Response.json({ error: 'Velg en partner' }, { status: 400 })

  const guest = str(b.guest_name, 200)
  if (!guest) return Response.json({ error: 'Velg eller skriv inn en gjest' }, { status: 400 })

  const sender = session.role === 'concierge'
    ? `${session.name}, Concierge, ${hotel.name}`
    : `${session.name}, Resepsjonen, ${hotel.name}`

  const details = [
    `Partner: ${partnerName} (${partner?.category || str(b.category, 50) || 'ukjent type'})`,
    partner?.contact_name && `Kontaktperson hos partner: ${partner.contact_name}`,
    partner?.notes && `Concierges notater om partneren: ${partner.notes}`,
    `Gjest: ${guest}`,
    b.room && `Gjesten bor på rom ${str(b.room, 20)} på ${hotel.name}`,
    b.booking_date && `Dato: ${dateText(str(b.booking_date, 10))} (${str(b.booking_date, 10)})`,
    b.booking_time && `Tidspunkt: ${str(b.booking_time, 5)}`,
    b.persons && `Antall personer: ${Number(b.persons)}`,
    b.wishes && `Ønsker/kommentarer: ${str(b.wishes, 2000)}`,
    `Avsender (signatur): ${sender}`,
  ].filter(Boolean).join('\n')

  const system = `Du skriver bestillingsforespørsler på vegne av concierge-avdelingen på ${hotel.name} (HEIMR Collection) til restauranter, taxiselskaper og andre partnere.

Skriv kort, høflig og presist, slik ${hotel.concierge_name || 'concierge'} ville skrevet til en samarbeidspartner. Alle opplysninger partneren trenger skal med (navn på bestillingen, dato, tid, antall, ønsker, hvordan de bekrefter), ingenting mer.
- Skriv på norsk med mindre partneren åpenbart er utenlandsk.
- Taxi/transport: oppgi hentested (${hotel.name}), tid, antall personer og destinasjon hvis kjent.
- Ukjent informasjon markeres med [hakeparentes], aldri gjett.
- Ingen AI-fraser, ingen overdreven høflighet.

Stemmeguide for concierge (tilpass til e-post mellom kolleger i bransjen):
${hotel.voice_guide?.trim() || '(ingen)'}

Svar NØYAKTIG i dette formatet:
Emne: <emnelinje>

<e-posttekst med hilsen og signatur>`

  try {
    const res = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 900,
      system,
      messages: [{ role: 'user', content: `Lag e-post for denne bestillingen:\n\n${details}` }],
    })
    const text = res.content.filter((c): c is Anthropic.TextBlock => c.type === 'text').map(c => c.text).join('').trim()
    const m = text.match(/^\s*Emne:\s*(.+)\n+([\s\S]*)$/i)
    const subject = m ? m[1].trim() : `Bordbestilling – ${guest}`
    const body = (m ? m[2] : text).trim()
    return Response.json({ subject, body })
  } catch (err) {
    console.error('Utkast feil:', err instanceof Error ? err.message : err)
    return Response.json({ error: 'Kunne ikke lage utkast akkurat nå' }, { status: 502 })
  }
}
