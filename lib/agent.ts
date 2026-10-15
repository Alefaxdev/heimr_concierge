// lib/agent.ts
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from './supabase-admin'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface AbsenceInput {
  absence_id: string
  employee_id: number
  employee_name: string
  department_name: string
  absence_type: string
  start_date: string
  end_date?: string
  is_ongoing: boolean
  egenmelding_days_this_year?: number
  previous_long_term_absences?: number
}

interface TicketToCreate {
  ticket_type_id: string
  due_date: string
  priority: string
  title: string
  description: string
  action_items: string[]
}

const SYSTEM_PROMPT = `Du er en HR-compliance-assistent for Heimr i Norge.

Din oppgave er å analysere sykemeldinger og opprette nødvendige oppfølgingstickets for HR-sjefen,
basert på norsk arbeidsrett og folketrygdloven.

REGELVERKET DU SKAL HÅNDHEVE:

**Tilretteleggingsplikten (AML § 4-6)**
- Arbeidsgiver har plikt til å tilrettelegge så snart fraværet starter
- Ticket opprettes alltid ved sykemelding (ikke egenmelding)
- Frist: innen 1 uke fra sykmeldingsstart

**Oppfølgingsplan (AML § 4-6 (4) + ftrl § 8-7a)**
- Skal utarbeides senest innen 4 uker
- Gjelder ved sykemelding (ikke egenmelding under 4 dager)

**Dialogmøte 1 (AML § 4-6 (3))**
- Arbeidsgiver skal innkalle innen 7 uker (49 dager) fra første fraværsdag
- Gjelder alle med mer enn 7 ukers sykefravær
- KRITISK frist – NAV kan gi gebyr ved brudd

**Dialogmøte 2 (ftrl § 8-7a)**
- NAV innkaller, men arbeidsgiver må møte, innen 26 uker (182 dager)
- Gjelder ved langvarig sykemelding
- KRITISK frist

**Melding til NAV (ftrl § 8-7)**
- Vurderes ved fravær som trolig overstiger 8 uker
- Arbeidsgiver kan ha rapporteringsplikt

**Egenmeldingsregler (AML § 8-24)**
- Ansatt kan bruke egenmelding 3 dager sammenhengende, maks 4 ganger per 12 måneder
- Ticket ved: 3. egenmelding i år, eller 3 sammenhengende dager
- Arbeidsgivers rett til å kreve sykemelding fra dag 1 vurderes

INSTRUKSJONER FOR SVAR:
- Svar KUN med et JSON-array av tickets
- Norsk tekst i title, description og action_items
- Vær konkret og handlingsorientert
- Inkluder ikke tickets som ikke er relevante for fraværstypen
- due_date i format YYYY-MM-DD
- priority: "critical" | "high" | "medium" | "low"
- ticket_type_id må være én av: tilrettelegging, oppfolgingsplan, dialogmote_1, dialogmote_2, nav_melding, egenmelding_varsel, egenmelding_brukt, datakvalitet

JSON-format:
[
  {
    "ticket_type_id": "dialogmote_1",
    "due_date": "2025-03-15",
    "priority": "critical",
    "title": "Innkall til dialogmøte 1 – Kari Nordmann",
    "description": "Kari Nordmann har vært sykemeldt siden 14. januar...",
    "action_items": [
      "Send innkalling til Kari Nordmann innen 28. februar",
      "Inviter nærmeste leder og eventuelt tillitsvalgt"
    ]
  }
]`

export async function generateTicketsForAbsence(absence: AbsenceInput): Promise<TicketToCreate[]> {
  const userMessage = `Analyser følgende sykemelding og opprett nødvendige HR-tickets:

Ansatt: ${absence.employee_name}
Avdeling: ${absence.department_name}
Fraværstype: ${absence.absence_type}
Fra dato: ${absence.start_date}
Til dato: ${absence.end_date ?? 'pågående'}
Pågående: ${absence.is_ongoing ? 'ja' : 'nei'}
Egenmeldingsdager brukt i år (inkl. dette): ${absence.egenmelding_days_this_year ?? 0}
Antall tidligere langvarige sykefravær (>8 uker): ${absence.previous_long_term_absences ?? 0}
Dagens dato: ${new Date().toISOString().substring(0, 10)}`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  })

  const text = response.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as Anthropic.TextBlock).text)
    .join('')

  const clean = text.replace(/```json|```/g, '').trim()
  return JSON.parse(clean) as TicketToCreate[]
}

export async function processAbsenceAndCreateTickets(absence: AbsenceInput) {
  // Hent historikk
  const currentYear = new Date().getFullYear()
  const { data: egenmeldinger } = await supabaseAdmin
    .from('egenmelding_periods')
    .select('days')
    .eq('employee_id', absence.employee_id)
    .eq('year', currentYear)

  const egenmeldingDaysThisYear = (egenmeldinger ?? []).reduce((sum: number, e: any) => sum + e.days, 0)

  const { data: longTermAbsences } = await supabaseAdmin
    .from('absences')
    .select('id')
    .eq('employee_id', absence.employee_id)
    .gte('total_days', 56)

  const absenceWithHistory: AbsenceInput = {
    ...absence,
    egenmelding_days_this_year: egenmeldingDaysThisYear,
    previous_long_term_absences: longTermAbsences?.length ?? 0,
  }

  try {
    const tickets = await generateTicketsForAbsence(absenceWithHistory)
    console.log(`Genererte ${tickets.length} tickets for ${absence.absence_id}`)

    if (!tickets.length) return { created: 0 }

    let created = 0
    let skipped = 0

    for (const t of tickets) {
      // Sjekk om det allerede finnes en åpen ticket av denne typen for denne ansatte
      const { data: existing } = await supabaseAdmin
        .from('hr_tickets')
        .select('id')
        .eq('employee_id', absence.employee_id)
        .eq('ticket_type_id', t.ticket_type_id)
        .eq('status', 'open')
        .single()

      if (existing) {
        skipped++
        continue
      }

      const { error } = await supabaseAdmin.from('hr_tickets').insert({
        absence_id: absence.absence_id,
        employee_id: absence.employee_id,
        ticket_type_id: t.ticket_type_id,
        due_date: t.due_date,
        priority: t.priority,
        title: t.title,
        description: t.description,
        action_items: t.action_items,
        status: 'open',
      })

      if (error) {
        console.error('Ticket insert feil:', error.message)
      } else {
        created++
      }
    }

    console.log(`Tickets: ${created} opprettet, ${skipped} hoppet over (allerede åpen)`)
    return { created, skipped }
  } catch (err: any) {
    console.error('processAbsenceAndCreateTickets feil:', err.message)
    throw err
  }
}