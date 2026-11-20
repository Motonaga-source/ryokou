// 送迎表 API の共通処理（サーバー側専用）
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import type { TransportResponse } from '@/lib/transport'

// 管理者でなければエラーのレスポンスを返す（管理者なら null）
export async function requireAdmin() {
  const session = await getSession()
  return session?.isAdmin ? null : NextResponse.json({ error: '管理者ログインが必要です' }, { status: 401 })
}

export const badRequest = (error: string) => NextResponse.json({ error }, { status: 400 })
export const notFound = (what: string) => NextResponse.json({ error: `${what}が見つかりません` }, { status: 404 })

// イベントの送迎表を丸ごと読み込む
export async function loadTransport(tripId: number): Promise<TransportResponse> {
  const [sections, assignments, persons] = await Promise.all([
    prisma.groupSection.findMany({
      where: { tripId },
      select: {
        id: true, name: true, time: true, memo: true, sortOrder: true,
        slots: {
          select: { id: true, sectionId: true, name: true, kind: true, capacity: true, color: true, memo: true, sortOrder: true },
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    }),
    prisma.groupAssignment.findMany({
      where: { tripId },
      select: { personId: true, slotId: true, sortOrder: true },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    }),
    prisma.tripParticipation.findMany({
      where: { tripId, status: '参加' },
      select: {
        pickupMemo: true,
        person: { select: { id: true, name: true, role: true, gender: true, facility: true, isWheelchair: true, isFishNG: true } },
      },
      orderBy: { personId: 'asc' },
    }),
  ])
  return {
    sections,
    assignments,
    persons: persons.map(p => ({ ...p.person, pickupMemo: p.pickupMemo })),
  }
}

// 枠の中の並び順を 0,1,2… に振り直す
export async function renumberSlot(tripId: number, slotId: number, order: number[]) {
  await prisma.$transaction(
    order.map((personId, i) =>
      prisma.groupAssignment.update({ where: { tripId_personId: { tripId, personId } }, data: { sortOrder: i, slotId } })
    )
  )
}
