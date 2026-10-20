// 昼食会場（2日目 伊賀の里もくもく手づくりファーム）の席次の定義（API・画面・シードで共通）

// 初期テーブル（全52席・車椅子枠13）。お店の配置図どおり、奥の列は左から 9・8・7・6、手前の列は 16・17〜20・21
export const DEFAULT_LUNCH_TABLES = [
  { tableNo: 9, capacity: 4, wheelchairSlots: 0, layoutRow: 0, layoutOrder: 0 },
  { tableNo: 8, capacity: 4, wheelchairSlots: 0, layoutRow: 0, layoutOrder: 1 },
  { tableNo: 7, capacity: 4, wheelchairSlots: 2, layoutRow: 0, layoutOrder: 2 },
  { tableNo: 6, capacity: 4, wheelchairSlots: 2, layoutRow: 0, layoutOrder: 3 },
  { tableNo: 16, capacity: 4, wheelchairSlots: 2, layoutRow: 1, layoutOrder: 0 },
  { tableNo: 17, capacity: 6, wheelchairSlots: 1, layoutRow: 1, layoutOrder: 1 },
  { tableNo: 18, capacity: 6, wheelchairSlots: 1, layoutRow: 1, layoutOrder: 2 },
  { tableNo: 19, capacity: 6, wheelchairSlots: 1, layoutRow: 1, layoutOrder: 3 },
  { tableNo: 20, capacity: 6, wheelchairSlots: 1, layoutRow: 1, layoutOrder: 4 },
  { tableNo: 21, capacity: 8, wheelchairSlots: 3, layoutRow: 1, layoutOrder: 5 },
]

export interface LunchTable {
  id: number
  tableNo: number
  capacity: number
  wheelchairSlots: number
  layoutRow: number
  layoutOrder: number
}

export interface LunchAssignment {
  personId: number
  tableId: number
}

export interface LunchResponse {
  tables: LunchTable[]
  assignments: LunchAssignment[]
}

// 配置図の行ごとにテーブルを並べる
export function tablesByRow<T extends Pick<LunchTable, 'layoutRow' | 'layoutOrder'>>(tables: T[]): T[][] {
  const rows = new Map<number, T[]>()
  for (const t of tables) rows.set(t.layoutRow, [...(rows.get(t.layoutRow) ?? []), t])
  return [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([, list]) => list.sort((a, b) => a.layoutOrder - b.layoutOrder))
}

// テーブル内の座り方を決める（席番号は保存せず、表示のたびに自動で並べる）
// 車椅子利用者は車椅子枠から、それ以外の人は普通の席から座る。車椅子枠を超えた車椅子利用者は普通の席へ（椅子への移乗が必要）
export function seatPeople<T extends { isWheelchair?: boolean }>(
  table: Pick<LunchTable, 'capacity' | 'wheelchairSlots'>,
  members: T[],
) {
  const normalSlots = Math.max(table.capacity - table.wheelchairSlots, 0)
  const wheelchairUsers = members.filter(m => m.isWheelchair)
  const others = members.filter(m => !m.isWheelchair)

  const wheelchairSeats = wheelchairUsers.slice(0, table.wheelchairSlots)
  const transfer = wheelchairUsers.slice(table.wheelchairSlots) // 車椅子枠に入りきらない車椅子利用者
  const normalCandidates = [...others, ...transfer]
  const normalSeats = normalCandidates.slice(0, normalSlots)
  const overflow = normalCandidates.slice(normalSlots) // 定員を超えて座れない人

  return {
    wheelchairSeats: [...wheelchairSeats, ...Array(table.wheelchairSlots - wheelchairSeats.length).fill(null)] as (T | null)[],
    normalSeats: [...normalSeats, ...Array(normalSlots - normalSeats.length).fill(null)] as (T | null)[],
    overflow,
    transferCount: transfer.length,
    isOverCapacity: members.length > table.capacity,
    isWheelchairOver: wheelchairUsers.length > table.wheelchairSlots,
  }
}
