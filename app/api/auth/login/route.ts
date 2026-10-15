import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { PREFS_COOKIE, SESSION_COOKIE, SESSION_DAYS, safeEqual, signSession, type Role } from '@/lib/auth'

export async function POST(req: Request) {
  const { hotel, name, password } = await req.json().catch(() => ({}))

  if (typeof hotel !== 'string' || typeof name !== 'string' || typeof password !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'Fyll inn hotell, navn og passord' }, { status: 400 })
  }

  const { data: h } = await db.from('concierge_hotels').select('id').eq('id', hotel).maybeSingle()
  if (!h) return NextResponse.json({ error: 'Ukjent hotell' }, { status: 400 })

  const conciergePw = process.env.CONCIERGE_PASSWORD ?? ''
  const staffPw = process.env.STAFF_PASSWORD ?? ''

  let role: Role | null = null
  if (conciergePw && safeEqual(password, conciergePw)) role = 'concierge'
  else if (staffPw && safeEqual(password, staffPw)) role = 'staff'

  if (!role) {
    await new Promise(r => setTimeout(r, 600)) // demp gjetting
    return NextResponse.json({ error: 'Feil passord' }, { status: 401 })
  }

  const token = await signSession({ role, hotel, name: name.trim().slice(0, 60) })
  const res = NextResponse.json({ ok: true, role })
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_DAYS * 86400,
  })
  res.cookies.set(PREFS_COOKIE, JSON.stringify({ hotel, name: name.trim().slice(0, 60) }), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 365 * 86400,
  })
  return res
}
