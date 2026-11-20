// 席レイアウトの共通処理（サーバー側専用）
import { prisma } from '@/lib/prisma'
import type { SeatingResponse } from '@/lib/seating'

// イベントの席レイアウトを丸ごと読み込む（配置図・テーブル・目印・割り当て・参加者）
export async function loadSeating(tripId: number): Promise<SeatingResponse> {
  const tableSelect = { id: true, layoutId: true, name: true, shape: true, seats: true, wheelchairSlots: true, x: true, y: true, memo: true }
  const [layouts, assignments, participants] = await Promise.all([
    prisma.seatLayout.findMany({
      where: { tripId },
      select: {
        id: true, name: true, width: true, height: true, sortOrder: true,
        tables: { select: tableSelect, orderBy: { id: 'asc' } },
        landmarks: { select: { id: true, layoutId: true, kind: true, label: true, x: true, y: true, w: true, h: true }, orderBy: { id: 'asc' } },
      },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    }),
    prisma.seatAssignment.findMany({ where: { tripId }, select: { layoutId: true, tableId: true, seatIndex: true, personId: true } }),
    prisma.tripParticipation.findMany({
      where: { tripId, status: '参加' },
      select: { person: { select: { id: true, name: true, role: true, gender: true, facility: true, isWheelchair: true, isFishNG: true } } },
      orderBy: { personId: 'asc' },
    }),
  ])
  return { layouts, assignments, persons: participants.map(p => p.person) }
}
