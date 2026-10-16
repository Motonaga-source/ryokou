'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
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
import { sortPersons } from '@/lib/bathing'
import {
  PICKUP_GROUPS,
  isPickupGroupId,
  vehicleGroupId,
  type PickupAssignment,
  type PickupResponse,
  type PickupVehicle,
} from '@/lib/pickup'

interface PickupPerson extends CardPerson {
  pickupMemo?: string | null
  participations?: { status: string }[]
}

async function loadBoard() {
  const [resA, resP] = await Promise.all([
    fetch('/api/pickup?tripId=1'),
    fetch('/api/persons?tripId=1'),
  ])
  const pickup: PickupResponse = await resA.json()
  const persons: PickupPerson[] = await resP.json()
  return {
    ...pickup,
    persons: persons.filter(p => p.participations?.[0]?.status === '参加'),
  }
}

// 集合・送迎の割り当てボード。editable のときはドラッグ＆ドロップでの割り当てと送迎車の設定ができる
export default function PickupBoard({ editable = false }: { editable?: boolean }) {
  const [persons, setPersons] = useState<PickupPerson[]>([])
  const [vehicles, setVehicles] = useState<PickupVehicle[]>([])
  const [assignments, setAssignments] = useState<PickupAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const applyBoard = useCallback((board: Awaited<ReturnType<typeof loadBoard>>) => {
    setPersons(board.persons)
    setVehicles(board.vehicles)
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

  const groupByPerson = new Map(assignments.map(a => [a.personId, a.groupId]))
  const membersOf = (groupId: string) => sortPersons(persons.filter(p => groupByPerson.get(p.id) === groupId))
  const unassigned = sortPersons(persons.filter(p => !isPickupGroupId(groupByPerson.get(p.id))))

  const handleAssign = async (personId: number, groupId: string | null) => {
    if ((groupByPerson.get(personId) ?? null) === groupId) return

    // Optimistic UI
    setAssignments(prev => [
      ...prev.filter(a => a.personId !== personId),
      ...(groupId ? [{ personId, groupId }] : []),
    ])

    const res = await fetch('/api/pickup/assign', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tripId: 1, personId, groupId }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error || '保存に失敗しました')
    } else {
      setError(null)
    }
    applyBoard(await loadBoard())
  }

  const handleSaveVehicles = async (next: PickupVehicle[]) => {
    const changed = next.filter(v => {
      const cur = vehicles.find(c => c.id === v.id)
      return !cur || cur.name !== v.name || cur.capacity !== v.capacity
    })
    const results = await Promise.all(changed.map(v => fetch(`/api/pickup/vehicles/${v.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: v.name, capacity: v.capacity }),
    })))
    const failed = results.find(r => !r.ok)
    if (failed) {
      const data = await failed.json().catch(() => ({}))
      setError(data.error || '送迎車の保存に失敗しました')
    } else {
      setError(null)
    }
    applyBoard(await loadBoard())
    return !failed
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
    else if (isPickupGroupId(overId)) handleAssign(personId, overId)
  }

  const activePerson = activeId !== null ? persons.find(p => p.id === activeId) : undefined

  if (loading) return <div className="text-center py-10 text-gray-400">読み込み中...</div>

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-2 rounded-lg text-sm">{error}</div>
        )}

        {editable && <VehicleSettings vehicles={vehicles} onSave={handleSaveVehicles} />}

        <div className="flex flex-col 2xl:flex-row gap-5 items-start">
          {(editable || unassigned.length > 0) && <UnassignedPanel persons={unassigned} editable={editable} />}

          <div className="flex-1 w-full space-y-5">
            {/* 送迎車 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {vehicles.map(v => {
                const members = membersOf(vehicleGroupId(v.id))
                const over = members.length > v.capacity
                return (
                  <GroupBox
                    key={v.id}
                    groupId={vehicleGroupId(v.id)}
                    editable={editable}
                    colorClass={over ? 'bg-red-50 border-red-500' : 'bg-amber-50 border-amber-300'}
                    title={
                      <span className={over ? 'text-red-700' : ''}>
                        🚗 {v.name}<span className="text-sm font-medium">（定員：{v.capacity}名）</span>
                      </span>
                    }
                    count={
                      <span className={over ? 'text-red-700 font-bold' : ''}>{members.length}/{v.capacity}名</span>
                    }
                    warning={over ? `⚠️ 定員オーバー（+${members.length - v.capacity}名）` : undefined}
                    persons={members}
                  />
                )
              })}
            </div>

            {/* 送迎車以外 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {PICKUP_GROUPS.map(g => {
                const members = membersOf(g.id)
                return (
                  <GroupBox
                    key={g.id}
                    groupId={g.id}
                    editable={editable}
                    colorClass={g.colorClass}
                    title={<>{g.icon} {g.label}</>}
                    count={<>{members.length}名</>}
                    persons={members}
                  />
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <DragOverlay>
        {activePerson ? <PersonCard person={activePerson} memo={activePerson.pickupMemo} draggable isOverlay /> : null}
      </DragOverlay>
    </DndContext>
  )
}

function GroupBox({ groupId, editable, colorClass, title, count, warning, persons }: {
  groupId: string
  editable: boolean
  colorClass: string
  title: ReactNode
  count: ReactNode
  warning?: string
  persons: PickupPerson[]
}) {
  const { setNodeRef, isOver } = useDroppable({ id: groupId, disabled: !editable })
  const wheelchairCount = persons.filter(p => p.isWheelchair).length

  return (
    <div
      ref={setNodeRef}
      className={`rounded-2xl border-4 overflow-hidden transition-colors ${colorClass} ${
        isOver ? 'ring-4 ring-indigo-300 shadow-md' : 'shadow-sm'
      }`}
    >
      <div className="px-4 py-2 bg-white/60 border-b-2 border-black/10">
        <div className="font-bold text-base text-gray-800 flex justify-between items-center gap-2">
          <span className="min-w-0 truncate">{title}</span>
          <div className="flex items-center gap-2 text-sm font-medium shrink-0">
            {wheelchairCount > 0 && (
              <span className="bg-pink-200 text-pink-800 px-1.5 py-0.5 rounded-full text-xs">♿️ {wheelchairCount}</span>
            )}
            {count}
          </div>
        </div>
        {warning && <p className="text-xs font-bold text-red-700 mt-0.5">{warning}</p>}
      </div>
      <div className="min-h-[120px] p-3 flex flex-col gap-2">
        {persons.map(p => <DraggablePerson key={p.id} person={p} editable={editable} />)}
      </div>
    </div>
  )
}

function UnassignedPanel({ persons, editable }: { persons: PickupPerson[]; editable: boolean }) {
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
      <h3 className="font-bold text-gray-800">未割り当て - {persons.length}名</h3>
      {editable && (
        <p className="text-xs text-gray-500 mb-2 print:hidden">長押しでドラッグ。ここへ戻すと割り当てを解除します</p>
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
        {persons.length === 0 && <p className="text-sm text-gray-400">全員の集合方法が決まっています</p>}
      </div>
    </div>
  )
}

function DraggablePerson({ person, editable }: { person: PickupPerson; editable: boolean }) {
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
      memo={person.pickupMemo}
      draggable={editable}
      isDragging={isDragging}
    />
  )
}

function VehicleSettings({ vehicles, onSave }: {
  vehicles: PickupVehicle[]
  onSave: (vehicles: PickupVehicle[]) => Promise<boolean>
}) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<{ id: number; name: string; capacity: string }[]>([])
  const [saving, setSaving] = useState(false)

  const start = () => {
    setForm(vehicles.map(v => ({ id: v.id, name: v.name, capacity: String(v.capacity) })))
    setOpen(true)
  }
  const update = (id: number, patch: Partial<{ name: string; capacity: string }>) =>
    setForm(f => f.map(v => (v.id === id ? { ...v, ...patch } : v)))

  const invalid = form.some(v => !v.name.trim() || !/^\d+$/.test(v.capacity) || Number(v.capacity) < 1 || Number(v.capacity) > 99)

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={start}
          className="px-4 py-2 rounded-xl bg-slate-700 text-white text-sm font-semibold hover:bg-slate-600"
        >
          ⚙️ 送迎車の設定（名称・定員）
        </button>
        <span className="text-xs text-gray-500">
          {vehicles.map(v => `${v.name}：${v.capacity}名`).join(' ／ ')}
        </span>
      </div>
    )
  }

  return (
    <form
      onSubmit={async e => {
        e.preventDefault()
        if (invalid) return
        setSaving(true)
        const ok = await onSave(form.map(v => ({ id: v.id, name: v.name.trim(), capacity: Number(v.capacity) })))
        setSaving(false)
        if (ok) setOpen(false)
      }}
      className="bg-white rounded-2xl border-2 border-slate-300 shadow-sm p-4 space-y-3"
    >
      <h3 className="font-bold text-gray-800">⚙️ 送迎車の設定</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {form.map(v => (
          <div key={v.id} className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-2">
            <label className="block">
              <span className="text-xs font-semibold text-gray-600">車両{v.id}の名称</span>
              <input
                value={v.name}
                onChange={e => update(v.id, { name: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                required
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-gray-600">定員（名）</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={99}
                value={v.capacity}
                onChange={e => update(v.id, { capacity: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                required
              />
            </label>
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-4 py-2 rounded-lg text-sm border border-gray-300 text-gray-600 hover:bg-gray-50"
        >
          キャンセル
        </button>
        <button
          type="submit"
          disabled={saving || invalid}
          className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? '保存中...' : '保存'}
        </button>
      </div>
    </form>
  )
}
