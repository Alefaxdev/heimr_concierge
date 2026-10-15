import Anthropic from '@anthropic-ai/sdk'
import { db } from '@/lib/db'
import { requireSession } from '@/lib/session'
import { cleanDate, getHotel, getKnowledgeForHotel } from '@/lib/knowledge'
import { getPartners, partnersAsText } from '@/lib/partners'
import { buildContext, buildInstructions, buildKnowledge } from '@/lib/prompt'
import type { Session } from '@/lib/auth'
import { getGuestOverview, guestsAsText, mewsConfigured } from '@/lib/mews'
import { ensureEnterpriseId } from '@/lib/mews-hotel'

const anthropic = new Anthropic()
const MODEL = process.env.CONCIERGE_MODEL || 'claude-sonnet-4-6'
const MAX_TOOL_ROUNDS = 4
const MAX_HISTORY = 30

type ChatMessage = { role: 'user' | 'assistant'; content: string }

const ASK_CONCIERGE: Anthropic.Tool = {
  name: 'ask_concierge',
  description:
    'Legg et spørsmål i køen til concierge når svaret ikke finnes i kunnskapsbasen, eller når noen melder at informasjon er feil/endret. Concierge svarer senere og svaret blir lagt inn i kunnskapsbasen.',
  input_schema: {
    type: 'object',
    properties: {
      question: { type: 'string', description: 'Spørsmålet, formulert selvstendig og tydelig, slik at concierge forstår det uten resten av samtalen.' },
      context: { type: 'string', description: 'Kort relevant kontekst: hvem som spør, gjest, dato, antall personer osv.' },
    },
    required: ['question'],
  },
}

const SAVE_KNOWLEDGE: Anthropic.Tool = {
  name: 'save_knowledge',
  description: 'Lagre ny kunnskap i kunnskapsbasen. Brukes kun når concierge ber deg huske, lagre eller notere noe.',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Kort, søkbar tittel, f.eks. «Kontrast – stengt i jula».' },
      content: { type: 'string', description: 'Selve kunnskapen, komplett og konkret.' },
      category: {
        type: 'string',
        description: 'Kategori. Bruk en av: Restauranter, Opplevelser, Transport, Hotellinfo, Rutiner, Leverandører, Salg – eller en annen passende.',
      },
      valid_until: { type: 'string', description: 'Dato (YYYY-MM-DD) hvis kunnskapen er tidsbegrenset. Utelat ellers.' },
      shared: { type: 'boolean', description: 'true hvis kunnskapen gjelder alle HEIMR-hotell, false (standard) hvis bare dette hotellet.' },
    },
    required: ['title', 'content'],
  },
}

const GET_GUESTS: Anthropic.Tool = {
  name: 'get_todays_guests',
  description:
    'Hent dagens VIP-gjester fra Mews: VIP-ankomster i dag og VIP-gjester som bor på hotellet nå, med rom, datoer, merker og notater. Bruk når noen spør om dagens gjester, VIP-er, ankomster, eller vil skrive noe personlig til en gjest som bor her.',
  input_schema: { type: 'object', properties: {} },
}

function parseMessages(raw: unknown): ChatMessage[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null
  const msgs: ChatMessage[] = []
  for (const m of raw.slice(-MAX_HISTORY)) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string') return null
    if (!m.content.trim()) continue
    msgs.push({ role: m.role, content: m.content.slice(0, 20000) })
  }
  // API krever at første melding er fra bruker
  while (msgs.length && msgs[0].role !== 'user') msgs.shift()
  return msgs.length && msgs[msgs.length - 1].role === 'user' ? msgs : null
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function runTool(
  name: string,
  input: Record<string, unknown>,
  session: Session,
  conversationId: string | null,
): Promise<{ result: string; notice: string }> {
  if (name === 'ask_concierge') {
    const question = String(input.question ?? '').trim()
    if (!question) return { result: 'Feil: tomt spørsmål', notice: '' }
    const { error } = await db.from('concierge_questions').insert({
      hotel_id: session.hotel,
      conversation_id: conversationId,
      question: question.slice(0, 2000),
      context: typeof input.context === 'string' ? input.context.slice(0, 2000) : null,
      asked_by: session.name,
    })
    if (error) return { result: `Feil: ${error.message}`, notice: '' }
    return { result: 'Spørsmålet er lagt i køen.', notice: '📨 Lagt i spørsmålskøen til concierge' }
  }

  if (name === 'save_knowledge') {
    if (session.role !== 'concierge') return { result: 'Feil: bare concierge kan lagre kunnskap.', notice: '' }
    const title = String(input.title ?? '').trim()
    const content = String(input.content ?? '').trim()
    if (!title || !content) return { result: 'Feil: tittel og innhold må fylles ut.', notice: '' }
    const { error } = await db.from('knowledge_base').insert({
      title: title.slice(0, 200),
      content,
      category: typeof input.category === 'string' && input.category.trim() ? input.category.trim() : null,
      hotel_id: input.shared === true ? null : session.hotel,
      valid_until: cleanDate(input.valid_until),
      source: 'chat',
    })
    if (error) return { result: `Feil: ${error.message}`, notice: '' }
    return { result: 'Lagret i kunnskapsbasen.', notice: `✓ Lagret i kunnskapsbasen: «${title}»` }
  }

  if (name === 'get_todays_guests') {
    try {
      const hotel = await getHotel(session.hotel)
      if (!hotel) return { result: 'Feil: fant ikke hotellet.', notice: '' }
      const overview = await getGuestOverview(hotel.id, await ensureEnterpriseId(hotel))
      return { result: guestsAsText(overview), notice: '' }
    } catch (err) {
      return { result: `Kunne ikke hente fra Mews: ${err instanceof Error ? err.message : 'ukjent feil'}`, notice: '' }
    }
  }

  return { result: `Ukjent verktøy: ${name}`, notice: '' }
}

async function touchConversation(session: Session, conversationId: string | null) {
  if (!conversationId) return
  const { error } = await db.from('concierge_conversations').upsert(
    { id: conversationId, hotel_id: session.hotel, user_name: session.name, user_role: session.role, updated_at: new Date().toISOString() },
    { onConflict: 'id' },
  )
  if (error) console.error('Samtale-upsert feilet:', error.message)
}

async function logMessages(conversationId: string | null, userText: string, assistantText: string) {
  if (!conversationId) return
  try {
    await db.from('concierge_messages').insert([
      { conversation_id: conversationId, role: 'user', content: userText },
      { conversation_id: conversationId, role: 'assistant', content: assistantText || '(tomt svar)' },
    ])
  } catch (err) {
    console.error('Logging feilet:', err instanceof Error ? err.message : err)
  }
}

export async function POST(req: Request) {
  const session = await requireSession()
  if (session instanceof Response) return session

  const body = await req.json().catch(() => null)
  const history = parseMessages(body?.messages)
  if (!history) return Response.json({ error: 'Ugyldige meldinger' }, { status: 400 })
  const conversationId = typeof body?.conversationId === 'string' && UUID_RE.test(body.conversationId) ? body.conversationId : null

  const hotel = await getHotel(session.hotel)
  if (!hotel) return Response.json({ error: 'Fant ikke hotellet' }, { status: 404 })
  const [knowledge, mewsReady, partners] = await Promise.all([
    getKnowledgeForHotel(hotel.id),
    mewsConfigured(hotel.id),
    getPartners(hotel.id).catch(() => []),
    touchConversation(session, conversationId),
  ])

  // Stemme + kunnskap caches (endres sjelden); klokkeslett kommer etter cache-punktet
  const system: Anthropic.TextBlockParam[] = [
    { type: 'text', text: buildInstructions(hotel, session) },
    { type: 'text', text: `${buildKnowledge(hotel, knowledge)}\n\n${partnersAsText(partners, hotel.name)}`, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: buildContext() },
  ]
  const tools = [
    ASK_CONCIERGE,
    ...(session.role === 'concierge' ? [SAVE_KNOWLEDGE] : []),
    ...(mewsReady ? [GET_GUESTS] : []),
  ]

  const messages: Anthropic.MessageParam[] = history.map(m => ({ role: m.role, content: m.content }))
  const userText = history[history.length - 1].content
  const encoder = new TextEncoder()

  const readable = new ReadableStream({
    async start(controller) {
      let fullText = ''
      const write = (t: string) => {
        fullText += t
        controller.enqueue(encoder.encode(t))
      }

      try {
        for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
          const stream = anthropic.messages.stream({
            model: MODEL,
            max_tokens: 2000,
            system,
            tools,
            messages,
          })

          for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') write(event.delta.text)
          }

          const final = await stream.finalMessage()
          if (final.stop_reason !== 'tool_use') break

          const toolUses = final.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
          const results: Anthropic.ToolResultBlockParam[] = []
          for (const tu of toolUses) {
            const { result, notice } = await runTool(tu.name, (tu.input ?? {}) as Record<string, unknown>, session, conversationId)
            if (notice) write(`\n\n> ${notice}\n\n`)
            results.push({ type: 'tool_result', tool_use_id: tu.id, content: result })
          }
          messages.push({ role: 'assistant', content: final.content })
          messages.push({ role: 'user', content: results })
        }
      } catch (err) {
        console.error('Chat feil:', err instanceof Error ? err.message : err)
        write('\n\n_Beklager, noe gikk galt. Prøv igjen om litt._')
      } finally {
        controller.close()
        await logMessages(conversationId, userText, fullText.trim())
      }
    },
  })

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
