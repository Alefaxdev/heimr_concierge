import PDFParser from 'pdf2json'
import { db } from '@/lib/db'
import { requireSession } from '@/lib/session'
import { cleanDate } from '@/lib/knowledge'

async function extractText(buffer: Buffer): Promise<{ text: string; pages: number }> {
  return new Promise((resolve, reject) => {
    const parser = new PDFParser()
    parser.on('pdfParser_dataReady', (data) => {
      const text = data.Pages
        .flatMap(p => p.Texts)
        .map(t => t.R.map((r: { T: string }) => {
          try { return decodeURIComponent(r.T) } catch { return r.T }
        }).join(''))
        .join(' ')
      resolve({ text, pages: data.Pages.length })
    })
    parser.on('pdfParser_dataError', reject)
    parser.parseBuffer(buffer)
  })
}

export async function POST(req: Request) {
  const session = await requireSession('concierge')
  if (session instanceof Response) return session

  try {
    const formData = await req.formData()
    const file = formData.get('file')
    if (!(file instanceof File)) return Response.json({ error: 'Ingen fil' }, { status: 400 })
    if (file.size > 15 * 1024 * 1024) return Response.json({ error: 'Filen er for stor (maks 15 MB)' }, { status: 400 })

    const category = String(formData.get('category') ?? '').trim()
    const folder = String(formData.get('folder') ?? '').trim()
    const shared = formData.get('shared') === 'true'
    const validUntil = cleanDate(formData.get('valid_until'))

    const { text, pages } = await extractText(Buffer.from(await file.arrayBuffer()))
    if (!text.trim()) return Response.json({ error: 'Fant ingen tekst i PDF-en (er den skannet?)' }, { status: 400 })

    const { error } = await db.from('knowledge_base').insert({
      title: file.name.replace(/\.pdf$/i, ''),
      content: text,
      category: category || null,
      folder: folder || null,
      source: file.name,
      hotel_id: shared ? null : session.hotel,
      valid_until: validUntil,
    })
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true, pages })
  } catch (err) {
    console.error('PDF upload feil:', err instanceof Error ? err.message : err)
    return Response.json({ error: 'Kunne ikke lese PDF-en' }, { status: 500 })
  }
}
