'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import PersonCard, { type CardPerson } from '@/components/PersonCard'
import FishNGBadge from '@/components/FishNGBadge'
import { sortPersons } from '@/lib/bathing'
import {
  isWheelchairSeat,
  moveToLunchSeat,
  parseSeatDropId,
  seatDropId,
  tablesByRow,
  wheelchairSideOf,
  type LunchAssignment,
  type LunchResponse,
  type LunchSeatRef,
  type LunchTable,
} from '@/lib/lunch'

interface LunchPerson extends CardPerson {
  participations?: { status: string }[]
}

async function loadBoard() {
  const [resL, resP] = await Promise.all([
    fetch('/api/lunch?tripId=1'),
    fetch('/api/persons?tripId=1'),
  ])
  const lunch: LunchResponse = await resL.json()
  const persons: LunchPerson[] = await resP.json()
  return { ...lunch, persons: persons.filter(p => p.participations?.[0]?.status === '参加') }
}

// 昼食会場の席次（座席単位の割り当て）。editable のときは席へドラッグ＆ドロップで配置でき、座っている人の席に落とすと入れ替わる
// 車椅子枠と普通の席の使い方が合わない場合は警告表示のみで、配置は許容する
export default function LunchBoard({ editable = false }: { editable?: boolean }) {
  const [persons, setPersons] = useState<LunchPerson[]>([])
  const [tables, setTables] = useState<LunchTable[]>([])
  const [assignments, setAssignments] = useState<LunchAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const applyBoard = useCallback((board: Awaited<ReturnType<typeof loadBoard>>) => {
    setPersons(board.persons)
    setTables(board.tables)
    setAssignments(board.assignments)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadBoard().then(applyBoard)
  }, [applyBoard])

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  )

  const personById = new Map(persons.map(p => [p.id, p]))
  const tableIds = new Set(tables.map(t => t.id))
  const valid = assignments.filter(a => tableIds.has(a.tableId) && personById.has(a.personId))
  const personAt = (seat: LunchSeatRef) => {
    const a = valid.find(x => x.tableId === seat.tableId && x.seatIndex === seat.seatIndex)
    return a ? personById.get(a.personId) ?? null : null
  }
  const seatedIds = new Set(valid.map(a => a.personId))
  const unassigned = sortPersons(persons.filter(p => !seatedIds.has(p.id)))

  const wheelchairUsers = persons.filter(p => p.isWheelchair).length
  const wheelchairSlots = tables.reduce((n, t) => n + t.wheelchairSlots, 0)
  const totalSeats = tables.reduce((n, t) => n + t.capacity, 0)
  const fishNGCount = persons.filter(p => p.isFishNG).length

  const handleMove = async (personId: number, target: LunchSeatRef | null) => {
    const from = assignments.find(a => a.personId === personId)
    if (!from && !target) return
    if (from && target && from.tableId === target.tableId && from.seatIndex === target.seatIndex) return

    // Optimistic UI
    setAssignments(prev => moveToLunchSeat(prev, personId, target))

    const res = await fetch('/api/lunch/assign', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tripId: 1, personId, tableId: target?.tableId ?? null, seatIndex: target?.seatIndex }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error || '保存に失敗しました')
    } else {
      setError(null)
    }
    applyBoard(await loadBoard())
  }

  const onDragStart = (event: DragStartEvent) => {
    setActiveId(Number(String(event.active.id).replace('person-', '')))
  }

  const onDragEnd = (event: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = event
    if (!over) return
    const personId = Number(String(active.id).replace('person-', ''))
    const overId = String(over.id)
    if (overId === 'unassigned') {
      handleMove(personId, null)
      return
    }
    const seat = parseSeatDropId(overId)
    if (seat) handleMove(personId, seat)
  }

  const activePerson = activeId !== null ? personById.get(activeId) : undefined

  if (loading) return <div className="text-center py-10 text-gray-400">読み込み中...</div>

  if (tables.length === 0) {
    return (
      <div className="bg-amber-50 border border-amber-300 text-amber-800 rounded-xl px-4 py-3 text-sm">
        昼食会場のテーブルが登録されていません。<code className="mx-1">npm run db:seed-lunch-tables</code>で登録してください。
      </div>
    )
  }

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-2 rounded-lg text-sm">{error}</div>
        )}

        {/* 全体の状況 */}
        <div className="flex flex-wrap items-center gap-2 text-sm print:hidden">
          <span className="bg-white border border-gray-200 rounded-full px-3 py-1 text-gray-700">
            配置済み <b>{persons.length - unassigned.length}</b> / 参加者 {persons.length}名（{tables.length}卓・{totalSeats}席）
          </span>
          <span className={`border rounded-full px-3 py-1 ${
            wheelchairUsers > wheelchairSlots ? 'bg-orange-50 border-orange-300 text-orange-800 font-bold' : 'bg-pink-50 border-pink-200 text-pink-800'
          }`}>
            ♿️ 車椅子利用 {wheelchairUsers}名 ／ 車椅子枠 {wheelchairSlots}
            {wheelchairUsers > wheelchairSlots && `（${wheelchairUsers - wheelchairSlots}名分不足：椅子への移乗が必要）`}
          </span>
          {fishNGCount > 0 && (
            <span className="bg-orange-50 border border-orange-200 rounded-full px-3 py-1 text-orange-800 inline-flex items-center gap-1">
              <FishNGBadge /> 魚料理NG {fishNGCount}名
            </span>
          )}
        </div>

        <div className="flex flex-col 2xl:flex-row gap-5 items-start">
          {(editable || unassigned.length > 0) && <UnassignedPanel persons={unassigned} editable={editable} />}

          {/* 配置図: スマホ・タブレットではこの枠の中だけを横スクロールする */}
          <div className="flex-1 min-w-0 w-full">
            <p className="2xl:hidden text-xs text-gray-500 mb-1.5 print:hidden">← 画面に収まらないときは、配置図を左右にスクロールできます →</p>
            <div className="w-full overflow-x-auto overscroll-x-contain pb-2 print:overflow-visible">
              <div className="min-w-[1110px] rounded-2xl border-2 border-stone-300 bg-stone-50 p-3 space-y-6">
                {tablesByRow(tables).map((row, i, rows) => (
                  <div key={i} className="flex items-start gap-1.5">
                    {row.map(table => (
                      <TableBox key={table.id} table={table} personAt={personAt} editable={editable} />
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
            </div>
          </div>
        </div>
      </div>

      <DragOverlay>
        {activePerson ? <PersonCard person={activePerson} draggable isOverlay /> : null}
      </DragOverlay>
    </DndContext>
  )
}

// PC（幅1280px以上）で手前の列（6卓）が横に収まる幅。8名卓は車椅子枠3つを横一列に並べられる幅にする
const TABLE_WIDTH: Record<number, string> = { 4: 'w-40', 6: 'w-40', 8: 'w-60' }

function TableBox({ table, personAt, editable }: {
  table: LunchTable
  personAt: (seat: LunchSeatRef) => LunchPerson | null
  editable: boolean
}) {
  const seats = Array.from({ length: table.capacity }, (_, seatIndex) => ({
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
    seats.filter(s => s.wheelchair === wheelchair).map(s => (
      <Seat key={s.seatIndex} table={table} seatIndex={s.seatIndex} person={s.person} wheelchair={wheelchair} editable={editable} />
    ))
  const wheelchairCells = cells(true)
  const normalCells = cells(false)

  return (
    <div className={`print-avoid-break shrink-0 ${TABLE_WIDTH[table.capacity] ?? 'w-56'} rounded-xl border-2 p-2 ${
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

function Seat({ table, seatIndex, person, wheelchair, editable }: {
  table: LunchTable
  seatIndex: number
  person: LunchPerson | null
  wheelchair: boolean
  editable: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({ id: seatDropId({ tableId: table.id, seatIndex }), disabled: !editable })
  const mismatch = person && person.isWheelchair !== wheelchair

  return (
    <div
      ref={setNodeRef}
      className={`relative h-11 min-w-0 rounded-lg transition-colors ${isOver ? 'ring-2 ring-indigo-400' : ''} ${
        person
          ? ''
          : `border-2 border-dashed flex items-center justify-center text-[10px] ${
              wheelchair ? 'border-pink-300 bg-pink-50/60 text-pink-400' : 'border-amber-300 bg-white/60 text-amber-400'
            } ${isOver ? 'bg-indigo-50' : ''}`
      }`}
    >
      {person ? (
        <>
          <DraggablePerson person={person} editable={editable} hideWheelchairIcon={wheelchair && person.isWheelchair} />
          {mismatch && (
            <span className="absolute -top-1.5 -right-1.5 z-10 text-xs leading-none" title={wheelchair ? '車椅子枠に車椅子以外の方' : '車椅子の方が普通の席（移乗が必要）'}>⚠️</span>
          )}
        </>
      ) : (
        wheelchair ? '♿' : '空席'
      )}
    </div>
  )
}

function UnassignedPanel({ persons, editable }: { persons: LunchPerson[]; editable: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'unassigned', disabled: !editable })
  const groups = [
    { title: 'スタッフ', list: persons.filter(p => p.role === 'STAFF') },
    { title: '利用者', list: persons.filter(p => p.role !== 'STAFF') },
  ]

  return (
    <div
      ref={setNodeRef}
      className={`print:hidden w-full 2xl:w-64 2xl:shrink-0 2xl:sticky 2xl:top-4 bg-white rounded-2xl border-2 p-4 transition-colors ${
        isOver ? 'border-red-400 bg-red-50 shadow-md' : 'border-gray-200 shadow-sm'
      }`}
    >
      <h3 className="font-bold text-gray-800">未配置 - {persons.length}名</h3>
      {editable && (
        <p className="text-xs text-gray-500 mb-2">長押しで席へドラッグ。座っている人の席に落とすと入れ替わります。ここへ戻すと配置を解除します</p>
      )}
      <div className="max-h-[320px] 2xl:max-h-[calc(100vh-220px)] overflow-y-auto pr-1 space-y-3 mt-2">
        {groups.map(g => g.list.length > 0 && (
          <div key={g.title}>
            <div className="text-xs font-semibold text-gray-500 mb-1.5">{g.title}（{g.list.length}名）</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 2xl:grid-cols-1 gap-2">
              {g.list.map(p => <DraggablePerson key={p.id} person={p} editable={editable} list />)}
            </div>
          </div>
        ))}
        {persons.length === 0 && <p className="text-sm text-gray-400">全員の席が決まっています</p>}
      </div>
    </div>
  )
}

// list: 未配置一覧用の通常サイズ。それ以外は席に収まる小さい表示（名前は省略せず折り返す）
function DraggablePerson({ person, editable, list = false, hideWheelchairIcon = false }: {
  person: LunchPerson
  editable: boolean
  list?: boolean
  hideWheelchairIcon?: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `person-${person.id}`,
    disabled: !editable,
  })
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined

  return (
    <PersonCard
      ref={setNodeRef}
      style={style}
      {...(editable ? { ...listeners, ...attributes } : {})}
      person={person}
      compact={!list}
      wrapName={!list}
      hideWheelchairIcon={hideWheelchairIcon}
      draggable={editable}
      isDragging={isDragging}
    />
  )
}
