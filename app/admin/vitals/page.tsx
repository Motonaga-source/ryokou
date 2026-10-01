'use client'

import { useEffect, useState, useCallback } from 'react'

interface VitalRecord {
  id?: number
  bloodPressureHigh: string
  bloodPressureLow: string
  pulse: string
  temperature: string
  notes: string
}

interface Person {
  id: number
  name: string
  gender: string | null
  notes: string | null
  isWheelchair: boolean
  medication: {
    hasBreakfast: boolean; breakfastNote: string | null
    hasLunch: boolean; lunchNote: string | null
    hasDinner: boolean; dinnerNote: string | null
    hasSleep: boolean; sleepNote: string | null
    hasAsNeeded: boolean; asNeededNote: string | null
  } | null
  vitalRecords: Array<{
    id: number
    bloodPressureHigh: number | null
    bloodPressureLow: number | null
    pulse: number | null
    temperature: number | null
    notes: string | null
    recordedAt: string
  }>
}

interface RoomWithUsers {
  id: number
  roomNumber: string
  floor: number
  assignments: Array<{ person: Person }>
}

const emptyVital = (): VitalRecord => ({
  bloodPressureHigh: '',
  bloodPressureLow: '',
  pulse: '',
  temperature: '',
  notes: '',
})

export default function VitalsPage() {
  const [rooms, setRooms] = useState<RoomWithUsers[]>([])
  const [loading, setLoading] = useState(true)
  const [activeFloor, setActiveFloor] = useState<3 | 4>(3)
  const [editingPersonId, setEditingPersonId] = useState<number | null>(null)
  const [vitalForm, setVitalForm] = useState<VitalRecord>(emptyVital())
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const fetchVitals = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/vitals?tripId=1')
    const data = await res.json()
    setRooms(data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchVitals() }, [fetchVitals])

  const handleStartEdit = (person: Person) => {
    setEditingPersonId(person.id)
    const latest = person.vitalRecords[0]
    setVitalForm(latest ? {
      bloodPressureHigh: String(latest.bloodPressureHigh ?? ''),
      bloodPressureLow: String(latest.bloodPressureLow ?? ''),
      pulse: String(latest.pulse ?? ''),
      temperature: String(latest.temperature ?? ''),
      notes: latest.notes ?? '',
    } : emptyVital())
  }

  const handleSaveVital = async (personId: number, roomId: number, existingId?: number) => {
    setSaving(true)
    try {
      if (existingId) {
        await fetch(`/api/vitals/${existingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(vitalForm),
        })
      } else {
        await fetch('/api/vitals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...vitalForm, personId, roomId }),
        })
      }
      showToast('✅ バイタルを保存しました')
      setEditingPersonId(null)
      fetchVitals()
    } catch {
      showToast('❌ 保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const getVitalStatus = (person: Person) => {
    const v = person.vitalRecords[0]
    if (!v) return 'none'
    if (v.bloodPressureHigh && v.pulse && v.temperature) return 'complete'
    return 'partial'
  }

  const floorRooms = rooms.filter((r) => r.floor === activeFloor)
  const allPersons = rooms.filter((r) => r.floor === activeFloor).flatMap((r) => r.assignments.map((a) => a.person))
  const recorded = allPersons.filter((p) => getVitalStatus(p) !== 'none').length

  return (
    <div className="space-y-5">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-800 text-white px-4 py-3 rounded-xl shadow-xl text-sm">
          {toast}
        </div>
      )}

      <div className="pt-12 md:pt-0">
        <h1 className="text-2xl font-bold text-gray-800">💊 バイタルチェック</h1>
        <p className="text-gray-500 text-sm mt-1">
          {activeFloor}階：{recorded}/{allPersons.length}名 記録済み
        </p>
      </div>

      {/* 進捗バー */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="bg-gray-100 rounded-full h-3">
              <div
                className="bg-gradient-to-r from-green-400 to-green-600 h-3 rounded-full transition-all"
                style={{ width: `${allPersons.length ? (recorded / allPersons.length) * 100 : 0}%` }}
              />
            </div>
          </div>
          <span className="text-sm text-gray-600 whitespace-nowrap font-medium">
            {allPersons.length ? Math.round((recorded / allPersons.length) * 100) : 0}%
          </span>
        </div>
      </div>

      {/* フロア切替 */}
      <div className="flex gap-2">
        {([3, 4] as const).map((floor) => {
          const floorPersons = rooms.filter((r) => r.floor === floor).flatMap((r) => r.assignments.map((a) => a.person))
          const done = floorPersons.filter((p) => getVitalStatus(p) !== 'none').length
          return (
            <button
              key={floor}
              onClick={() => setActiveFloor(floor)}
              className={`flex-1 py-3 rounded-2xl font-semibold text-sm transition-all ${
                activeFloor === floor
                  ? 'bg-gradient-to-r from-red-500 to-red-700 text-white shadow-lg'
                  : 'bg-white border-2 border-gray-200 text-gray-600'
              }`}
            >
              {floor}階
              <span className="ml-2 text-xs opacity-80">({done}/{floorPersons.length})</span>
            </button>
          )
        })}
      </div>

      {/* 部屋別リスト */}
      {loading ? (
        <div className="text-center py-10 text-gray-400">読み込み中...</div>
      ) : (
        <div className="space-y-4">
          {floorRooms.map((room) => (
            <div key={room.id} className="bg-white rounded-2xl border-2 border-gray-200 shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-slate-600 to-slate-800 px-5 py-3 text-white">
                <h3 className="font-bold">{room.roomNumber}号室</h3>
              </div>
              <div className="divide-y divide-gray-100">
                {room.assignments.map(({ person }) => {
                  const latest = person.vitalRecords[0]
                  const status = getVitalStatus(person)
                  const isEditing = editingPersonId === person.id

                  return (
                    <div key={person.id} className="p-4">
                      {/* 利用者ヘッダー */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`w-3 h-3 rounded-full ${status === 'complete' ? 'bg-green-500' : status === 'partial' ? 'bg-yellow-500' : 'bg-gray-300'}`} />
                          <span className="font-semibold text-gray-800">{person.name}</span>
                          {person.notes && (
                            <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">⚠️ {person.notes}</span>
                          )}
                        </div>
                        <button
                          onClick={() => isEditing ? setEditingPersonId(null) : handleStartEdit(person)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            isEditing ? 'bg-gray-200 text-gray-600' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                          }`}
                        >
                          {isEditing ? 'キャンセル' : '✏️ 記録する'}
                        </button>
                      </div>

                      {/* 服薬情報 */}
                      {person.medication && (
                        <div className="mb-2 flex flex-wrap gap-1">
                          {person.medication.hasBreakfast && <span className="px-2 py-0.5 rounded-full text-xs bg-purple-50 text-purple-600 border border-purple-200">💊 朝食後</span>}
                          {person.medication.hasLunch && <span className="px-2 py-0.5 rounded-full text-xs bg-purple-50 text-purple-600 border border-purple-200">💊 昼食後</span>}
                          {person.medication.hasDinner && <span className="px-2 py-0.5 rounded-full text-xs bg-purple-50 text-purple-600 border border-purple-200">💊 夕食後</span>}
                          {person.medication.hasSleep && <span className="px-2 py-0.5 rounded-full text-xs bg-purple-50 text-purple-600 border border-purple-200">💊 眠前</span>}
                          {person.medication.hasAsNeeded && <span className="px-2 py-0.5 rounded-full text-xs bg-purple-50 text-purple-600 border border-purple-200">💊 頓服</span>}
                        </div>
                      )}

                      {/* 既存バイタル表示 */}
                      {latest && !isEditing && (
                        <div className="grid grid-cols-4 gap-2 mt-2">
                          {[
                            { label: '血圧', value: latest.bloodPressureHigh && latest.bloodPressureLow ? `${latest.bloodPressureHigh}/${latest.bloodPressureLow}` : '-', unit: 'mmHg' },
                            { label: '脈拍', value: latest.pulse ?? '-', unit: 'bpm' },
                            { label: '体温', value: latest.temperature ?? '-', unit: '℃' },
                          ].map((item) => (
                            <div key={item.label} className="bg-gray-50 rounded-xl p-2 text-center">
                              <div className="text-xs text-gray-500">{item.label}</div>
                              <div className="font-bold text-gray-800 text-sm">{String(item.value)}</div>
                              <div className="text-xs text-gray-400">{item.unit}</div>
                            </div>
                          ))}
                          <div className="bg-green-50 rounded-xl p-2 text-center">
                            <div className="text-xs text-green-600">✅ 済</div>
                            <div className="text-xs text-gray-400 mt-1">{new Date(latest.recordedAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}</div>
                          </div>
                        </div>
                      )}

                      {/* 入力フォーム */}
                      {isEditing && (
                        <div className="mt-3 space-y-3 bg-blue-50 rounded-xl p-4">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs text-gray-600 font-medium">収縮期血圧 (mmHg)</label>
                              <input
                                type="number"
                                value={vitalForm.bloodPressureHigh}
                                onChange={(e) => setVitalForm((f) => ({ ...f, bloodPressureHigh: e.target.value }))}
                                className="w-full mt-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                                placeholder="例: 120"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-gray-600 font-medium">拡張期血圧 (mmHg)</label>
                              <input
                                type="number"
                                value={vitalForm.bloodPressureLow}
                                onChange={(e) => setVitalForm((f) => ({ ...f, bloodPressureLow: e.target.value }))}
                                className="w-full mt-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                                placeholder="例: 80"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-gray-600 font-medium">脈拍 (bpm)</label>
                              <input
                                type="number"
                                value={vitalForm.pulse}
                                onChange={(e) => setVitalForm((f) => ({ ...f, pulse: e.target.value }))}
                                className="w-full mt-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                                placeholder="例: 72"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-gray-600 font-medium">体温 (℃)</label>
                              <input
                                type="number"
                                step="0.1"
                                value={vitalForm.temperature}
                                onChange={(e) => setVitalForm((f) => ({ ...f, temperature: e.target.value }))}
                                className="w-full mt-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                                placeholder="例: 36.5"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="text-xs text-gray-600 font-medium">備考</label>
                            <input
                              type="text"
                              value={vitalForm.notes}
                              onChange={(e) => setVitalForm((f) => ({ ...f, notes: e.target.value }))}
                              className="w-full mt-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                              placeholder="気になる点があれば記入"
                            />
                          </div>
                          <button
                            onClick={() => handleSaveVital(person.id, room.id, latest?.id)}
                            disabled={saving}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3 font-semibold text-sm disabled:opacity-50 transition-colors"
                          >
                            {saving ? '保存中...' : '✅ バイタルを保存する'}
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
