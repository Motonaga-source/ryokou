'use client'

import { useEffect, useState, useCallback } from 'react'

interface PocketMoneyRecord {
  id: number
  allocated: number
  used: number
  remaining: number
  person: { id: number; name: string; gender: string | null; facility: string | null }
}

interface PocketMoneyData {
  records: PocketMoneyRecord[]
  total: { allocated: number; used: number; remaining: number }
}

export default function PocketMoneyPage() {
  const [data, setData] = useState<PocketMoneyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editUsed, setEditUsed] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const [error, setError] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/pocket-money?tripId=1')
      if (!res.ok) throw new Error('データ取得に失敗しました')
      setData(await res.json())
    } catch (e: any) {
      console.error(e)
      setError(e.message || 'データ取得エラー')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSave = async (record: PocketMoneyRecord) => {
    setSaving(true)
    const used = parseInt(editUsed)
    if (isNaN(used) || used < 0 || used > record.allocated) {
      showToast(`⚠️ 0〜${record.allocated.toLocaleString()}円の範囲で入力してください`)
      setSaving(false)
      return
    }
    try {
      const res = await fetch(`/api/pocket-money/${record.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ used, allocated: record.allocated, personId: record.person.id }),
      })
      if (!res.ok) throw new Error('更新に失敗しました')
      showToast('✅ 精算情報を更新しました')
    } catch (e) {
      showToast('❌ 保存エラーが発生しました')
    } finally {
      setSaving(false)
      setEditingId(null)
      fetchData()
    }
  }

  const getUsageRate = (record: PocketMoneyRecord) =>
    Math.round((record.used / record.allocated) * 100)

  return (
    <div className="space-y-5">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-800 text-white px-4 py-3 rounded-xl shadow-xl text-sm">
          {toast}
        </div>
      )}

      <div className="pt-12 md:pt-0">
        <h1 className="text-2xl font-bold text-gray-800">💴 小遣い精算</h1>
        <p className="text-gray-500 text-sm mt-1">利用者への支給額・使用額・残額管理</p>
      </div>

      {/* 合計サマリー */}
      {data && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-blue-50 rounded-2xl border-2 border-blue-200 p-4 text-center">
            <div className="text-xs text-blue-600 mb-1">支給合計</div>
            <div className="text-xl font-bold text-blue-800">¥{data.total.allocated.toLocaleString()}</div>
          </div>
          <div className="bg-orange-50 rounded-2xl border-2 border-orange-200 p-4 text-center">
            <div className="text-xs text-orange-600 mb-1">使用合計</div>
            <div className="text-xl font-bold text-orange-800">¥{data.total.used.toLocaleString()}</div>
          </div>
          <div className="bg-green-50 rounded-2xl border-2 border-green-200 p-4 text-center">
            <div className="text-xs text-green-600 mb-1">残金合計</div>
            <div className="text-xl font-bold text-green-800">¥{data.total.remaining.toLocaleString()}</div>
          </div>
        </div>
      )}

      {/* 一覧 */}
      {error ? (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-center">
          ⚠ {error}
        </div>
      ) : loading ? (
        <div className="text-center py-10 text-gray-400">読み込み中...</div>
      ) : (
        <div className="space-y-3">
          {data?.records.map((record) => {
            const rate = getUsageRate(record)
            const isEditing = editingId === record.id
            return (
              <div key={record.id} className="bg-white rounded-2xl border-2 border-gray-200 shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{record.person.gender === '女' ? '👩' : '👨'}</span>
                    <div>
                      <span className="font-semibold text-gray-800 text-sm">{record.person.name}</span>
                      <div className="text-xs text-gray-400">{record.person.facility}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (isEditing) { setEditingId(null) }
                      else { setEditingId(record.id); setEditUsed(String(record.used)) }
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      isEditing ? 'bg-gray-200 text-gray-600' : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }`}
                  >
                    {isEditing ? 'キャンセル' : '✏️ 編集'}
                  </button>
                </div>

                {/* 使用率バー */}
                <div className="mb-3">
                  <div className="bg-gray-100 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all ${rate >= 100 ? 'bg-red-500' : rate >= 80 ? 'bg-orange-500' : 'bg-green-500'}`}
                      style={{ width: `${Math.min(rate, 100)}%` }}
                    />
                  </div>
                </div>

                {isEditing ? (
                  <div className="flex gap-2 items-center">
                    <div className="flex-1">
                      <label className="text-xs text-gray-500 block mb-1">使用額（円）</label>
                      <input
                        type="number"
                        value={editUsed}
                        onChange={(e) => setEditUsed(e.target.value)}
                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                        min="0"
                        max={record.allocated}
                      />
                    </div>
                    <button
                      onClick={() => handleSave(record)}
                      disabled={saving}
                      className="mt-5 bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50"
                    >
                      {saving ? '...' : '✅'}
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-xs text-gray-500">支給</div>
                      <div className="font-bold text-gray-700">¥{record.allocated.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-xs text-orange-500">使用</div>
                      <div className="font-bold text-orange-700">¥{record.used.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-xs text-green-500">残金</div>
                      <div className={`font-bold ${record.remaining >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                        ¥{record.remaining.toLocaleString()}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
