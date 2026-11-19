import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { EVENT_COOKIE } from '@/lib/event-shared'

// 選んでいるイベントを切り替える（Cookie に保存。端末ごとに覚える）
export async function POST(request: Request) {
  try {
    const { id } = await request.json()
    const trip = await prisma.trip.findUnique({ where: { id: Number(id) || 0 }, select: { id: true } })
    if (!trip) return NextResponse.json({ error: 'イベントが見つかりません' }, { status: 404 })

    const store = await cookies()
    store.set({
      name: EVENT_COOKIE,
      value: String(trip.id),
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 365,
    })
    return NextResponse.json({ success: true, id: trip.id })
  } catch (error) {
    console.error('Events current POST error:', error)
    return NextResponse.json({ error: 'イベントの切り替えに失敗しました' }, { status: 500 })
  }
}
