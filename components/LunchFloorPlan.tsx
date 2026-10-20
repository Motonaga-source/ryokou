import { forwardRef, type HTMLAttributes, type ReactNode } from 'react'
import PersonCard, { type CardPerson } from '@/components/PersonCard'
import { isWheelchairSeat, tablesByRow, wheelchairSideOf, type LunchSeatRef, type LunchTable } from '@/lib/lunch'

// 昼食会場の配置図（奥の列・手前の列・レジカウンター、各テーブルの座席マス）
// ドラッグ＆ドロップは含まない表示専用の部品。管理画面・閲覧画面（LunchBoard）と印刷用まとめページで共通に使う

export interface SeatInfo<P extends CardPerson = CardPerson> extends LunchSeatRef {
  table: LunchTable
  wheelchair: boolean // 車椅子枠の席か
  person: P | null
}

// PC（幅1280px以上）で手前の列（6卓）が横に収まる幅。8名卓は車椅子枠3つを横一列に並べられる幅にする
const TABLE_WIDTH: Record<number, string> = { 4: 'w-40', 6: 'w-40', 8: 'w-60' }

// 配置図全体の最小幅（これより狭い画面では外側で横スクロール、印刷では縮小して収める）
export const FLOOR_PLAN_WIDTH_PX = 1110

export function LunchFloorPlan<P extends CardPerson>({ tables, personAt, renderSeat }: {
  tables: LunchTable[]
  personAt: (seat: LunchSeatRef) => P | null
  // 席の描き方（管理画面ではドロップ可能な席にする）。省略時は表示専用の席
  renderSeat?: (seat: SeatInfo<P>) => ReactNode
}) {
  return (
    <div className="rounded-2xl border-2 border-stone-300 bg-stone-50 p-3 space-y-6" style={{ minWidth: FLOOR_PLAN_WIDTH_PX }}>
      {tablesByRow(tables).map((row, i, rows) => (
        <div key={i} className="flex items-start gap-1.5">
          {row.map(table => (
            <TableBox key={table.id} table={table} personAt={personAt} renderSeat={renderSeat ?? (s => <StaticSeat seat={s} />)} />
          ))}
          {/* お店の配置図の目印（手前の列の右端） */}
          {i === rows.length - 1 && (
            <div className="ml-auto shrink-0 self-stretch w-7 rounded border-2 border-stone-400 bg-stone-200 text-stone-600 text-[11px] font-bold flex items-center justify-center [writing-mode:vertical-rl] tracking-widest">
              レジカウンター
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function TableBox<P extends CardPerson>({ table, personAt, renderSeat }: {
  table: LunchTable
  personAt: (seat: LunchSeatRef) => P | null
  renderSeat: (seat: SeatInfo<P>) => ReactNode
}) {
  const seats: SeatInfo<P>[] = Array.from({ length: table.capacity }, (_, seatIndex) => ({
    table,
    tableId: table.id,
    seatIndex,
    wheelchair: isWheelchairSeat(table, seatIndex),
    person: personAt({ tableId: table.id, seatIndex }),
  }))
  const members = seats.filter(s => s.person).length
  // 車椅子利用者が普通の席（椅子への移乗が必要）／車椅子以外の人が車椅子枠（椅子がない）に座っている数
  const transferCount = seats.filter(s => !s.wheelchair && s.person?.isWheelchair).length
  const noChairCount = seats.filter(s => s.wheelchair && s.person && !s.person.isWheelchair).length
  const side = wheelchairSideOf(table.tableNo)

  const cells = (wheelchair: boolean) =>
    seats.filter(s => s.wheelchair === wheelchair).map(s => <div key={s.seatIndex} className="min-w-0">{renderSeat(s)}</div>)
  const wheelchairCells = cells(true)
  const normalCells = cells(false)

  return (
    <div className={`print-avoid-break break-inside-avoid shrink-0 ${TABLE_WIDTH[table.capacity] ?? 'w-56'} rounded-xl border-2 p-2 ${
      transferCount || noChairCount ? 'border-orange-400 bg-orange-50' : 'border-amber-600/60 bg-amber-50'
    }`}>
      <div className="mb-1.5">
        <div className="flex items-baseline justify-between gap-1">
          <span className="font-bold text-gray-800 whitespace-nowrap">テーブル{table.tableNo}</span>
          <span className="text-xs font-bold whitespace-nowrap text-gray-600">{members}/{table.capacity}名</span>
        </div>
        <div className="text-[10px] font-bold text-pink-700 h-3.5">
          {table.wheelchairSlots > 0 ? `♿ 車椅子枠 ${table.wheelchairSlots}` : ''}
        </div>
      </div>

      {side === 'top' ? (
        <>
          {/* 車椅子枠（お店の配置図の○印）を上側に横一列 */}
          {table.wheelchairSlots > 0 && (
            <div className="grid gap-1 mb-1" style={{ gridTemplateColumns: `repeat(${Math.min(table.wheelchairSlots, 3)}, minmax(0, 1fr))` }}>
              {wheelchairCells}
            </div>
          )}
          {/* 普通の席 */}
          <div className="grid grid-cols-2 gap-1">{normalCells}</div>
        </>
      ) : (
        // 車椅子枠を左右どちらかの縦一列に（テーブル7は右、テーブル6は左）
        <div className="grid grid-cols-2 gap-1">
          <div className="flex flex-col gap-1">{side === 'left' ? wheelchairCells : normalCells}</div>
          <div className="flex flex-col gap-1">{side === 'left' ? normalCells : wheelchairCells}</div>
        </div>
      )}

      {transferCount > 0 && (
        <p className="mt-1.5 text-[11px] font-bold text-orange-700">⚠️ 車椅子の方が普通の席に{transferCount}名（椅子への移乗が必要）</p>
      )}
      {noChairCount > 0 && (
        <p className="mt-1 text-[11px] font-bold text-orange-700">⚠️ 車椅子枠に車椅子以外の方が{noChairCount}名（椅子の用意が必要）</p>
      )}
    </div>
  )
}

// 席のマスの見た目（空席の点線・車椅子枠のピンク・使い方が合わないときの ⚠️）。ref はドロップ先にするときに使う
type SeatFrameProps = HTMLAttributes<HTMLDivElement> & {
  wheelchair: boolean
  person: CardPerson | null
  isOver?: boolean
}

export const SeatFrame = forwardRef<HTMLDivElement, SeatFrameProps>(function SeatFrame(
  { wheelchair, person, isOver = false, children, className = '', ...rest },
  ref,
) {
  const mismatch = person && !!person.isWheelchair !== wheelchair
  return (
    <div
      ref={ref}
      {...rest}
      className={`relative h-11 min-w-0 rounded-lg transition-colors ${isOver ? 'ring-2 ring-indigo-400' : ''} ${
        person
          ? ''
          : `border-2 border-dashed flex items-center justify-center text-[10px] ${
              wheelchair ? 'border-pink-300 bg-pink-50/60 text-pink-400' : 'border-amber-300 bg-white/60 text-amber-400'
            } ${isOver ? 'bg-indigo-50' : ''}`
      } ${className}`}
    >
      {person ? (
        <>
          {children}
          {mismatch && (
            <span className="absolute -top-1.5 -right-1.5 z-10 text-xs leading-none" title={wheelchair ? '車椅子枠に車椅子以外の方' : '車椅子の方が普通の席（移乗が必要）'}>⚠️</span>
          )}
        </>
      ) : (
        wheelchair ? '♿' : '空席'
      )}
    </div>
  )
})

// 表示専用の席（印刷用まとめページなど）
function StaticSeat<P extends CardPerson>({ seat }: { seat: SeatInfo<P> }) {
  return (
    <SeatFrame wheelchair={seat.wheelchair} person={seat.person}>
      {seat.person && (
        <PersonCard person={seat.person} compact wrapName hideWheelchairIcon={seat.wheelchair && !!seat.person.isWheelchair} />
      )}
    </SeatFrame>
  )
}
