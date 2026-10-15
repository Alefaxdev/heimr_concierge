// Enkel, signert sesjons-cookie (HMAC-SHA256 via Web Crypto).
// Fungerer både i proxy.ts og i route handlers.

export type Role = 'staff' | 'concierge'

export type Session = {
  role: Role
  hotel: string
  name: string
  exp: number // unix sekunder
}

export const SESSION_COOKIE = 'heimr_session'
export const PREFS_COOKIE = 'heimr_login_prefs'
export const SESSION_DAYS = 14

const enc = new TextEncoder()

function b64url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromB64url(s: string): Uint8Array {
  const pad = s.length % 4 ? '='.repeat(4 - (s.length % 4)) : ''
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function key(): Promise<CryptoKey> {
  const secret = process.env.AUTH_SECRET
  if (!secret || secret.length < 16) throw new Error('AUTH_SECRET mangler eller er for kort (min 16 tegn)')
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}

export async function signSession(s: Omit<Session, 'exp'>): Promise<string> {
  const session: Session = { ...s, exp: Math.floor(Date.now() / 1000) + SESSION_DAYS * 86400 }
  const payload = b64url(enc.encode(JSON.stringify(session)))
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', await key(), enc.encode(payload)))
  return `${payload}.${b64url(sig)}`
}

export async function verifySession(token: string | undefined | null): Promise<Session | null> {
  if (!token) return null
  const [payload, sig] = token.split('.')
  if (!payload || !sig) return null
  try {
    const ok = await crypto.subtle.verify('HMAC', await key(), fromB64url(sig) as BufferSource, enc.encode(payload))
    if (!ok) return null
    const session = JSON.parse(new TextDecoder().decode(fromB64url(payload))) as Session
    if (!session.exp || session.exp < Math.floor(Date.now() / 1000)) return null
    if (session.role !== 'staff' && session.role !== 'concierge') return null
    return session
  } catch {
    return null
  }
}

/** Konstant-tid sammenligning av passord */
export function safeEqual(a: string, b: string): boolean {
  const ab = enc.encode(a)
  const bb = enc.encode(b)
  let diff = ab.length ^ bb.length
  for (let i = 0; i < Math.max(ab.length, bb.length); i++) diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0)
  return diff === 0
}
