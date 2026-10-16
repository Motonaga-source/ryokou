'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDraggable,
  useDroppable,
  DragStartEvent,
  DragEndEvent
} from '@dnd-kit/core'
import BathingPersonCard from '@/components/BathingPersonCard'
import {
  BATHING_ROLES,
  BATH_BADGES,
  buildBathingBoard,
  isBathingRole,
  sortPersons,
  type BanNumber,
  type BathingBoard,
  type BathingPerson,
  type BathingRoleValue,
} from '@/lib/bathing'

async function loadBoard() {
  const [resA, resP] = await Promise.all([
    fetch('/api/bathing?tripId=1'),
    fetch('/api/persons?tripId=1'),
  ])
  const persons: BathingPerson[] = await resP.json()
  return buildBathingBoard(persons, await resA.json())
}

export default function AdminBathingPage() {
  const [groups, setGroups] = useState<BathingBoard | null>(null)
  const [unassigned, setUnassigned] = useState<BathingPerson[]>([])
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const applyBoard = useCallback((board: ReturnType<typeof buildBathingBoard>) => {
    setGroups(board.groups)
    setUnassigned(board.unassigned)
    setLoading(false)
  }, [])

  const fetchBoard = useCallback(async () => {
    applyBoard(await loadBoard())
  }, [applyBoard])

  useEffect(() => {
    loadBoard().then(applyBoard)
  }, [applyBoard])

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  )

  const getPerson = (id: string) => {
    const pid = parseInt(id.replace('person-', ''))
    const all = [...unassigned, ...(groups ? Object.values(groups).flat() : [])]
    return all.find(p => p.id === pid)
  }

  const handleAssign = async (personId: number, role: BathingRoleValue | null) => {
    const person = getPerson(`person-${personId}`)
    if (!person || !groups) return

    // Optimistic UI: 移動元から外し、移動先に追加してソート
    const nextGroups = Object.fromEntries(
      BATHING_ROLES.map(r => {
        const rest = groups[r.value].filter(p => p.id !== personId)
        return [r.value, r.value === role ? sortPersons([...rest, person]) : rest]
      })
    ) as BathingBoard
    const restUnassigned = unassigned.filter(p => p.id !== personId)
    setGroups(nextGroups)
    setUnassigned(role === null ? sortPersons([...restUnassigned, { ...person, banNumber: null }]) : restUnassigned)

    const res = await fetch('/api/bathing/assign', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tripId: 1, personId, role }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error || '保存に失敗しました')
    } else {
      setError(null)
    }
    await fetchBoard()
  }

  const handleBanChange = async (personId: number, banNumber: BanNumber | null) => {
    if (!groups) return

    // Optimistic UI: 班を書き換えて枠内を並べ直す
    setGroups(Object.fromEntries(
      BATHING_ROLES.map(r => {
        const list = groups[r.value]
        if (!list.some(p => p.id === personId)) return [r.value, list]
        return [r.value, sortPersons(list.map(p => (p.id === personId ? { ...p, banNumber } : p)))]
      })
    ) as BathingBoard)

    const res = await fetch('/api/bathing/assign', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tripId: 1, personId, banNumber }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error || '班の保存に失敗しました')
    } else {
      setError(null)
    }
    await fetchBoard()
  }

  const onDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const onDragEnd = (event: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = event
    if (!over) return

    const personId = parseInt((active.id as string).replace('person-', ''))
    const overId = over.id as string

    if (overId.startsWith('unassigned')) {
      handleAssign(personId, null)
    } else if (overId.startsWith('bathing-')) {
      const role = overId.replace('bathing-', '')
      if (isBathingRole(role)) handleAssign(personId, role)
    }
  }

  const activePerson = activeId ? getPerson(activeId) : null

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="space-y-5 pt-12 lg:pt-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">♨️ 入浴管理</h1>
          <p className="text-sm text-gray-500">長押しでドラッグ＆ドロップして入浴の役割・配置を振り分けます。</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-2 rounded-lg text-sm">{error}</div>
        )}

        {loading || !groups ? (
          <div className="text-center py-10 text-gray-400">読み込み中...</div>
        ) : (
          <div className="flex flex-col xl:flex-row gap-6 items-start">

            {/* 左カラム: 未割り当て（スタッフ） */}
            <div className="w-full xl:w-56 shrink-0 order-2 xl:order-1">
              <DroppableUnassigned persons={unassigned} role="STAFF" title="スタッフ" />
            </div>

            {/* 中央カラム: 入浴グループ（男湯・女湯を左右に並べる） */}
            <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-3 order-1 xl:order-2">
              {BATHING_ROLES.map(r => (
                <DroppableGroup key={r.value} group={r} persons={groups[r.value]} onBanChange={handleBanChange} />
              ))}
            </div>

            {/* 右カラム: 未割り当て（利用者） */}
            <div className="w-full xl:w-56 shrink-0 order-3 xl:order-3">
              <DroppableUnassigned persons={unassigned} role="USER" title="利用者" />
            </div>

          </div>
        )}
      </div>

      <DragOverlay>
        {activePerson ? <BathingPersonCard person={activePerson} draggable isOverlay banMode="label" /> : null}
      </DragOverlay>
    </DndContext>
  )
}

function DroppableGroup({ group, persons, onBanChange }: {
  group: (typeof BATHING_ROLES)[number]
  persons: BathingPerson[]
  onBanChange: (personId: number, banNumber: BanNumber | null) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `bathing-${group.value}` })
  const wheelchairCount = persons.filter(p => p.isWheelchair).length
  const staffCount = persons.filter(p => p.role === 'STAFF').length

  return (
    <div
      ref={setNodeRef}
      className={`rounded-2xl border-4 transition-colors overflow-hidden ${
        isOver ? 'border-indigo-400 shadow-md opacity-80' : 'shadow-sm'
      } ${group.colorClass}`}
    >
      <div className="px-4 py-3 md:py-2 bg-white/50 border-b-2 border-black/10">
        <div className="font-bold text-base text-gray-800 flex justify-between items-center gap-2">
          <span className="min-w-0 flex items-center gap-1.5">
            <span className="truncate">{group.icon} {group.baseLabel}</span>
            {group.bath && (
              <span className={`shrink-0 px-1.5 py-0.5 rounded-md text-xs font-bold ${BATH_BADGES[group.bath].className}`}>
                {BATH_BADGES[group.bath].label}
              </span>
            )}
          </span>
          <div className="flex items-center gap-2 text-sm font-medium opacity-80 shrink-0">
            {wheelchairCount > 0 && (
              <span className="bg-pink-200 text-pink-800 px-1.5 py-0.5 rounded-full text-xs">
                ♿️ {wheelchairCount}
              </span>
            )}
            <span>{persons.length}名</span>
          </div>
        </div>
        <p className="text-xs text-gray-600">{group.description}（スタッフ{staffCount}名）</p>
      </div>
      <div className="min-h-[140px] p-3 flex flex-col gap-2">
        {persons.map(p => (
          <DraggablePerson key={p.id} person={p} onBanChange={ban => onBanChange(p.id, ban)} />
        ))}
      </div>
    </div>
  )
}

function DroppableUnassigned({ persons, role, title }: { persons: BathingPerson[], role: string, title: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: `unassigned-${role}` })
  const filtered = persons.filter(p => p.role === role)

  return (
    <div
      ref={setNodeRef}
      className={`bg-white rounded-2xl border-2 p-4 transition-colors ${
        isOver ? 'border-red-400 bg-red-50 shadow-md' : 'border-gray-200 shadow-sm'
      }`}
      style={{ minHeight: '300px' }}
    >
      <h3 className="font-bold text-gray-800 mb-1">未割り当て ({title}) - {filtered.length}名</h3>
      <p className="text-xs text-gray-500 mb-3 print:hidden">ここへドロップすると割り当てが解除されます</p>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-1 gap-3 max-h-[400px] xl:max-h-[600px] overflow-y-auto pr-1">
        {filtered.map(p => (
          <DraggablePerson key={p.id} person={p} />
        ))}
      </div>
    </div>
  )
}

// onBanChange を渡した場合（役割の枠内）のみ班の切り替えボタンを表示する
function DraggablePerson({ person, onBanChange }: {
  person: BathingPerson
  onBanChange?: (banNumber: BanNumber | null) => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `person-${person.id}`,
    data: person,
  })

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined

  return (
    <BathingPersonCard
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      person={person}
      draggable
      isDragging={isDragging}
      banMode={onBanChange ? 'edit' : undefined}
      onBanChange={onBanChange}
    />
  )
}
