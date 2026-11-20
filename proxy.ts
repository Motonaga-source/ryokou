import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { decrypt } from '@/lib/auth'
import { resolveEvent } from '@/lib/event'
import { EVENT_COOKIE, isReadOnlyAllowedApi } from '@/lib/event-shared'

export async function proxy(request: NextRequest) {
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
      } catch {
        isValid = false
      }
    }

    if (!isValid) {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
  }

  // 3. 終了したイベント（閲覧専用）を選んでいるときは、書き込み系の API を拒否する
  const isWrite = !['GET', 'HEAD', 'OPTIONS'].includes(request.method)
  if (isWrite && path.startsWith('/api/') && !isReadOnlyAllowedApi(path)) {
    const event = await resolveEvent(request.cookies.get(EVENT_COOKIE)?.value)
    if (event?.status === 'CLOSED') {
      return NextResponse.json(
        { error: `「${event.name}」は終了したイベントのため閲覧専用です。変更できません。` },
        { status: 403 }
      )
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
}
