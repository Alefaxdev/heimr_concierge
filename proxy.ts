import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { SESSION_COOKIE, verifySession } from '@/lib/auth'

const PUBLIC_PATHS = ['/login', '/api/auth/login']
const CONCIERGE_PAGES = ['/admin']
const CONCIERGE_APIS = ['/api/knowledge', '/api/questions', '/api/hotel', '/api/mews']

function startsWithAny(path: string, list: string[]) {
  return list.some(p => path === p || path.startsWith(p + '/'))
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (startsWithAny(pathname, PUBLIC_PATHS)) return NextResponse.next()

  const isApi = pathname.startsWith('/api/')
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value)

  if (!session) {
    if (isApi) return NextResponse.json({ error: 'Ikke innlogget' }, { status: 401 })
    const url = new URL('/login', request.url)
    if (pathname !== '/') url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  // GET /api/hotel er tillatt for alle innloggede (chat-headeren trenger hotellnavn)
  const readOnlyHotel = pathname === '/api/hotel' && request.method === 'GET'

  if (session.role !== 'concierge') {
    if (startsWithAny(pathname, CONCIERGE_PAGES)) return NextResponse.redirect(new URL('/', request.url))
    if (!readOnlyHotel && startsWithAny(pathname, CONCIERGE_APIS)) {
      return NextResponse.json({ error: 'Krever concierge-tilgang' }, { status: 403 })
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp)$).*)'],
}
