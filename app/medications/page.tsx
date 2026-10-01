'use client'

import { useEffect, useState, useCallback } from 'react'

interface MedicationData {
  hasBreakfast: boolean
  breakfastNote: string | null
  hasLunch: boolean
  lunchNote: string | null
  hasDinner: boolean
  dinnerNote: string | null
  hasSleep: boolean
  sleepNote: string | null
  hasAsNeeded: boolean
  asNeededNote: string | null
}

interface PersonRecord {
  person: {
    id: number
    name: string
    gender: string | null
    facility: string | null
  }
  medication: MedicationData
}

const TIMINGS = [
  { key: 'hasBreakfast', noteKey: 'breakfastNote', label: '朝食後' },
  { key: 'hasLunch', noteKey: 'lunchNote', label: '昼食後' },
  { key: 'hasDinner', noteKey: 'dinnerNote', label: '夕食後' },
  { key: 'hasSleep', noteKey: 'sleepNote', label: '眠前' },
  { key: 'hasAsNeeded', noteKey: 'asNeededNote', label: '頓服' }
] as const

export default function MedicationsPage() {
  const [records, setRecords] = useState<PersonRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [savingIds, setSavingIds] = useState<Set<number>>(new Set())

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/medications?tripId=1')
      if (!res.ok) throw new Error('データ取得に失敗しました')
      const data = await res.json()
      setRecords(data)
    } catch (e: any) {
      setError(e.message || 'データ取得エラー')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleUpdate = async (personId: number, newMedication: MedicationData) => {
    // 楽観的UI更新
    setRecords(prev => prev.map(r => r.person.id === personId ? { ...r, medication: newMedication } : r))
    setSavingIds(prev => new Set(prev).add(personId))

    try {
      const res = await fetch('/api/medications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personId, medication: newMedication })
      })
      if (!res.ok) throw new Error('更新エラー')
    } catch (e) {
      showToast('❌ 保存に失敗しました')
      fetchData() // 元に戻す
    } finally {
      setSavingIds(prev => {
        const next = new Set(prev)
        next.delete(personId)
        return next
      })
    }
  }

  return (
    <div className="space-y-5 pb-20">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-800 text-white px-4 py-3 rounded-xl shadow-xl text-sm">
          {toast}
        </div>
      )}

      <div className="pt-12 md:pt-0">
        <h1 className="text-2xl font-bold text-gray-800">💉 服薬情報管理</h1>
        <p className="text-gray-500 text-sm mt-1">利用者の服薬タイミングとメモを管理します（自動保存）</p>
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-center">
          ⚠ {error}
        </div>
      ) : loading ? (
        <div className="text-center py-10 text-gray-400">読み込み中...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {records.map(record => (
            <div key={record.person.id} className="bg-white rounded-2xl border-2 border-gray-200 shadow-sm overflow-hidden flex flex-col">
              {/* ヘッダー */}
              <div className="bg-gray-50 p-3 border-b flex justify-between items-center">
                <div className="flex gap-2 items-center">
                  <span className="text-xl">{record.person.gender === '女' ? '👩' : '👨'}</span>
                  <div>
                    <div className="font-bold text-gray-800">{record.person.name}</div>
                    <div className="text-xs text-gray-500">{record.person.facility || '施設未設定'}</div>
                  </div>
                </div>
                {savingIds.has(record.person.id) && (
                  <span className="text-xs text-blue-500 flex items-center gap-1 animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span> 保存中
                  </span>
                )}
              </div>

              {/* 服薬リスト */}
              <div className="p-4 space-y-4">
                {TIMINGS.map(t => {
                  const hasChecked = record.medication[t.key]
                  const noteValue = record.medication[t.noteKey] || ''
                  return (
                    <div key={t.key} className="space-y-2">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{hasChecked ? '☑️' : '⬜'}</span>
                        <span className={`font-medium ${hasChecked ? 'text-blue-800' : 'text-gray-600'}`}>{t.label}</span>
                      </div>
                      
                      {hasChecked && noteValue && (
                        <div className="pl-8">
                          <div className="w-full border border-gray-100 rounded-lg px-3 py-1.5 text-sm bg-gray-50 text-gray-700">
                            {noteValue as string}
                          </div>
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
