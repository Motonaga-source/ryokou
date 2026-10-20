// 昼食会場（2日目 伊賀の里もくもく手づくりファーム）の席次の定義（API・画面・シードで共通）

// テーブル定義（全52席・車椅子枠15）。お店の配置図どおり、奥の列は左から 9・8・7・6、手前の列は 16・17〜20・21
// 管理画面に設定欄はないため、変更したらこの定義を直して npm run db:seed-lunch-tables で DB に反映する
export const DEFAULT_LUNCH_TABLES = [
  { tableNo: 9, capacity: 4, wheelchairSlots: 1, layoutRow: 0, layoutOrder: 0 },
  { tableNo: 8, capacity: 4, wheelchairSlots: 1, layoutRow: 0, layoutOrder: 1 },
  { tableNo: 7, capacity: 4, wheelchairSlots: 2, layoutRow: 0, layoutOrder: 2 },
  { tableNo: 6, capacity: 4, wheelchairSlots: 2, layoutRow: 0, layoutOrder: 3 },
  { tableNo: 16, capacity: 4, wheelchairSlots: 2, layoutRow: 1, layoutOrder: 0 },
  { tableNo: 17, capacity: 6, wheelchairSlots: 1, layoutRow: 1, layoutOrder: 1 },
  { tableNo: 18, capacity: 6, wheelchairSlots: 1, layoutRow: 1, layoutOrder: 2 },
  { tableNo: 19, capacity: 6, wheelchairSlots: 1, layoutRow: 1, layoutOrder: 3 },
  { tableNo: 20, capacity: 6, wheelchairSlots: 1, layoutRow: 1, layoutOrder: 4 },
  { tableNo: 21, capacity: 8, wheelchairSlots: 3, layoutRow: 1, layoutOrder: 5 },
]

// テーブル内で車椅子枠を描く位置（お店の配置図の○印の位置）。指定がないテーブルは上側に横並び
// テーブル7は右側（テーブル6との間の通路側）、テーブル6は左側（テーブル7との間の通路側）に縦並び
export type WheelchairSide = 'top' | 'left' | 'right'
export const WHEELCHAIR_SIDE: Record<number, WheelchairSide> = { 7: 'right', 6: 'left' }
export const wheelchairSideOf = (tableNo: number): WheelchairSide => WHEELCHAIR_SIDE[tableNo] ?? 'top'

export interface LunchTable {
  id: number
  tableNo: number
  capacity: number
  wheelchairSlots: number
  layoutRow: number
  layoutOrder: number
}

// 席は seatIndex（0 から）で表す。先頭の wheelchairSlots 個が車椅子枠、残りが普通の席
export interface LunchSeatRef {
  tableId: number
  seatIndex: number
}

export interface LunchAssignment extends LunchSeatRef {
  personId: number
}

export interface LunchResponse {
  tables: LunchTable[]
  assignments: LunchAssignment[]
}

export const isWheelchairSeat = (table: Pick<LunchTable, 'wheelchairSlots'>, seatIndex: number) =>
  seatIndex < table.wheelchairSlots

export const isValidSeatIndex = (table: Pick<LunchTable, 'capacity'>, seatIndex: unknown): seatIndex is number =>
  Number.isInteger(seatIndex) && (seatIndex as number) >= 0 && (seatIndex as number) < table.capacity

// ドラッグ＆ドロップの席ID（例: "table-12-seat-3"）
export const seatDropId = ({ tableId, seatIndex }: LunchSeatRef) => `table-${tableId}-seat-${seatIndex}`

export function parseSeatDropId(id: string): LunchSeatRef | null {
  const m = id.match(/^table-(\d+)-seat-(\d+)$/)
  return m ? { tableId: Number(m[1]), seatIndex: Number(m[2]) } : null
}

const sameSeat = (a: LunchSeatRef, b: LunchSeatRef) => a.tableId === b.tableId && a.seatIndex === b.seatIndex

// 人を席へ移動したあとの割り当てを返す（宴会席順と同じルール）
// 移動先に別の人がいれば移動元の席と入れ替え、移動元がなければその人は未配置へ。target が null なら配置解除
// API と画面の楽観的更新の両方で使う
export function moveToLunchSeat(
  assignments: LunchAssignment[],
  personId: number,
  target: LunchSeatRef | null,
): LunchAssignment[] {
  const from = assignments.find(a => a.personId === personId)
  const next: LunchAssignment[] = []
  for (const a of assignments) {
    if (a.personId === personId) continue
    if (target && sameSeat(a, target)) {
      if (from) next.push({ personId: a.personId, tableId: from.tableId, seatIndex: from.seatIndex })
      continue
    }
    next.push(a)
  }
  if (target) next.push({ personId, ...target })
  return next
}

// 配置図の行ごとにテーブルを並べる
export function tablesByRow<T extends Pick<LunchTable, 'layoutRow' | 'layoutOrder'>>(tables: T[]): T[][] {
  const rows = new Map<number, T[]>()
  for (const t of tables) rows.set(t.layoutRow, [...(rows.get(t.layoutRow) ?? []), t])
  return [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([, list]) => list.sort((a, b) => a.layoutOrder - b.layoutOrder))
}
