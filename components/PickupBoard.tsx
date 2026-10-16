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
  FAMILY_GROUP,
  OTHER_LOCATION,
  PICKUP_LOCATIONS,
  VEHICLE_LOCATIONS,
  isFixedPickupGroupId,
  vehicleGroupId,
  walkGroupId,
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

async function request(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (res.ok) return null
  const data = await res.json().catch(() => ({}))
  return (data.error as string) || '保存に失敗しました'
}

// 集合・送迎の割り当てボード（乗車拠点ごとに表示）
// editable のときはドラッグ＆ドロップでの割り当てと送迎車の設定ができる
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

  const isGroupId = (groupId: string | undefined): groupId is string =>
    !!groupId && (isFixedPickupGroupId(groupId) || vehicles.some(v => vehicleGroupId(v.id) === groupId))

  const groupByPerson = new Map(assignments.map(a => [a.personId, a.groupId]))
  const membersOf = (groupId: string) => sortPersons(persons.filter(p => groupByPerson.get(p.id) === groupId))
  // 削除された送迎車に割り当てられていた人なども未割り当てとして扱う
  const unassigned = sortPersons(persons.filter(p => !isGroupId(groupByPerson.get(p.id))))

  const handleAssign = async (personId: number, groupId: string | null) => {
    if ((groupByPerson.get(personId) ?? null) === groupId) return

    // Optimistic UI
    setAssignments(prev => [
      ...prev.filter(a => a.personId !== personId),
      ...(groupId ? [{ personId, groupId }] : []),
    ])

    setError(await request('/api/pickup/assign', 'PUT', { tripId: 1, personId, groupId }))
    applyBoard(await loadBoard())
  }

  // 送迎車の設定を保存（追加・更新・削除）。id が null の行は新規追加
  const handleSaveVehicles = async (rows: VehicleRow[]) => {
    const keptIds = new Set(rows.map(r => r.id).filter((id): id is number => id !== null))
    const removed = vehicles.filter(v => !keptIds.has(v.id))
    const errors = await Promise.all([
      ...removed.map(v => request(`/api/pickup/vehicles/${v.id}`, 'DELETE')),
      ...rows.map(r => {
        const body = { name: r.name.trim(), capacity: Number(r.capacity), location: r.location }
        if (r.id === null) return request('/api/pickup/vehicles', 'POST', body)
        const cur = vehicles.find(v => v.id === r.id)
        const changed = !cur || cur.name !== body.name || cur.capacity !== body.capacity || cur.location !== body.location
        return changed ? request(`/api/pickup/vehicles/${r.id}`, 'PUT', body) : Promise.resolve(null)
      }),
    ])
    const failed = errors.find(e => e !== null) ?? null
    setError(failed)
    applyBoard(await loadBoard())
    return failed === null
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
    else if (isGroupId(overId)) handleAssign(personId, overId)
  }

  const activePerson = activeId !== null ? persons.find(p => p.id === activeId) : undefined

  if (loading) return <div className="text-center py-10 text-gray-400">読み込み中...</div>

  const familyMembers = membersOf(FAMILY_GROUP.id)
  const otherVehicles = vehicles.filter(v => v.location === OTHER_LOCATION.id)
  const vehicleMemberCount = (list: PickupVehicle[]) =>
    list.reduce((n, v) => n + membersOf(vehicleGroupId(v.id)).length, 0)

  const renderVehicle = (v: PickupVehicle) => {
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
  }

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-2 rounded-lg text-sm">{error}</div>
        )}

        {editable && (
          <VehicleSettings
            vehicles={vehicles}
            memberCount={id => membersOf(vehicleGroupId(id)).length}
            onSave={handleSaveVehicles}
          />
        )}

        <div className="flex flex-col 2xl:flex-row gap-5 items-start">
          {(editable || unassigned.length > 0) && <UnassignedPanel persons={unassigned} editable={editable} />}

          <div className="flex-1 w-full space-y-5">
            {PICKUP_LOCATIONS.map(location => {
              const walkMembers = membersOf(walkGroupId(location.id))
              const locationVehicles = vehicles.filter(v => v.location === location.id)
              const total = walkMembers.length + vehicleMemberCount(locationVehicles)
              return (
                <AreaSection
                  key={location.id}
                  title={location.title}
                  time={location.time}
                  total={total}
                >
                  <GroupBox
                    groupId={walkGroupId(location.id)}
                    editable={editable}
                    colorClass="bg-green-50 border-green-300"
                    title={<>🚶 徒歩でバス停へ移動（{location.label}）</>}
                    count={<>{walkMembers.length}名</>}
                    persons={walkMembers}
                  />
                  {locationVehicles.map(renderVehicle)}
                </AreaSection>
              )
            })}

            {/* 乗車拠点のバス停を通らない人（個別対応・その他の送迎車） */}
            <AreaSection title="その他（個別対応・その他の送迎車）" total={familyMembers.length + vehicleMemberCount(otherVehicles)}>
              <GroupBox
                groupId={FAMILY_GROUP.id}
                editable={editable}
                colorClass="bg-purple-50 border-purple-300"
                title={<>{FAMILY_GROUP.icon} {FAMILY_GROUP.label}</>}
                count={<>{familyMembers.length}名</>}
                persons={familyMembers}
              />
              {otherVehicles.map(renderVehicle)}
            </AreaSection>
          </div>
        </div>
      </div>

      <DragOverlay>
        {activePerson ? <PersonCard person={activePerson} memo={activePerson.pickupMemo} draggable isOverlay /> : null}
      </DragOverlay>
    </DndContext>
  )
}

function AreaSection({ title, time, total, children }: {
  title: string
  time?: string
  total: number
  children: ReactNode
}) {
  return (
    <section className="rounded-2xl border-2 border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-3 bg-slate-700 text-white flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="font-bold">{title}</h2>
        {time && <span className="text-xs font-bold bg-white/20 rounded-full px-2 py-0.5">🕗 {time}</span>}
        <span className="ml-auto text-sm text-slate-200">{total}名</span>
      </div>
      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">{children}</div>
    </section>
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
          <span className="min-w-0 break-words">{title}</span>
          <div className="flex items-center gap-2 text-sm font-medium shrink-0">
            {wheelchairCount > 0 && (
              <span className="bg-pink-200 text-pink-800 px-1.5 py-0.5 rounded-full text-xs">♿️ {wheelchairCount}</span>
            )}
            {count}
          </div>
        </div>
        {warning && <p className="text-xs font-bold text-red-700 mt-0.5">{warning}</p>}
      </div>
      <div className="min-h-[100px] p-3 flex flex-col gap-2">
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

interface VehicleRow {
  key: string
  id: number | null
  name: string
  capacity: string
  location: string
}

const locationLabel = (id: string) => VEHICLE_LOCATIONS.find(l => l.id === id)?.label ?? id

function VehicleSettings({ vehicles, memberCount, onSave }: {
  vehicles: PickupVehicle[]
  memberCount: (vehicleId: number) => number
  onSave: (rows: VehicleRow[]) => Promise<boolean>
}) {
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<VehicleRow[]>([])
  const [saving, setSaving] = useState(false)
  const [newKey, setNewKey] = useState(0)

  const start = () => {
    setRows(vehicles.map(v => ({ key: `v${v.id}`, id: v.id, name: v.name, capacity: String(v.capacity), location: v.location })))
    setOpen(true)
  }
  const update = (key: string, patch: Partial<VehicleRow>) =>
    setRows(r => r.map(v => (v.key === key ? { ...v, ...patch } : v)))
  const add = () => {
    setRows(r => [...r, { key: `new${newKey}`, id: null, name: '', capacity: '4', location: PICKUP_LOCATIONS[0].id }])
    setNewKey(k => k + 1)
  }
  const remove = (row: VehicleRow) => {
    const count = row.id !== null ? memberCount(row.id) : 0
    if (count > 0 && !confirm(`「${row.name}」には${count}名が割り当てられています。削除すると未割り当てに戻ります。よろしいですか？`)) return
    setRows(r => r.filter(v => v.key !== row.key))
  }

  const invalid = rows.some(v => !v.name.trim() || !/^\d+$/.test(v.capacity) || Number(v.capacity) < 1 || Number(v.capacity) > 99)

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={start}
          className="px-4 py-2 rounded-xl bg-slate-700 text-white text-sm font-semibold hover:bg-slate-600"
        >
          ⚙️ 送迎車の設定（名称・定員・所属拠点）
        </button>
        <span className="text-xs text-gray-500">
          {vehicles.length === 0
            ? '送迎車が登録されていません'
            : vehicles.map(v => `${v.name}（${locationLabel(v.location)}・${v.capacity}名）`).join(' ／ ')}
        </span>
      </div>
    )
  }

  const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400'

  return (
    <form
      onSubmit={async e => {
        e.preventDefault()
        if (invalid) return
        setSaving(true)
        const ok = await onSave(rows)
        setSaving(false)
        if (ok) setOpen(false)
      }}
      className="bg-white rounded-2xl border-2 border-slate-300 shadow-sm p-4 space-y-3"
    >
      <h3 className="font-bold text-gray-800">⚙️ 送迎車の設定</h3>
      {rows.length === 0 && <p className="text-sm text-gray-400">送迎車がありません。「＋ 車両を追加」から登録してください。</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {rows.map(v => (
          <div key={v.key} className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-gray-500">{v.id === null ? '新しい車両' : `車両 #${v.id}`}</span>
              <button
                type="button"
                onClick={() => remove(v)}
                className="text-xs text-red-600 hover:bg-red-50 rounded-md px-2 py-1 border border-red-200"
              >
                🗑️ 削除
              </button>
            </div>
            <label className="block">
              <span className="text-xs font-semibold text-gray-600">名称</span>
              <input
                value={v.name}
                onChange={e => update(v.key, { name: e.target.value })}
                placeholder="例: 湯里送迎車"
                className={inputClass}
                required
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-xs font-semibold text-gray-600">定員（名）</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={99}
                  value={v.capacity}
                  onChange={e => update(v.key, { capacity: e.target.value })}
                  className={inputClass}
                  required
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-gray-600">所属拠点</span>
                <select value={v.location} onChange={e => update(v.key, { location: e.target.value })} className={inputClass}>
                  {VEHICLE_LOCATIONS.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
                </select>
              </label>
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap justify-between gap-2">
        <button
          type="button"
          onClick={add}
          className="px-4 py-2 rounded-lg text-sm font-semibold border-2 border-dashed border-blue-300 text-blue-600 hover:bg-blue-50"
        >
          ＋ 車両を追加
        </button>
        <div className="flex gap-2">
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
      </div>
    </form>
  )
}
