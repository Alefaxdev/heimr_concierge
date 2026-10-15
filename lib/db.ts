// Kun for server (route handlers / server components). Bruker service role.
import { createClient } from '@supabase/supabase-js'

export const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export type Hotel = {
  id: string
  name: string
  concierge_name: string | null
  voice_guide: string | null
  voice_examples: string | null
  mews_enterprise_id: string | null
}

export type KnowledgeEntry = {
  id: string
  title: string
  content: string
  category: string | null
  folder: string | null
  source: string | null
  hotel_id: string | null
  valid_until: string | null
  created_at: string
}

/** Dagens dato i Oslo som YYYY-MM-DD */
export function todayOslo(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Oslo' }).format(new Date())
}
