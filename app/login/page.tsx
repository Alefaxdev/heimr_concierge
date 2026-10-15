import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { PREFS_COOKIE } from '@/lib/auth'
import LoginForm from './LoginForm'

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const store = await cookies()
  const { next } = await searchParams
  const { data: hotels } = await db.from('concierge_hotels').select('id, name').order('name')

  // Husk hotell og navn fra forrige innlogging på denne maskinen (aldri passord)
  let prefs: { hotel?: string; name?: string } = {}
  try { prefs = JSON.parse(store.get(PREFS_COOKIE)?.value ?? '{}') } catch {}

  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/'
  return <LoginForm hotels={hotels ?? []} next={safeNext} initialHotel={prefs.hotel} initialName={prefs.name} />
}
