import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { parseScheduleInput, placeByTime } from '@/lib/schedule'

// PUT /api/schedule/:id  スケジュールを更新（日付を変えた場合は移動先の日の時刻順の位置へ）
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session?.isAdmin) {
    return NextResponse.json({ error: '管理者ログインが必要です' }, { status: 401 })
  }

  const { id } = await params
  const scheduleId = parseInt(id)
  const current = await prisma.schedule.findUnique({ where: { id: scheduleId } })
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const input = parseScheduleInput(await request.json())
  if (typeof input === 'string') {
    return NextResponse.json({ error: input }, { status: 400 })
  }

  const schedule = await prisma.schedule.update({ where: { id: scheduleId }, data: input })
  if (input.dayNo !== current.dayNo) await placeByTime(current.tripId, input.dayNo, scheduleId)
  return NextResponse.json(schedule)
}

// DELETE /api/schedule/:id  スケジュールを削除
export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session?.isAdmin) {
    return NextResponse.json({ error: '管理者ログインが必要です' }, { status: 401 })
  }

  const { id } = await params
  await prisma.schedule.deleteMany({ where: { id: parseInt(id) } })
  return NextResponse.json({ success: true })
}
