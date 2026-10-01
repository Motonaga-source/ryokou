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

interface Person {
  id: number
  name: string
  role: string
  facility: string | null
  gender: string | null
  isWheelchair: boolean
  busAssignments: BusAssignment[]
  carAssignments: CarAssignment[]
}

interface BusAssignment {
  id: number
  vehicle: string | null
  rowNo: number | null
  seatSide: string | null
  person: Person
}

interface Car {
  id: number
  name: string
  capacity: number
  assignments: CarAssignment[]
}

interface CarAssignment {
  id: number
  carId: number
  personId: number
  person: Person
}

export default function AdminBusDnDPage() {
  const [persons, setPersons] = useState<Person[]>([])
  const [cars, setCars] = useState<Car[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'BUS' | 'CAR'>('BUS')
  const [saving, setSaving] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [busRes, carsRes] = await Promise.all([
      fetch('/api/bus?tripId=1'),
      fetch('/api/cars?tripId=1')
    ])
    const busData = await busRes.json()
    const carsData = await carsRes.json()
    setPersons(busData.persons)
    setCars(carsData)
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  )

  // --- Bus Handlers ---
  const handleAssignBus = async (personId: number, rowNo: number, seatSide: string) => {
    setSaving(true)
    setPersons(prev => prev.map(p => {
      if (p.id === personId) {
        return { ...p, busAssignments: [{ id: Date.now(), vehicle: '1号車', rowNo, seatSide, person: p }], carAssignments: [] }
      }
      if (p.busAssignments?.some(a => a.vehicle === '1号車' && a.rowNo === rowNo && a.seatSide === seatSide)) {
        return { ...p, busAssignments: [] }
      }
      return p
    }))

    await fetch('/api/bus', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ personId, vehicle: '1号車', rowNo, seatSide }),
    })
    await fetchData()
    setSaving(false)
  }

  const handleRemoveBus = async (personId: number) => {
    setSaving(true)
    setPersons(prev => prev.map(p => p.id === personId ? { ...p, busAssignments: [] } : p))
    await fetch(`/api/bus?personId=${personId}`, { method: 'DELETE' })
    await fetchData()
    setSaving(false)
  }

  // --- Car Handlers ---
  const handleAssignCar = async (personId: number, carId: number | null) => {
    setSaving(true)
    
    // 定員チェック (UI側)
    if (carId !== null) {
      const targetCar = cars.find(c => c.id === carId)
      const currentCount = persons.filter(p => p.carAssignments?.some(a => a.carId === carId)).length
      if (targetCar && currentCount >= targetCar.capacity && !persons.find(p => p.id === personId)?.carAssignments?.some(a => a.carId === carId)) {
        showToast(`⚠ ${targetCar.name}は定員（${targetCar.capacity}名）に達しています`)
        setSaving(false)
        return
      }
    }

    setPersons(prev => prev.map(p => {
      if (p.id === personId) {
        return { ...p, carAssignments: carId ? [{ id: Date.now(), carId, personId, person: p }] : [], busAssignments: [] }
      }
      return p
    }))

    await fetch(`/api/cars/assign`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ personId, carId }),
    })
    await fetchData()
    setSaving(false)
  }

  const [isAddingCar, setIsAddingCar] = useState(false)
  const [newCarName, setNewCarName] = useState('')
  const [newCarCapacity, setNewCarCapacity] = useState('')

  const handleCreateCar = async () => {
    if (!newCarName.trim()) {
      alert('車種名を入力してください')
      return
    }
    const capacity = parseInt(newCarCapacity)
    if (isNaN(capacity) || capacity <= 0) {
      alert('正しい定員（人数）を入力してください')
      return
    }

    setSaving(true)
    await fetch('/api/cars', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newCarName.trim(), capacity, tripId: 1 })
    })
    await fetchData()
    setSaving(false)
    showToast(`✅ ${newCarName} を追加しました`)
    
    // フォームをリセットして閉じる
    setNewCarName('')
    setNewCarCapacity('')
    setIsAddingCar(false)
  }

  const handleDeleteCar = async (carId: number) => {
    if (!confirm('この車を削除してもよろしいですか？（乗員は未割り当てに戻ります）')) return
    setSaving(true)
    await fetch(`/api/cars/${carId}`, { method: 'DELETE' })
    await fetchData()
    setSaving(false)
    showToast('削除しました')
  }

  // --- DnD Core ---
  const onDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const onDragEnd = (event: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = event
    if (!over) return

    const personId = parseInt((active.id as string).replace('person-', ''))
    const overId = over.id as string

    if (activeTab === 'BUS') {
      if (overId.startsWith('unassigned')) {
        handleRemoveBus(personId)
      } else if (overId.startsWith('seat-')) {
        const [, rowStr, side] = overId.split('-')
        handleAssignBus(personId, parseInt(rowStr), side)
      }
    } else {
      if (overId.startsWith('unassigned')) {
        handleAssignCar(personId, null)
      } else if (overId.startsWith('car-')) {
        const carId = parseInt(overId.replace('car-', ''))
        handleAssignCar(personId, carId)
      }
    }
  }

  const getSeatPerson = (row: number, side: string) => {
    return persons.find(p => p.busAssignments?.some(a => a.vehicle === '1号車' && a.rowNo === row && a.seatSide === side))
  }

  const activePerson = activeId ? persons.find(p => p.id === parseInt(activeId.replace('person-', ''))) : null

  const busRows = Array.from({ length: 12 }, (_, i) => 12 - i)

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="space-y-5 pb-20">
        {toast && (
          <div className="fixed top-4 right-4 z-50 bg-gray-800 text-white px-4 py-3 rounded-xl shadow-xl text-sm">
            {toast}
          </div>
        )}

        <div className="pt-12 md:pt-0">
          <h1 className="text-2xl font-bold text-gray-800">🚌 座席・車両割当て (DnD編集)</h1>
        </div>

        <div className="flex gap-2 bg-gray-200 p-1 rounded-2xl w-max">
          <button
            onClick={() => setActiveTab('BUS')}
            className={`px-6 py-2 rounded-xl font-bold text-sm transition-all ${
              activeTab === 'BUS' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:bg-gray-300'
            }`}
          >
            大型バス
          </button>
          <button
            onClick={() => setActiveTab('CAR')}
            className={`px-6 py-2 rounded-xl font-bold text-sm transition-all ${
              activeTab === 'CAR' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:bg-gray-300'
            }`}
          >
            乗用車（送迎・別働）
          </button>
        </div>

        {loading ? (
          <div className="text-center py-10 text-gray-400">読み込み中...</div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-6 items-start">
            
            {/* 左カラム: 未割り当て（スタッフ） */}
            <div className="w-full lg:w-56 shrink-0 order-2 lg:order-1">
              <UnassignedList persons={persons} tab={activeTab} role="STAFF" title="スタッフ" />
            </div>

            {/* 中央カラム */}
            <div className="flex-1 w-full order-1 lg:order-2 flex justify-center">
              {activeTab === 'BUS' ? (
                <div className="bg-gray-100 p-4 sm:p-6 rounded-[3rem] border-[6px] border-gray-700 shadow-2xl w-full max-w-4xl mx-auto flex flex-col relative">
                  
                  <div className="flex-1 space-y-1 sm:space-y-2">
                  {busRows.map(row => (
                    <div key={row} className="flex gap-1 sm:gap-2 items-stretch">
                      <div className="w-6 flex items-center justify-center text-xs font-black text-gray-400 shrink-0">{row}</div>
                      {row === 12 ? (
                        <div className="flex flex-1 gap-1 sm:gap-2">
                          {['A', 'B', 'C', 'D', 'E'].map(side => (
                            <DroppableSeat key={side} row={row} side={side} person={getSeatPerson(row, side)} />
                          ))}
                        </div>
                      ) : (
                        <>
                          <div className="flex flex-1 gap-1 sm:gap-2">
                            {['A', 'B'].map(side => (
                              <DroppableSeat key={side} row={row} side={side} person={getSeatPerson(row, side)} />
                            ))}
                          </div>
                          <div className="w-8 shrink-0 bg-gray-200 rounded-full shadow-inner opacity-50" title="通路"></div>
                          <div className="flex flex-1 gap-1 sm:gap-2">
                            {['C', 'D'].map(side => (
                              <DroppableSeat key={side} row={row} side={side} person={getSeatPerson(row, side)} />
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                  </div>

                  {/* バス前方ラベル (下部・右ハンドル) */}
                  <div className="flex justify-between items-start border-t-4 border-gray-400 pt-4 mt-6 relative">
                    <div className="w-20 h-20 bg-gray-300 rounded-xl flex flex-col items-center justify-center text-gray-600 border-2 border-gray-400 shadow-inner">
                      <span className="text-2xl">🚌</span>
                      <span className="font-bold text-sm mt-1">運転席</span>
                    </div>
                    <div className="absolute left-1/2 -translate-x-1/2 top-4 text-gray-400 font-black tracking-[0.5em] text-xl">FRONT</div>
                    <div className="w-12 h-24 border-2 border-gray-400 rounded-l-2xl border-r-0 self-start -mr-6 bg-white opacity-50 flex items-center justify-center text-xs text-gray-400" title="乗降口">乗降口</div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  
                  {isAddingCar ? (
                    <div className="bg-blue-50 border-2 border-blue-400 rounded-2xl p-4 shadow-sm">
                      <h3 className="font-bold text-blue-800 mb-3">新しい乗用車を追加</h3>
                      <div className="flex flex-col md:flex-row gap-3">
                        <input
                          type="text"
                          placeholder="車種名 (例: ハイエース)"
                          className="flex-1 border-2 border-blue-200 rounded-xl px-4 py-2 focus:outline-none focus:border-blue-500"
                          value={newCarName}
                          onChange={(e) => setNewCarName(e.target.value)}
                        />
                        <input
                          type="number"
                          placeholder="定員 (人数)"
                          className="w-full md:w-32 border-2 border-blue-200 rounded-xl px-4 py-2 focus:outline-none focus:border-blue-500"
                          value={newCarCapacity}
                          onChange={(e) => setNewCarCapacity(e.target.value)}
                          min="1"
                        />
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={handleCreateCar}
                            disabled={saving}
                            className="bg-blue-600 text-white font-bold px-6 py-2 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
                          >
                            保存
                          </button>
                          <button
                            onClick={() => setIsAddingCar(false)}
                            className="bg-white text-gray-500 font-bold px-4 py-2 rounded-xl border-2 hover:bg-gray-50 transition-colors"
                          >
                            キャンセル
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setIsAddingCar(true)} className="w-full py-4 border-2 border-dashed border-blue-400 text-blue-600 bg-blue-50 rounded-2xl font-bold hover:bg-blue-100 transition-colors">
                      ＋ 乗用車を追加
                    </button>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {cars.map(car => {
                      const occupants = persons.filter(p => p.carAssignments?.some(a => a.carId === car.id))
                      return (
                        <DroppableCar key={car.id} car={car} occupants={occupants} onDelete={() => handleDeleteCar(car.id)} />
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* 右カラム: 未割り当て（利用者） */}
            <div className="w-full lg:w-56 shrink-0 order-3 lg:order-3">
              <UnassignedList persons={persons} tab={activeTab} role="USER" title="利用者" />
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

function DroppableSeat({ row, side, person }: { row: number, side: string, person?: Person }) {
  const id = `seat-${row}-${side}`
  const { setNodeRef, isOver } = useDroppable({ id })

  let seatBg = 'bg-gray-50'
  let seatBorder = 'border-dashed border-gray-300 border-2'
  
  if (person) {
    if (person.role === 'STAFF') {
      seatBg = 'bg-blue-100'
      seatBorder = 'border-solid border-blue-500 border-2 shadow-sm'
    } else if (person.isWheelchair) {
      seatBg = 'bg-pink-100'
      seatBorder = 'border-solid border-pink-400 border-2 shadow-sm'
    } else {
      seatBg = 'bg-white'
      seatBorder = 'border-solid border-gray-400 border-2 shadow-sm'
    }
  }

  if (isOver) {
    seatBg = 'bg-indigo-100'
    seatBorder = 'border-solid border-indigo-400 border-2'
  }

  return (
    <div
      ref={setNodeRef}
      className={`relative flex-1 p-0.5 rounded-lg flex flex-col items-center justify-center min-h-[38px] md:min-h-[44px] transition-all
        ${seatBg} ${seatBorder}
      `}
    >
      <span className="absolute top-0 left-0.5 text-[9px] text-gray-500 font-bold leading-none">{side}</span>
      {person && <DraggablePerson person={person} inSeat={true} />}
    </div>
  )
}

function DroppableCar({ car, occupants, onDelete }: { car: Car, occupants: Person[], onDelete: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: `car-${car.id}` })
  const isFull = occupants.length >= car.capacity

  return (
    <div ref={setNodeRef} className={`bg-white rounded-2xl border-2 shadow-sm flex flex-col transition-colors overflow-hidden ${isOver ? 'bg-indigo-50 border-indigo-400' : 'border-gray-200'}`}>
      <div className={`p-3 border-b flex justify-between items-center ${isFull ? 'bg-red-50' : 'bg-gray-50'}`}>
        <div>
          <div className="font-bold text-gray-800">{car.name}</div>
          <div className={`text-xs font-semibold ${isFull ? 'text-red-600' : 'text-gray-500'}`}>
            {occupants.length} / {car.capacity} 名
          </div>
        </div>
        <button onClick={onDelete} className="text-xs text-red-500 hover:bg-red-100 px-2 py-1 rounded">削除</button>
      </div>
      <div className="p-3 min-h-[100px] flex flex-wrap gap-2">
        {occupants.map(p => <DraggablePerson key={p.id} person={p} />)}
        {occupants.length === 0 && <div className="text-gray-400 text-xs w-full text-center py-4">ドラッグ＆ドロップで配置</div>}
      </div>
    </div>
  )
}

function UnassignedList({ persons, tab, role, title }: { persons: Person[], tab: 'BUS' | 'CAR', role: string, title: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: `unassigned-${role}` })
  const unassigned = persons.filter(p => {
    if (p.role !== role) return false
    // バスと乗用車のどちらにも割り当てられていない人を未割り当てとする
    const inBus = p.busAssignments?.some(a => a.vehicle === '1号車')
    const inCar = p.carAssignments && p.carAssignments.length > 0
    return !inBus && !inCar
  })

  return (
    <div
      ref={setNodeRef}
      className={`bg-white p-4 rounded-2xl border-2 shadow-sm flex flex-col transition-colors
        ${isOver ? 'bg-indigo-50 border-indigo-300' : 'border-gray-200'}
      `}
      style={{ minHeight: '200px' }}
    >
      <h2 className="font-bold text-gray-800 mb-1">未割り当て ({title})</h2>
      <p className="text-xs text-blue-600 font-bold mb-3">{unassigned.length}名</p>
      
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-1 gap-2 max-h-[300px] lg:max-h-[800px] overflow-y-auto pr-1">
        {unassigned.map(p => (
          <DraggablePerson key={p.id} person={p} />
        ))}
      </div>
    </div>
  )
}

function DraggablePerson({ person, isOverlay = false, inSeat = false }: { person: Person, isOverlay?: boolean, inSeat?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `person-${person.id}`,
    data: person,
  })

  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined

  // 色分け: スタッフ=水色枠、車椅子=ピンク背景、通常=白
  const colorClass = person.role === 'STAFF'
    ? 'border-blue-400 bg-blue-50'
    : person.isWheelchair
      ? 'border-pink-400 bg-pink-100'
      : 'border-gray-200 bg-white'

  if (inSeat && !isOverlay) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        {...listeners}
        {...attributes}
        className={`
          w-full h-full flex flex-col items-center justify-center cursor-grab touch-none mt-2
          ${isDragging ? 'opacity-30' : 'opacity-100'}
        `}
      >
        <div className="flex flex-col items-center justify-center gap-0.5 text-center leading-tight break-words px-0.5">
          <span className="text-[10px] shrink-0">
            {person.role === 'STAFF' ? '👤' : person.isWheelchair ? '♿' : person.gender === '女' ? '👩' : '👨'}
          </span>
          <span className="font-bold text-[10px] text-gray-800 break-words w-full">
            {person.name}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`
        px-2 py-1 rounded-xl border-2 shadow-sm cursor-grab touch-none inline-flex items-center gap-1 w-full lg:w-auto
        ${colorClass}
        ${isDragging && !isOverlay ? 'opacity-30' : 'opacity-100'}
        ${isOverlay ? 'shadow-2xl scale-110 rotate-3 cursor-grabbing z-50 min-h-[36px] md:min-h-[40px]' : 'min-h-[32px]'}
      `}
    >
      <span className="text-[10px] shrink-0">
        {person.role === 'STAFF' ? '👤' : person.isWheelchair ? '♿' : person.gender === '女' ? '👩' : '👨'}
      </span>
      <span className="font-semibold text-[10px] text-gray-800 whitespace-nowrap truncate w-full">
        {person.name}
      </span>
    </div>
  )
}
