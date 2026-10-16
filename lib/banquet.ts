// 宴会場の席次レイアウト（54席）
// 縦3列（左・中央・右）。各列は奥（舞台から遠い側）に2名掛けテーブル、その手前に4名掛けテーブル（2x2）が4つ
// 座席IDは "seat-{列}-{番号}"。番号は列ごとに奥から 1〜18（2名席: 1-2、4名席: 3-6, 7-10, 11-14, 15-18）

export const BANQUET_COLUMNS = [
  { key: 'L', label: '左列' },
  { key: 'C', label: '中央列' },
  { key: 'R', label: '右列' },
] as const

export type BanquetColumnKey = (typeof BANQUET_COLUMNS)[number]['key']

export interface BanquetTable {
  key: string
  label: string
  seatIds: string[]
}

export const seatIdOf = (column: BanquetColumnKey, no: number) => `seat-${column}-${no}`

const range = (from: number, count: number) => Array.from({ length: count }, (_, i) => from + i)

// 列ごとのテーブル構成（奥から手前の順）
export function tablesOf(column: BanquetColumnKey): BanquetTable[] {
  return [
    { key: `${column}-0`, label: '2名席', seatIds: range(1, 2).map(n => seatIdOf(column, n)) },
    ...range(1, 4).map(t => ({
      key: `${column}-${t}`,
      label: `テーブル${t}`,
      seatIds: range(3 + (t - 1) * 4, 4).map(n => seatIdOf(column, n)),
    })),
  ]
}

export const BANQUET_SEAT_IDS: string[] = BANQUET_COLUMNS.flatMap(c => tablesOf(c.key).flatMap(t => t.seatIds))

export function isBanquetSeatId(value: unknown): value is string {
  return typeof value === 'string' && BANQUET_SEAT_IDS.includes(value)
}

// 表示用の席名（例: "seat-L-3" → "左列-3"）
export function seatLabel(seatId: string): string {
  const [, column, no] = seatId.split('-')
  const label = BANQUET_COLUMNS.find(c => c.key === column)?.label ?? column
  return `${label}-${no}`
}

export interface BanquetPerson {
  id: number
  name: string
  role: string
  gender: string | null
  isWheelchair?: boolean
  isFishNG?: boolean
  participations?: { status: string }[]
}

export interface BanquetAssignment {
  personId: number
  seatId: string
}

// 人を席へ移動したあとの割り当てを返す（移動先に別の人がいれば、移動元の席と入れ替え。移動元がなければ未割り当てへ）
// seatId が null の場合は割り当て解除。API と画面の楽観的更新の両方で使う
export function moveToSeat(
  assignments: BanquetAssignment[],
  personId: number,
  seatId: string | null,
): BanquetAssignment[] {
  const from = assignments.find(a => a.personId === personId)?.seatId ?? null
  const next: BanquetAssignment[] = []
  for (const a of assignments) {
    if (a.personId === personId) continue
    if (seatId !== null && a.seatId === seatId) {
      if (from !== null) next.push({ personId: a.personId, seatId: from })
      continue
    }
    next.push(a)
  }
  if (seatId !== null) next.push({ personId, seatId })
  return next
}
