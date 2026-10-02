import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { decrypt } from '@/lib/auth'

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  // 1. サイト全体を保護
  const isSiteAuthPath = path === '/login' || path === '/api/site-auth'
  const hasSiteAuth = request.cookies.get('site-auth')?.value === 'true'

  if (!hasSiteAuth && !isSiteAuthPath) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // 2. /admin 以下のルートを保護（ログイン画面は除く）
  if (path.startsWith('/admin') && !path.startsWith('/admin/login')) {
    const sessionCookie = request.cookies.get('session')?.value
    let isValid = false
    if (sessionCookie) {
      try {
        const payload = await decrypt(sessionCookie)
        if (payload?.isAdmin) isValid = true
      } catch (err) {
        isValid = false
      }
    }

    if (!isValid) {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
}
