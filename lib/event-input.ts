// イベントの作成・編集で受け取る値の確認（サーバー側）
import { normalizeModules } from '@/lib/modules'

// イベントの詳細（イベント管理画面で使う）
export interface EventDetail {
  id: number
  name: string
  destination: string
  startDate: string // "YYYY-MM-DD"（日本時間）
  endDate: string
  travelFee: number | null
  pocketMoney: number | null
  dashboardNotes: string | null
  modules: string[]
  status: 'ACTIVE' | 'CLOSED'
  participants: number // 「参加」の人数
}

export interface EventInput {
  name: string
  destination: string
  startDate: string
  endDate: string
  travelFee: number | null
  pocketMoney: number | null
  dashboardNotes: string | null
  modules: string[]
}

const DATE = /^\d{4}-\d{2}-\d{2}$/
const MAX_YEN = 10_000_000

// 日本時間の "YYYY-MM-DD"
export const toJstDate = (d: Date) => new Date(d.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
// "YYYY-MM-DD"（日本時間）の 0:00
export const fromJstDate = (s: string) => new Date(`${s}T00:00:00+09:00`)

const optionalYen = (v: unknown): number | null | 'error' => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isInteger(n) && n >= 0 && n <= MAX_YEN ? n : 'error'
}

export function parseEventInput(body: Record<string, unknown>): EventInput | string {
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return 'イベント名を入力してください'
  if (name.length > 100) return 'イベント名は100文字以内にしてください'
  const destination = typeof body.destination === 'string' ? body.destination.trim() : ''
  const startDate = String(body.startDate ?? '')
  const endDate = String(body.endDate ?? '')
  if (!DATE.test(startDate) || isNaN(fromJstDate(startDate).getTime())) return '開始日を入力してください'
  if (!DATE.test(endDate) || isNaN(fromJstDate(endDate).getTime())) return '終了日を入力してください'
  if (endDate < startDate) return '終了日は開始日以降にしてください'
  const travelFee = optionalYen(body.travelFee)
  const pocketMoney = optionalYen(body.pocketMoney)
  if (travelFee === 'error') return '参加費は0以上の整数（円）で入力してください'
  if (pocketMoney === 'error') return '小遣い支給額は0以上の整数（円）で入力してください'
  const notes = typeof body.dashboardNotes === 'string' ? body.dashboardNotes.replace(/\r\n/g, '\n').trim() : ''
  return {
    name,
    destination,
    startDate,
    endDate,
    travelFee,
    pocketMoney,
    dashboardNotes: notes || null,
    modules: normalizeModules(body.modules),
  }
}
