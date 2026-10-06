'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  DndContext,
  closestCenter,
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

const COLOR_OPTIONS = [
  { label: '青', value: '青', cls: 'bg-blue-100 border-blue-400' },
  { label: '赤', value: '赤', cls: 'bg-red-100 border-red-400' },
  { label: '緑', value: '緑', cls: 'bg-green-100 border-green-400' },
  { label: '黄', value: '黄', cls: 'bg-yellow-100 border-yellow-400' },
  { label: '紫', value: '紫', cls: 'bg-purple-100 border-purple-400' },
  { label: 'ピンク', value: 'ピンク', cls: 'bg-pink-100 border-pink-400' },
  { label: 'オレンジ', value: 'オレンジ', cls: 'bg-orange-100 border-orange-400' },
  { label: 'グレー', value: 'グレー', cls: 'bg-gray-100 border-gray-400' },
]

function getColorClass(color: string | null) {
  return COLOR_OPTIONS.find(c => c.value === color)?.cls ?? 'bg-gray-100 border-gray-400'
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
  
  // Team CRUD state
  const [isAddingTeam, setIsAddingTeam] = useState(false)
  const [editingTeamId, setEditingTeamId] = useState<number | null>(null)
  const [teamForm, setTeamForm] = useState({ name: '', color: '青' })
  const [savingTeam, setSavingTeam] = useState(false)

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
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  )

    const handleAssign = async (personId: number, teamId: number | null) => {
    const person = getPerson(`person-${personId}`);
    if (person) {
      if (teamId === null) {
        setTeams(prev => prev.map(t => ({
          ...t,
          members: t.members.filter(m => m.person.id !== personId)
        })));
        setUnassigned(prev => {
          if (prev.some(p => p.id === personId)) return prev;
          return sortPersons([...prev, person]);
        });
      } else {
        setTeams(prev => prev.map(t => {
          if (t.id === teamId) {
            if (t.members.some(m => m.person.id === personId)) return t;
            const newMembers = sortTeamMembers([...t.members, { id: Date.now(), isLeader: false, person }]);
            return { ...t, members: newMembers };
          }
          if (t.members.some(m => m.person.id === personId)) {
            return { ...t, members: t.members.filter(m => m.person.id !== personId) };
          }
          return t;
        }));
        setUnassigned(prev => prev.filter(p => p.id !== personId));
      }
    }

    await fetch('/api/teams/assign', {
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

  const handleSaveTeam = async () => {
    setSavingTeam(true)
    if (editingTeamId) {
      await fetch(`/api/teams/${editingTeamId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(teamForm)
      })
    } else {
      await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...teamForm, tripId: 1 })
      })
    }
    setSavingTeam(false)
    setIsAddingTeam(false)
    setEditingTeamId(null)
    setTeamForm({ name: '', color: '青' })
    await fetchTeams()
  }

  const handleDeleteTeam = async (teamId: number) => {
    if (!confirm('本当にこのチームを削除しますか？')) return
    await fetch(`/api/teams/${teamId}`, { method: 'DELETE' })
    await fetchTeams()
  }

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="space-y-5 pt-12 md:pt-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">📋 チーム・配置管理</h1>
            <p className="text-sm text-gray-500">長押しでドラッグ＆ドロップしてチームを編成します。</p>
          </div>
          <button
            onClick={() => { setIsAddingTeam(true); setEditingTeamId(null); setTeamForm({ name: '', color: '青' }) }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm print:hidden"
          >
            ＋ チームを追加
          </button>
        </div>

        {isAddingTeam && (
          <div className="bg-blue-50 border-2 border-blue-400 p-4 rounded-xl flex flex-col md:flex-row gap-3 items-center">
            <h3 className="font-bold text-blue-800 whitespace-nowrap">新規チーム</h3>
            <input
              type="text"
              placeholder="チーム名 (例: Aチーム)"
              value={teamForm.name}
              onChange={e => setTeamForm({ ...teamForm, name: e.target.value })}
              className="border rounded px-3 py-1.5 flex-1"
            />
            <div className="flex gap-1 flex-wrap">
              {COLOR_OPTIONS.map(c => (
                <button
                  key={c.value}
                  onClick={() => setTeamForm({ ...teamForm, color: c.value })}
                  className={`px-2 py-1 rounded text-xs font-medium border-2 ${c.cls} ${teamForm.color === c.value ? 'ring-2 ring-offset-1 ring-blue-500' : ''}`}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setIsAddingTeam(false)} className="px-4 py-1.5 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 font-medium">キャンセル</button>
              <button onClick={handleSaveTeam} disabled={savingTeam || !teamForm.name} className="px-4 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium disabled:opacity-50">保存</button>
            </div>
          </div>
        )}

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
                <div key={team.id} className="relative group">
                  {editingTeamId === team.id ? (
                    <div className="bg-indigo-50 border-2 border-indigo-400 p-4 rounded-xl flex flex-col gap-3">
                      <h3 className="font-bold text-indigo-800">チームの編集</h3>
                      <input
                        type="text"
                        placeholder="チーム名"
                        value={teamForm.name}
                        onChange={e => setTeamForm({ ...teamForm, name: e.target.value })}
                        className="border rounded px-3 py-1.5"
                      />
                      <div className="flex gap-1 flex-wrap">
                        {COLOR_OPTIONS.map(c => (
                          <button
                            key={c.value}
                            onClick={() => setTeamForm({ ...teamForm, color: c.value })}
                            className={`px-2 py-1 rounded text-xs font-medium border-2 ${c.cls} ${teamForm.color === c.value ? 'ring-2 ring-offset-1 ring-blue-500' : ''}`}
                          >
                            {c.label}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-2 mt-1">
                        <button onClick={() => setEditingTeamId(null)} className="flex-1 py-1.5 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 font-medium">キャンセル</button>
                        <button onClick={handleSaveTeam} disabled={savingTeam || !teamForm.name} className="flex-1 py-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 font-medium disabled:opacity-50">保存</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <DroppableTeam team={team} colorClass={getColorClass(team.color)} />
                      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity print:hidden">
                        <button
                          onClick={() => { setEditingTeamId(team.id); setTeamForm({ name: team.name, color: team.color || '青' }) }}
                          className="p-1.5 bg-white text-gray-600 rounded shadow hover:text-blue-600"
                        >✏️</button>
                        <button
                          onClick={() => handleDeleteTeam(team.id)}
                          className="p-1.5 bg-white text-gray-600 rounded shadow hover:text-red-600"
                        >🗑️</button>
                      </div>
                    </>
                  )}
                </div>
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

  const wheelchairCount = team.members.filter(m => m.person.isWheelchair).length

  return (
    <div
      ref={setNodeRef}
      className={`rounded-2xl border-4 transition-colors overflow-hidden ${
        isOver ? 'border-indigo-400 shadow-md opacity-80' : 'shadow-sm'
      } ${colorClass}`}
    >
      <div className="px-4 py-3 md:py-2 font-bold text-lg text-gray-800 bg-white/50 border-b-2 border-black/10 flex justify-between items-center">
        <span>{team.name}</span>
        <div className="flex items-center gap-2 text-sm font-medium opacity-80">
          {wheelchairCount > 0 && (
            <span className="bg-pink-200 text-pink-800 px-1.5 py-0.5 rounded-full text-xs">
              ♿️ {wheelchairCount}
            </span>
          )}
          <span>{team.members.length}名</span>
        </div>
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
      <p className="text-xs text-gray-500 mb-3 print:hidden">ここへドロップするとチームから外れます</p>
      
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
          flex items-center gap-2 p-2 w-full rounded-md border-2 shadow-sm cursor-grab touch-none transition-colors
          ${bgClass}
          ${isDragging && !isOverlay ? 'opacity-30' : 'opacity-100'}
          ${isOverlay ? 'shadow-2xl scale-105 rotate-2 cursor-grabbing z-50' : ''}
        `}
      >
        <div className="flex items-center justify-center shrink-0 w-6 h-6 text-sm">
          {icon}
        </div>
        <div className="flex-1 min-w-0 flex items-center gap-1 text-left">
          {person.isWheelchair && <span className="shrink-0 text-sm">♿️</span>}
          <span className="font-bold text-sm text-gray-800 truncate block">
            {person.name}
          </span>
        </div>
      </div>
    )
  }
