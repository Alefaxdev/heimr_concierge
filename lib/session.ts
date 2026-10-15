// Hjelpere for route handlers og server components.
import { cookies } from 'next/headers'
import { SESSION_COOKIE, verifySession, type Session } from './auth'

export async function getSession(): Promise<Session | null> {
  const store = await cookies()
  return verifySession(store.get(SESSION_COOKIE)?.value)
}

export function unauthorized() {
  return Response.json({ error: 'Ikke innlogget' }, { status: 401 })
}

export function forbidden() {
  return Response.json({ error: 'Krever concierge-tilgang' }, { status: 403 })
}

/** Returnerer sesjon, eller en Response som skal returneres direkte. */
export async function requireSession(role?: 'concierge'): Promise<Session | Response> {
  const s = await getSession()
  if (!s) return unauthorized()
  if (role === 'concierge' && s.role !== 'concierge') return forbidden()
  return s
}
