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
import BanquetPersonCard from '@/components/BanquetPersonCard'
import FishNGBadge from '@/components/FishNGBadge'
import { sortPersons } from '@/lib/bathing'
import {
  BANQUET_COLUMNS,
  isBanquetSeatId,
  moveToSeat,
  tablesOf,
  type BanquetAssignment,
  type BanquetPerson,
} from '@/lib/banquet'

async function loadBoard() {
  const [resA, resP] = await Promise.all([
    fetch('/api/banquet?tripId=1'),
    fetch('/api/persons?tripId=1'),
  ])
  const persons: BanquetPerson[] = await resP.json()
  const assignments: BanquetAssignment[] = await resA.json()
  return {
    persons: persons.filter(p => p.participations?.[0]?.status === '参加'),
    assignments,
  }
}

// 宴会場の席次表（54席）。editable のときはドラッグ＆ドロップで席を割り当てられる
export default function BanquetBoard({ editable = false }: { editable?: boolean }) {
  const [persons, setPersons] = useState<BanquetPerson[]>([])
  const [assignments, setAssignments] = useState<BanquetAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const applyBoard = useCallback((board: Awaited<ReturnType<typeof loadBoard>>) => {
    setPersons(board.persons)
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
  const personBySeat = new Map<string, BanquetPerson>()
  for (const a of assignments) {
    const p = personById.get(a.personId)
    if (p) personBySeat.set(a.seatId, p)
  }
  const seatedIds = new Set(assignments.map(a => a.personId))
  const unassigned = sortPersons(persons.filter(p => !seatedIds.has(p.id)))
  const fishNGCount = persons.filter(p => p.isFishNG).length

  const handleMove = async (personId: number, seatId: string | null) => {
    const from = assignments.find(a => a.personId === personId)?.seatId ?? null
    if (from === seatId) return

    // Optimistic UI
    setAssignments(prev => moveToSeat(prev, personId, seatId))

    const res = await fetch('/api/banquet/assign', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tripId: 1, personId, seatId }),
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
    if (overId === 'unassigned') handleMove(personId, null)
    else if (isBanquetSeatId(overId)) handleMove(personId, overId)
  }

  const activePerson = activeId !== null ? personById.get(activeId) : undefined

  if (loading) return <div className="text-center py-10 text-gray-400">読み込み中...</div>

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-2 rounded-lg text-sm">{error}</div>
        )}

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="bg-white border border-gray-200 rounded-full px-3 py-1 text-gray-700">
            配置済み <b>{assignments.filter(a => personById.has(a.personId)).length}</b> / 参加者 {persons.length}名（54席）
          </span>
          {fishNGCount > 0 && (
            <span className="bg-orange-50 border border-orange-200 rounded-full px-3 py-1 text-orange-800 inline-flex items-center gap-1">
              <FishNGBadge /> 魚料理NG {fishNGCount}名
            </span>
          )}
        </div>

        <div className="flex flex-col 2xl:flex-row gap-5 items-start">
          {(editable || unassigned.length > 0) && (
            <UnassignedPanel persons={unassigned} editable={editable} />
          )}

          {/* 席次表 */}
          <div className="flex-1 w-full overflow-x-auto pb-2">
            <div className="min-w-[680px]">
              <div className="grid grid-cols-3 gap-4">
                {BANQUET_COLUMNS.map(column => (
                  <div key={column.key} className="rounded-2xl bg-amber-50 border-2 border-amber-200 p-3 space-y-3">
                    <div className="text-center text-xs font-bold text-amber-900">{column.label}</div>
                    {tablesOf(column.key).map(table => (
                      <div key={table.key} className="rounded-xl border-2 border-amber-700/30 bg-amber-100/70 p-1.5">
                        <div className="text-[10px] font-semibold text-amber-800 mb-1 px-0.5">{table.label}</div>
                        <div className="grid grid-cols-2 gap-1">
                          {table.seatIds.map(seatId => (
                            <Seat key={seatId} seatId={seatId} person={personBySeat.get(seatId)} editable={editable} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              {/* 舞台 */}
              <div className="mt-4 rounded-xl bg-gradient-to-r from-red-800 via-red-600 to-red-800 py-3 text-center text-white font-bold tracking-[1em] shadow-md">
                舞台
              </div>
            </div>
          </div>
        </div>
      </div>

      <DragOverlay>
        {activePerson ? <BanquetPersonCard person={activePerson} draggable isOverlay /> : null}
      </DragOverlay>
    </DndContext>
  )
}

function Seat({ seatId, person, editable }: { seatId: string; person?: BanquetPerson; editable: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: seatId, disabled: !editable })
  const no = seatId.split('-')[2]

  return (
    <div
      ref={setNodeRef}
      className={`h-10 min-w-0 rounded transition-colors ${
        isOver ? 'ring-2 ring-indigo-400 bg-indigo-50' : ''
      } ${person ? '' : 'border-2 border-dashed border-amber-300 bg-white/60 flex items-center justify-center'}`}
    >
      {person ? (
        <DraggablePerson person={person} editable={editable} compact />
      ) : (
        <span className="text-[10px] text-amber-400">{no}</span>
      )}
    </div>
  )
}

function UnassignedPanel({ persons, editable }: { persons: BanquetPerson[]; editable: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'unassigned', disabled: !editable })
  const groups = [
    { title: 'スタッフ', list: persons.filter(p => p.role === 'STAFF') },
    { title: '利用者', list: persons.filter(p => p.role !== 'STAFF') },
  ]

  return (
    <div
      ref={setNodeRef}
      className={`w-full 2xl:w-64 2xl:shrink-0 2xl:sticky 2xl:top-4 bg-white rounded-2xl border-2 p-4 transition-colors ${
        isOver ? 'border-red-400 bg-red-50 shadow-md' : 'border-gray-200 shadow-sm'
      }`}
    >
      <h3 className="font-bold text-gray-800">未配置 - {persons.length}名</h3>
      {editable && (
        <p className="text-xs text-gray-500 mb-2 print:hidden">長押しで席へドラッグ。ここへ戻すと配置を解除します</p>
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

function DraggablePerson({ person, editable, compact = false }: {
  person: BanquetPerson
  editable: boolean
  compact?: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `person-${person.id}`,
    disabled: !editable,
  })

  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined

  return (
    <BanquetPersonCard
      ref={setNodeRef}
      style={style}
      {...(editable ? { ...listeners, ...attributes } : {})}
      person={person}
      compact={compact}
      draggable={editable}
      isDragging={isDragging}
    />
  )
}
