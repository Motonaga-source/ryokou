import { prisma } from '@/lib/prisma'

export const SCHEDULE_DAYS = [1, 2] as const

// "08:30" / "8:30〜9:00" のような時刻表記を分に変換（時刻で始まらない表記は null）
export function toMinutes(timeLabel: string): number | null {
  const m = timeLabel.trim().match(/^(\d{1,2})[:：](\d{2})/)
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

export interface ScheduleInput {
  dayNo: number
  timeLabel: string
  location: string
  description: string | null
  assignedTo: string | null
}

// リクエストボディを検証して保存用の値に整える（不正な場合はエラーメッセージを返す）
export function parseScheduleInput(body: Record<string, unknown>): ScheduleInput | string {
  const dayNo = Number(body.dayNo)
  const timeLabel = typeof body.timeLabel === 'string' ? body.timeLabel.trim() : ''
  const location = typeof body.location === 'string' ? body.location.trim() : ''
  const optional = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)

  if (!SCHEDULE_DAYS.some(d => d === dayNo)) return 'dayNo が不正です'
  if (!timeLabel) return '時刻を入力してください'
  if (!location) return '内容を入力してください'
  return { dayNo, timeLabel, location, description: optional(body.description), assignedTo: optional(body.assignedTo) }
}

// 指定日のスケジュールを、時刻順の位置に targetId を差し込んで sortOrder を振り直す
export async function placeByTime(tripId: number, dayNo: number, targetId: number) {
  const list = await prisma.schedule.findMany({ where: { tripId, dayNo }, orderBy: { sortOrder: 'asc' } })
  const target = list.find(s => s.id === targetId)
  if (!target) return
  const others = list.filter(s => s.id !== targetId)
  const t = toMinutes(target.timeLabel)
  let idx = others.length
  if (t !== null) {
    const i = others.findIndex(s => {
      const m = toMinutes(s.timeLabel)
      return m !== null && m > t
    })
    if (i >= 0) idx = i
  }
  others.splice(idx, 0, target)
  await prisma.$transaction(
    others.map((s, i) => prisma.schedule.update({ where: { id: s.id }, data: { sortOrder: i + 1 } }))
  )
}
