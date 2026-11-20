// 管理者用 API の共通処理（サーバー側専用）
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

// 管理者でなければエラーのレスポンスを返す（管理者なら null）
export async function requireAdmin() {
  const session = await getSession()
  return session?.isAdmin ? null : NextResponse.json({ error: '管理者ログインが必要です' }, { status: 401 })
}

export const badRequest = (error: string) => NextResponse.json({ error }, { status: 400 })
export const notFound = (what: string) => NextResponse.json({ error: `${what}が見つかりません` }, { status: 404 })
