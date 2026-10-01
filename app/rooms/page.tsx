'use client'

import { useEffect, useState, useCallback } from 'react'

type DragStartEvent = any;
type DragEndEvent = any;
const DndContext = ({children}: any) => <>{children}</>;
const DragOverlay = ({children}: any) => <>{children}</>;
const useDraggable = (args: any) => ({ attributes: {}, listeners: {}, setNodeRef: undefined, transform: {x:0, y:0, scaleX:1, scaleY:1} as any, isDragging: false });
const useDroppable = (args: any) => ({ setNodeRef: undefined, isOver: false });
const closestCenter = null;
const MouseSensor = null;
const TouchSensor = null;
const useSensor = () => null;
const useSensors = () => null;

interface Person {
  id: number
  name: string
  gender: string | null
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

export default function RoomsViewPage() {
  const [rooms, setRooms] = useState<RoomWithUsers[]>([])
  const [unassigned, setUnassigned] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [activeFloor, setActiveFloor] = useState<number>(3)

  const fetchRooms = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/rooms?tripId=1')
    const data = await res.json()
    setRooms(data)

    const resP = await fetch('/api/persons?tripId=1')
    const persons: Person[] = await resP.json()
    const participatingPersons = persons.filter(p => p.participations?.[0]?.status === '参加')
    const assignedIds = new Set(data.flatMap((r: RoomWithUsers) => r.assignments.map(a => a.person.id)))
    setUnassigned(participatingPersons.filter(p => !assignedIds.has(p.id)))
    
    setLoading(false)
  }, [])

  useEffect(() => { fetchRooms() }, [fetchRooms])

  // Collect unique floors dynamically from rooms
  const floors = Array.from(new Set(rooms.map(r => r.floor))).sort((a, b) => a - b)
  if (floors.length === 0) floors.push(3) // default fallback

  const floorRooms = rooms.filter(r => r.floor === activeFloor)
  
  return (
    <DndContext sensors={null} collisionDetection={null} onDragStart={() => {}} onDragEnd={() => {}}>
      <div className="max-w-7xl mx-auto space-y-6 pt-12 md:pt-0">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800">🏨 部屋割り管理</h1>
        </div>
        
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
                  <DroppableRoom room={room} />
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
        {null}
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

  if (isOverCapacity) {
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
  const { setNodeRef } = useDroppable({ id: `unassigned-${role}` })
  const filtered = persons.filter(p => p.role === role)
  return (
    <div
      ref={setNodeRef}
      className={`bg-white rounded-2xl border-2 p-4 transition-colors border-gray-200 shadow-sm`}
      style={{ minHeight: '300px' }}
    >
      <h3 className="font-bold text-gray-800 mb-1">未割り当て ({title}) - {filtered.length}名</h3>
      
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

  return (
    <div
      ref={setNodeRef}
      className={`
        flex items-center gap-3 p-2 rounded-xl border-2 shadow-sm touch-none
        ${person.isWheelchair ? 'bg-pink-100 border-pink-400' : person.role === 'STAFF' ? 'bg-blue-100 border-blue-300' : 'bg-white border-gray-300'}
      `}
    >
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 ${person.gender === '女' ? 'bg-pink-100' : 'bg-blue-100'}`}>
        {person.gender === '女' ? '👩' : '👨'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm text-gray-800 truncate">{person.isWheelchair && <span className="mr-1">♿</span>}{person.name}</div>
        {person.notes && (
          <div className="text-[10px] text-gray-500 truncate mt-0.5">⚠️ {person.notes}</div>
        )}
      </div>
    </div>
  )
}
