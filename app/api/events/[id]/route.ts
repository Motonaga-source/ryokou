import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { fromJstDate, parseEventInput, toJstDate } from '@/lib/event-input'

// PUT /api/events/:id  イベントを編集する（管理者のみ）
// - 開催予定のイベント: 内容（名前・日程・使う機能など）と状態を変更できる
//   body: { name, destination, startDate, endDate, travelFee?, pocketMoney?, dashboardNotes?, modules, status?: "ACTIVE" | "CLOSED" }
// - 終了したイベント（閲覧専用）: 「再開」（status: "ACTIVE"）だけができる。内容を直すときは先に再開する
//   body: { status: "ACTIVE" }
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session?.isAdmin) {
    return NextResponse.json({ error: '管理者ログインが必要です' }, { status: 401 })
  }

  const { id } = await params
  const trip = await prisma.trip.findUnique({ where: { id: parseInt(id) } })
  if (!trip) return NextResponse.json({ error: 'イベントが見つかりません' }, { status: 404 })

  const body = await request.json()
  const status = body.status === 'ACTIVE' || body.status === 'CLOSED' ? body.status : undefined
  if (body.status !== undefined && !status) {
    return NextResponse.json({ error: '状態が不正です' }, { status: 400 })
  }

  if (trip.status === 'CLOSED') {
    const onlyReopen = status === 'ACTIVE' && Object.keys(body).every(k => k === 'status')
    if (!onlyReopen) {
      return NextResponse.json(
        { error: `「${trip.name}」は終了したイベントのため閲覧専用です。内容を直すときは、先に「再開する」を押してください。` },
        { status: 403 }
      )
    }
    await prisma.trip.update({ where: { id: trip.id }, data: { status: 'ACTIVE' } })
    return NextResponse.json({ success: true })
  }

  // 状態だけの変更（「終了にする」）
  if (Object.keys(body).every(k => k === 'status')) {
    if (status && status !== trip.status) await prisma.trip.update({ where: { id: trip.id }, data: { status } })
    return NextResponse.json({ success: true })
  }

  const input = parseEventInput(body)
  if (typeof input === 'string') return NextResponse.json({ error: input }, { status: 400 })

  await prisma.trip.update({
    where: { id: trip.id },
    data: {
      ...input,
      // 日付が変わっていなければ、登録済みの時刻（例: 7:30 出発）をそのまま残す
      startDate: input.startDate === toJstDate(trip.startDate) ? trip.startDate : fromJstDate(input.startDate),
      endDate: input.endDate === toJstDate(trip.endDate) ? trip.endDate : fromJstDate(input.endDate),
      ...(status ? { status } : {}),
    },
  })
  return NextResponse.json({ success: true })
}
