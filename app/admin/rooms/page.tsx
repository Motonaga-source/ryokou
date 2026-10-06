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
  gender: string | null
  isWheelchair: boolean
  role: string
  notes: string | null
  participations?: Array<{ status: string }>
}

interface RoomWithUsers {
  id: number
  roomNumber: string
  floor: number
  capacity: number
  roomType: string
  assignments: Array<{ id: number; person: Person }>
}


const sortAssignments = (assignments: Array<{ id: number; person: Person }>) => {
  return [...assignments].sort((a, b) => {
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

export default function AdminRoomsDnDPage() {
  const [rooms, setRooms] = useState<RoomWithUsers[]>([])
  const [unassigned, setUnassigned] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [activeFloor, setActiveFloor] = useState<number>(3)
  const [activeId, setActiveId] = useState<string | null>(null)
  
  // Room edit state
  const [isAddingRoom, setIsAddingRoom] = useState(false)
  const [editingRoomId, setEditingRoomId] = useState<number | null>(null)
  const [roomForm, setRoomForm] = useState({ roomNumber: '', floor: '3', capacity: '4' })
  const [savingRoom, setSavingRoom] = useState(false)

  const fetchRooms = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/rooms?tripId=1')
    const data = await res.json();
      data.forEach((r: any) => r.assignments = sortAssignments(r.assignments));
      setRooms(data);

    const resP = await fetch('/api/persons?tripId=1')
    const persons: Person[] = await resP.json()
    const participatingPersons = persons.filter(p => p.participations?.[0]?.status === '参加')
    const assignedIds = new Set(data.flatMap((r: RoomWithUsers) => r.assignments.map(a => a.person.id)))
    setUnassigned(sortPersons(participatingPersons.filter(p => !assignedIds.has(p.id))))
    
    setLoading(false)
  }, [])

  useEffect(() => { fetchRooms() }, [fetchRooms])

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  )

  const handleAssign = async (personId: number, roomId: number) => {
    const person = getPerson(`person-${personId}`)
    if (person) {
      setRooms(prev => prev.map(r => {
        if (r.id === roomId) {
          if (r.assignments.some(a => a.person.id === personId)) return r;
          const newAssignments = sortAssignments([...r.assignments, { id: Date.now(), person }]);
          return { ...r, assignments: newAssignments };
        }
        if (r.assignments.some(a => a.person.id === personId)) {
          return { ...r, assignments: r.assignments.filter(a => a.person.id !== personId) };
        }
        return r;
      }));
      setUnassigned(prev => prev.filter(p => p.id !== personId));
    }

    await fetch(`/api/rooms/${roomId}/assign`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ personId, action: 'add' }),
    })
    await fetchRooms()
  }

  const handleUnassign = async (personId: number) => {
    const room = rooms.find(r => r.assignments.some(a => a.person.id === personId))
    if (room) {
      const person = room.assignments.find(a => a.person.id === personId)?.person;
      if (person) {
        setRooms(prev => prev.map(r => {
          if (r.id === room.id) {
            return { ...r, assignments: r.assignments.filter(a => a.person.id !== personId) };
          }
          return r;
        }));
        setUnassigned(prev => sortPersons([...prev, person]));
      }

      await fetch(`/api/rooms/${room.id}/assign`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personId, action: 'remove' }),
      })
      await fetchRooms()
    }
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
      handleUnassign(personId)
    } else if (overId.startsWith('room-')) {
      const roomId = parseInt(overId.replace('room-', ''))
      handleAssign(personId, roomId)
    }
  }

  const getPerson = (id: string) => {
    const pid = parseInt(id.replace('person-', ''))
    let p = unassigned.find(p => p.id === pid)
    if (p) return p
    for (const r of rooms) {
      p = r.assignments.find(a => a.person.id === pid)?.person
      if (p) return p
    }
    return null
  }

  const activePerson = activeId ? getPerson(activeId) : null

  // Collect unique floors dynamically from rooms
  const floors = Array.from(new Set(rooms.map(r => r.floor))).sort((a, b) => a - b)
  if (floors.length === 0) floors.push(3) // default fallback

  const floorRooms = rooms.filter(r => r.floor === activeFloor)
  
  const handleSaveRoom = async () => {
    setSavingRoom(true)
    if (editingRoomId) {
      await fetch(`/api/rooms/${editingRoomId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(roomForm)
      })
    } else {
      await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...roomForm, tripId: 1 })
      })
    }
    setSavingRoom(false)
    setIsAddingRoom(false)
    setEditingRoomId(null)
    setRoomForm({ roomNumber: '', floor: '3', capacity: '4' })
    await fetchRooms()
  }

  const handleDeleteRoom = async (roomId: number) => {
    if (!confirm('本当にこの部屋を削除しますか？')) return
    await fetch(`/api/rooms/${roomId}`, { method: 'DELETE' })
    await fetchRooms()
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="max-w-7xl mx-auto space-y-6 pt-12 md:pt-0">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800">🏨 部屋割り管理</h1>
          <button 
            onClick={() => { setIsAddingRoom(true); setEditingRoomId(null); setRoomForm({ roomNumber: '', floor: activeFloor.toString(), capacity: '4' }) }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm print:hidden"
          >
            ＋ 部屋を追加
          </button>
        </div>
        
        {isAddingRoom && (
          <div className="bg-blue-50 border-2 border-blue-400 p-4 rounded-xl flex flex-col md:flex-row gap-4 items-center">
            <h3 className="font-bold text-blue-800 whitespace-nowrap">新規部屋</h3>
            <input type="text" placeholder="部屋番号 (例: 201)" value={roomForm.roomNumber} onChange={e => setRoomForm({...roomForm, roomNumber: e.target.value})} className="border rounded px-3 py-1.5 flex-1" />
            <input type="number" placeholder="階 (例: 2)" value={roomForm.floor} onChange={e => setRoomForm({...roomForm, floor: e.target.value})} className="border rounded px-3 py-1.5 w-24" />
            <input type="number" placeholder="定員 (例: 4)" value={roomForm.capacity} onChange={e => setRoomForm({...roomForm, capacity: e.target.value})} className="border rounded px-3 py-1.5 w-24" />
            <div className="flex gap-2">
              <button onClick={() => setIsAddingRoom(false)} className="px-4 py-1.5 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 font-medium">キャンセル</button>
              <button onClick={handleSaveRoom} disabled={savingRoom || !roomForm.roomNumber} className="px-4 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium disabled:opacity-50">保存</button>
            </div>
          </div>
        )}

        <div className="flex gap-2 border-b-2 border-gray-200 pb-2 overflow-x-auto">
          {floors.map((floor) => (
            <button
              key={floor}
              onClick={() => setActiveFloor(floor)}
              className={`px-6 py-2 rounded-t-xl font-bold transition-colors ${
                activeFloor === floor 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {floor}階
            </button>
          ))}
        </div>

        {loading ? (
           <div className="text-center py-10 text-gray-400">読み込み中...</div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-6 items-start">
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {floorRooms.map(room => (
                <div key={room.id} className="relative group">
                  {editingRoomId === room.id ? (
                    <div className="bg-indigo-50 border-2 border-indigo-400 p-4 rounded-xl flex flex-col gap-3">
                      <h3 className="font-bold text-indigo-800">部屋の編集</h3>
                      <input type="text" placeholder="部屋番号 (例: 201)" value={roomForm.roomNumber} onChange={e => setRoomForm({...roomForm, roomNumber: e.target.value})} className="border rounded px-3 py-1.5" />
                      <div className="flex gap-2">
                         <input type="number" placeholder="階 (例: 2)" value={roomForm.floor} onChange={e => setRoomForm({...roomForm, floor: e.target.value})} className="border rounded px-3 py-1.5 w-1/2" />
                         <input type="number" placeholder="定員 (例: 4)" value={roomForm.capacity} onChange={e => setRoomForm({...roomForm, capacity: e.target.value})} className="border rounded px-3 py-1.5 w-1/2" />
                      </div>
                      <div className="flex gap-2 mt-2">
                        <button onClick={() => setEditingRoomId(null)} className="flex-1 py-1.5 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 font-medium">キャンセル</button>
                        <button onClick={handleSaveRoom} disabled={savingRoom || !roomForm.roomNumber} className="flex-1 py-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 font-medium disabled:opacity-50">保存</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <DroppableRoom room={room} />
                      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity print:hidden">
                        <button onClick={() => { setEditingRoomId(room.id); setRoomForm({ roomNumber: room.roomNumber, floor: room.floor.toString(), capacity: room.capacity.toString() }) }} className="p-1.5 bg-white text-gray-600 rounded shadow hover:text-blue-600">✏️</button>
                        <button onClick={() => handleDeleteRoom(room.id)} className="p-1.5 bg-white text-gray-600 rounded shadow hover:text-red-600">🗑️</button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            <div className="w-full lg:w-80 shrink-0 space-y-4">
              <DroppableUnassigned persons={unassigned} role="STAFF" title="スタッフ" />
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

function DroppableRoom({ room }: { room: RoomWithUsers }) {
  const { setNodeRef, isOver } = useDroppable({ id: `room-${room.id}` })
  const isOverCapacity = room.assignments.length > room.capacity

  let headerColor = 'bg-blue-600 text-white'
  let borderColor = 'border-gray-200'
  let bgColor = 'bg-white'

  if (isOver) {
    borderColor = 'border-indigo-400'
    bgColor = 'bg-indigo-50'
  } else if (isOverCapacity) {
    borderColor = 'border-red-400'
    bgColor = 'bg-red-50'
    headerColor = 'bg-red-600 text-white'
  }

  return (
    <div
      ref={setNodeRef}
      className={`rounded-2xl border-4 transition-colors overflow-hidden ${borderColor} ${bgColor} shadow-sm`}
    >
      <div className={`px-4 py-3 flex justify-between items-center ${headerColor}`}>
        <h3 className="font-bold text-lg">{room.floor}階 - {room.roomNumber}号室</h3>
        <span className={`text-sm font-bold ${isOverCapacity ? 'text-red-100 animate-pulse' : 'text-blue-100'}`}>
          （現在: {room.assignments.length}/{room.capacity}名）
        </span>
      </div>
      <div className="p-3 min-h-[120px] grid grid-cols-1 gap-2">
        {room.assignments.map(a => (
          <DraggablePerson key={a.person.id} person={a.person} />
        ))}
        {room.assignments.length === 0 && (
          <div className="text-center text-gray-400 text-sm mt-4">空室</div>
        )}
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
      <p className="text-xs text-gray-500 mb-3 print:hidden">ここへドロップすると部屋から外れます</p>
      
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-1 gap-2 max-h-[400px] lg:max-h-[600px] overflow-y-auto pr-1">
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
          {person.notes && (
            <span className="text-[10px] text-gray-500 truncate ml-1">⚠️{person.notes}</span>
          )}
        </div>
      </div>
    )
  }
