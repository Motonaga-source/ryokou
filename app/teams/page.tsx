'use client'
type DragStartEvent = any;
type DragEndEvent = any;
import { useState, useEffect, useCallback } from 'react';


const DndContext = ({children}: any) => <>{children}</>;
const DragOverlay = ({children}: any) => <>{children}</>;
const useDraggable = (args: any) => ({ attributes: {}, listeners: {}, setNodeRef: undefined, transform: {x:0, y:0, scaleX:1, scaleY:1} as any, isDragging: false });
const useDroppable = (args: any) => ({ setNodeRef: undefined, isOver: false });
const closestCenter = null;
const MouseSensor = null;
const TouchSensor = null;
const useSensor = (...args: any[]) => null;
const useSensors = (...args: any[]) => null;


interface Person {
  id: number
  name: string
  role: string
  gender: string | null
  isWheelchair?: boolean
  participations?: any[]
}

interface TeamMember {
  id: number
  isLeader: boolean
  person: Person
}

interface Team {
  id: number
  name: string
  color: string | null
  members: TeamMember[]
}


const sortTeamMembers = (members: TeamMember[]) => {
  return [...members].sort((a, b) => {
    const aStaff = a.person.role === 'STAFF' ? 1 : 0;
    const bStaff = b.person.role === 'STAFF' ? 1 : 0;
    if (aStaff !== bStaff) return bStaff - aStaff;
    const aWheel = a.person.isWheelchair ? 1 : 0;
    const bWheel = b.person.isWheelchair ? 1 : 0;
    if (aWheel !== bWheel) return bWheel - aWheel;
    return a.person.id - b.person.id;
  });
};

const sortPersons = (persons: Person[]) => {
  return [...persons].sort((a, b) => {
    const aStaff = a.role === 'STAFF' ? 1 : 0;
    const bStaff = b.role === 'STAFF' ? 1 : 0;
    if (aStaff !== bStaff) return bStaff - aStaff;
    const aWheel = a.isWheelchair ? 1 : 0;
    const bWheel = b.isWheelchair ? 1 : 0;
    if (aWheel !== bWheel) return bWheel - aWheel;
    return a.id - b.id;
  });
};

export default function AdminTeamsDnDPage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [unassigned, setUnassigned] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState<string | null>(null)
  
  const COLORS = {
    '青': 'bg-blue-100 border-blue-400',
    '赤': 'bg-red-100 border-red-400',
    '緑': 'bg-green-100 border-green-400',
    '黄': 'bg-yellow-100 border-yellow-400',
    '紫': 'bg-purple-100 border-purple-400',
    'ピンク': 'bg-pink-100 border-pink-400',
    'オレンジ': 'bg-orange-100 border-orange-400',
  }

  const fetchTeams = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/teams?tripId=1')
    const data = await res.json();
      data.forEach((t: any) => {
        t.members = sortTeamMembers(t.members);
      });
      setTeams(data);

    const resP = await fetch('/api/persons?tripId=1')
    const persons: Person[] = await resP.json()
    const participatingPersons = persons.filter(p => p.participations?.[0]?.status === '参加')
    const assignedIds = new Set(data.flatMap((t: Team) => t.members.map((m: TeamMember) => m.person.id)))
    setUnassigned(sortPersons(participatingPersons.filter(p => !assignedIds.has(p.id))))
    
    setLoading(false)
  }, [])

  useEffect(() => { fetchTeams() }, [fetchTeams])

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    // スマホでのスクロールとドラッグを両立させるために delay を追加
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  )

  const handleAssign = async (personId: number, teamId: number | null) => {
    await fetch(`/api/teams/assign`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ personId, teamId }),
    })
    await fetchTeams()
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
    } else if (overId.startsWith('team-')) {
      const teamId = parseInt(overId.replace('team-', ''))
      handleAssign(personId, teamId)
    }
  }

  const getPerson = (id: string) => {
    const pid = parseInt(id.replace('person-', ''))
    let p = unassigned.find(p => p.id === pid)
    if (p) return p
    teams.forEach(t => {
      const m = t.members.find(m => m.person.id === pid)
      if (m) p = m.person
    })
    return p
  }

  const activePerson = activeId ? getPerson(activeId) : null

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="space-y-5">
        <div className="pt-12 md:pt-0">
          <h1 className="text-2xl font-bold text-gray-800">📋 チーム・配置 (DnD編集)</h1>
          <p className="text-sm text-gray-500">長押しでドラッグ＆ドロップしてチームを編成します。</p>
        </div>

        {loading ? (
           <div className="text-center py-10 text-gray-400">読み込み中...</div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-6 items-start">
            
            {/* 左カラム: 未割り当て（スタッフ） */}
            <div className="w-full lg:w-56 shrink-0 order-2 lg:order-1">
              <DroppableUnassigned persons={unassigned} role="STAFF" title="スタッフ" />
            </div>

            {/* 中央カラム: チームグリッド */}
            <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 order-1 lg:order-2">
              {teams.map(team => (
                <DroppableTeam key={team.id} team={team} colorClass={COLORS[team.color as keyof typeof COLORS] || 'bg-gray-100 border-gray-400'} />
              ))}
            </div>

            {/* 右カラム: 未割り当て（利用者） */}
            <div className="w-full lg:w-56 shrink-0 order-3 lg:order-3">
              <DroppableUnassigned persons={unassigned} role="USER" title="利用者" />
            </div>

          </div>
        )}
      </div>

      <DragOverlay>
        {activePerson ? <DraggablePerson person={activePerson} isOverlay /> : null}
      </DragOverlay>
    </DndContext>
  )
}

function DroppableTeam({ team, colorClass }: { team: Team, colorClass: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: `team-${team.id}` })
  
  return (
    <div
      ref={setNodeRef}
      className={`rounded-2xl border-4 transition-colors overflow-hidden ${
        isOver ? 'border-indigo-400 shadow-md opacity-80' : 'shadow-sm'
      } ${colorClass}`}
    >
      <div className="px-4 py-3 md:py-2 font-bold text-lg text-gray-800 bg-white/50 border-b-2 border-black/10 flex justify-between items-center">
        <span>{team.name}</span>
        <span className="text-sm font-medium opacity-70">{team.members.length}名</span>
      </div>
      <div className="min-h-[300px] p-4 sm:p-6 flex flex-col gap-2">
        {team.members.map(m => (
          <DraggablePerson key={m.person.id} person={m.person} />
        ))}
      </div>
    </div>
  )
}

function DroppableUnassigned({ persons, role, title }: { persons: Person[], role: string, title: string }) {
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
      <p className="text-xs text-gray-500 mb-3">ここへドロップするとチームから外れます</p>
      
      {/* スマホ画面ではグリッド表示にしてスペースを有効活用 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-1 gap-3 max-h-[400px] lg:max-h-[600px] overflow-y-auto pr-1">
        {filtered.map(p => (
          <DraggablePerson key={p.id} person={p} />
        ))}
      </div>
    </div>
  )
}

function DraggablePerson({ person, isOverlay = false }: { person: Person, isOverlay?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `person-${person.id}`,
    data: person,
  })

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined

  // 色分けロジック: 車椅子 > スタッフ > 一般
  const bgClass = person.isWheelchair
    ? 'bg-pink-100 border-pink-400'
    : person.role === 'STAFF'
    ? 'bg-blue-100 border-blue-300'
    : 'bg-white border-gray-300'

  const icon = person.role === 'STAFF'
    ? '👨‍💼'
    : person.gender === '女'
    ? '👩'
    : '👨'

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`
        px-3 py-2 md:py-1 rounded-xl border-2 shadow-sm cursor-grab touch-none flex flex-row items-center justify-start gap-2 w-full min-h-[40px]
        ${bgClass}
        ${isDragging && !isOverlay ? 'opacity-30' : 'opacity-100'}
        ${isOverlay ? 'shadow-2xl scale-110 rotate-3 cursor-grabbing z-50' : ''}
      `}
    >
      <span className="text-[10px] md:text-xs shrink-0">
        {icon}
      </span>
      {person.isWheelchair && (
        <span className="text-[10px] shrink-0">♿️</span>
      )}
      <span className="font-semibold text-[10px] md:text-xs text-gray-800 break-words whitespace-normal leading-tight">
        {person.name}
      </span>
    </div>
  )
}
