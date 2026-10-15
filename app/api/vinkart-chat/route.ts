import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import wineData from '@/app/data/vinliste_asia.json'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const anthropic = new Anthropic()

export async function POST(req: Request) {
  try {
    const { message, history } = await req.json()

    // Hent kunnskapsbase
    const { data: knowledge } = await supabase
      .from('knowledge_base')
      .select('title, content, category, folder')
      .order('category')

    const knowledgeText = knowledge
      ?.map(k => {
        const path = [k.category, k.folder, k.title].filter(Boolean).join(' > ')
        return `### ${path}\n${k.content}`
      })
      .join('\n\n') ?? ''

    // Formater vinlisten
    const wineList = (wineData as any[])
      .map(w => {
        const parts = [
          `**${w.name}**${w.vintage && w.vintage !== 'NaN' && w.vintage !== 'null' ? ` (${w.vintage})` : ''}`,
          `Type: ${w.type}`,
          `Land/Region: ${[w.country, w.region !== 'NaN' && w.region !== 'null' ? w.region : null].filter(Boolean).join(', ')}`,
          w.grapes && w.grapes !== 'NaN' && w.grapes !== 'null' ? `Druer: ${w.grapes}` : null,
          w.note && w.note !== 'null' ? `Note: ${w.note}` : null,
          `Pris: ${w.price_raw}`,
        ].filter(Boolean).join(' | ')
        return parts
      })
      .join('\n')

    const systemPrompt = `Du er en diskret og kunnskapsrik sommelier på Asia Aker Brygge. Du hjelper gjester med å finne riktig vin.

VIKTIG: Du skal KUN anbefale viner som finnes på vinlisten nedenfor – aldri nevne viner som ikke er der. Du kan bruke generell sommelierkunnskap for å forklare hvorfor en vin passer, men alle anbefalinger må være fra listen. Hvis kunnskapsbasen inneholder relevant info om en rett eller vin, bruk den – ellers stol på vinlistens egne noter.

Svar alltid på norsk. Vær kortfattet og profesjonell – som en god sommelier. Bruk naturlig prosa uten markdown eller stjerner.

## Vinliste – Asia Aker Brygge
${wineList}

## Kunnskapsbase
${knowledgeText || '(Ingen tilleggsinformasjon lastet opp ennå)'}`

    const messages = [
      ...history.map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content: message },
    ]

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      system: systemPrompt,
      messages,
    })

    const text = response.content
      .filter(b => b.type === 'text')
      .map(b => (b as any).text)
      .join('')

    return Response.json({ response: text })
  } catch (err: any) {
    console.error('Vinkart chat feil:', err.message)
    return Response.json({ error: err.message }, { status: 500 })
  }
}