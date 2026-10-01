export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { encrypt } from '@/lib/auth'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  const { name, password } = await request.json()

  // 名前で検索（管理者のみ）
  const user = await prisma.person.findFirst({
    where: { name, isAdmin: true },
  })

  if (!user || !user.password) {
    return NextResponse.json({ error: '無効なユーザー名またはパスワードです' }, { status: 401 })
  }

  // パスワード照合
  const isMatch = await bcrypt.compare(password, user.password)
  if (!isMatch) {
    return NextResponse.json({ error: '無効なユーザー名またはパスワードです' }, { status: 401 })
  }

  // セッション生成
  const expires = new Date(Date.now() + 10 * 60 * 60 * 1000) // 10時間
  const session = await encrypt({ 
    user: { id: user.id, name: user.name, role: user.role }, 
    isAdmin: user.isAdmin,
    expires 
  })

  // Cookieに保存
  const c = await cookies()
  c.set('session', session, { expires, httpOnly: true, secure: process.env.NODE_ENV === 'production' })

  return NextResponse.json({ success: true })
}
