import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { decrypt } from '@/lib/auth'

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  // /admin 以下のルートを保護（ログイン画面は除く）
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

  // ルート("/") またはその他の一般ページへのアクセスで、すでにログイン済みの場合は /admin へ誘導することも可能だが、
  // 今回は一般画面と管理画面の行き来を考慮し、強制リダイレクトはしないでおく。

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
