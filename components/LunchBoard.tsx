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
import { seatPeople, tablesByRow, type LunchAssignment, type LunchResponse, type LunchTable } from '@/lib/lunch'

interface LunchPerson extends CardPerson {
  participations?: { status: string }[]
}

const tableDropId = (tableId: number) => `lunch-table-${tableId}`

async function loadBoard() {
  const [resL, resP] = await Promise.all([
    fetch('/api/lunch?tripId=1'),
    fetch('/api/persons?tripId=1'),
  ])
  const lunch: LunchResponse = await resL.json()
  const persons: LunchPerson[] = await resP.json()
  return { ...lunch, persons: persons.filter(p => p.participations?.[0]?.status === '参加') }
}

// 昼食会場の席次（テーブル単位の割り当て）。editable のときはドラッグ＆ドロップで割り当てられる
// 定員・車椅子枠の超過は警告表示のみで、割り当ては許容する
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

  const tableIds = new Set(tables.map(t => t.id))
  const tableByPerson = new Map(assignments.filter(a => tableIds.has(a.tableId)).map(a => [a.personId, a.tableId]))
  const membersOf = (tableId: number) => sortPersons(persons.filter(p => tableByPerson.get(p.id) === tableId))
  const unassigned = sortPersons(persons.filter(p => !tableByPerson.has(p.id)))

  const wheelchairUsers = persons.filter(p => p.isWheelchair).length
  const wheelchairSlots = tables.reduce((n, t) => n + t.wheelchairSlots, 0)
  const totalSeats = tables.reduce((n, t) => n + t.capacity, 0)
  const fishNGCount = persons.filter(p => p.isFishNG).length

  const handleAssign = async (personId: number, tableId: number | null) => {
    if ((tableByPerson.get(personId) ?? null) === tableId) return

    // Optimistic UI
    setAssignments(prev => [
      ...prev.filter(a => a.personId !== personId),
      ...(tableId !== null ? [{ personId, tableId }] : []),
    ])

    const res = await fetch('/api/lunch/assign', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tripId: 1, personId, tableId }),
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
    if (overId === 'unassigned') handleAssign(personId, null)
    else if (overId.startsWith('lunch-table-')) handleAssign(personId, Number(overId.replace('lunch-table-', '')))
  }

  const activePerson = activeId !== null ? persons.find(p => p.id === activeId) : undefined

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
              <div className="min-w-[1060px] rounded-2xl border-2 border-stone-300 bg-stone-50 p-3 space-y-6">
                {tablesByRow(tables).map((row, i, rows) => (
                  <div key={i} className="flex items-start gap-2">
                    {row.map(table => (
                      <TableBox key={table.id} table={table} members={membersOf(table.id)} editable={editable} />
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

// PC（幅1280px以上）で手前の列（6卓）が横に収まる幅
const TABLE_WIDTH: Record<number, string> = { 4: 'w-40', 6: 'w-40', 8: 'w-52' }

function TableBox({ table, members, editable }: { table: LunchTable; members: LunchPerson[]; editable: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: tableDropId(table.id), disabled: !editable })
  const seats = seatPeople(table, members)

  const tone = seats.isOverCapacity
    ? 'border-red-500 bg-red-50'
    : seats.isWheelchairOver
    ? 'border-orange-400 bg-orange-50'
    : 'border-amber-600/60 bg-amber-50'

  return (
    <div
      ref={setNodeRef}
      className={`print-avoid-break shrink-0 ${TABLE_WIDTH[table.capacity] ?? 'w-56'} rounded-xl border-2 p-2 transition-colors ${tone} ${
        isOver ? 'ring-4 ring-indigo-300' : ''
      }`}
    >
      <div className="mb-1.5">
        <div className="flex items-baseline justify-between gap-1">
          <span className="font-bold text-gray-800 whitespace-nowrap">テーブル{table.tableNo}</span>
          <span className={`text-xs font-bold whitespace-nowrap ${seats.isOverCapacity ? 'text-red-700' : 'text-gray-600'}`}>
            {members.length}/{table.capacity}名
          </span>
        </div>
        <div className="text-[10px] font-bold text-pink-700 h-3.5">
          {table.wheelchairSlots > 0 ? `♿ 車椅子枠 ${table.wheelchairSlots}` : ''}
        </div>
      </div>

      {/* 車椅子枠（お店の配置図の○印） */}
      {table.wheelchairSlots > 0 && (
        <div className="grid gap-1 mb-1" style={{ gridTemplateColumns: `repeat(${Math.min(table.wheelchairSlots, 2)}, minmax(0, 1fr))` }}>
          {seats.wheelchairSeats.map((p, i) => (
            <Seat key={`w${i}`} person={p} editable={editable} empty="♿" wheelchair />
          ))}
        </div>
      )}

      {/* 普通の席 */}
      <div className="grid grid-cols-2 gap-1">
        {seats.normalSeats.map((p, i) => (
          <Seat key={`n${i}`} person={p} editable={editable} empty="空席" />
        ))}
      </div>

      {seats.isWheelchairOver && !seats.isOverCapacity && (
        <p className="mt-1.5 text-[11px] font-bold text-orange-700">⚠️ 車椅子枠を{seats.transferCount}名超過（椅子への移乗が必要）</p>
      )}
      {seats.isOverCapacity && (
        <div className="mt-1.5">
          <p className="text-[11px] font-bold text-red-700">⚠️ 定員オーバー（+{members.length - table.capacity}名）</p>
          <div className="mt-1 space-y-1">
            {seats.overflow.map(p => <DraggablePerson key={p.id} person={p} editable={editable} compact />)}
          </div>
        </div>
      )}
    </div>
  )
}

function Seat({ person, editable, empty, wheelchair = false }: {
  person: LunchPerson | null
  editable: boolean
  empty: string
  wheelchair?: boolean
}) {
  if (person) {
    return (
      <div className="h-10 min-w-0">
        <DraggablePerson person={person} editable={editable} compact wrapName />
      </div>
    )
  }
  return (
    <div className={`h-10 min-w-0 rounded-lg border-2 border-dashed flex items-center justify-center text-[10px] ${
      wheelchair ? 'border-pink-300 bg-pink-50/60 text-pink-400' : 'border-amber-300 bg-white/60 text-amber-400'
    }`}>
      {empty}
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
        <p className="text-xs text-gray-500 mb-2">長押しでテーブルへドラッグ。ここへ戻すと配置を解除します</p>
      )}
      <div className="max-h-[320px] 2xl:max-h-[calc(100vh-220px)] overflow-y-auto pr-1 space-y-3 mt-2">
        {groups.map(g => g.list.length > 0 && (
          <div key={g.title}>
            <div className="text-xs font-semibold text-gray-500 mb-1.5">{g.title}（{g.list.length}名）</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 2xl:grid-cols-1 gap-2">
              {g.list.map(p => <DraggablePerson key={p.id} person={p} editable={editable} />)}
            </div>
          </div>
        ))}
        {persons.length === 0 && <p className="text-sm text-gray-400">全員の席が決まっています</p>}
      </div>
    </div>
  )
}

function DraggablePerson({ person, editable, compact = false, wrapName = false }: {
  person: LunchPerson
  editable: boolean
  compact?: boolean
  wrapName?: boolean
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
      compact={compact}
      wrapName={wrapName}
      draggable={editable}
      isDragging={isDragging}
    />
  )
}
