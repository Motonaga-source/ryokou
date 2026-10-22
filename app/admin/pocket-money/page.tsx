'use client'

import { useEffect, useState, useCallback } from 'react'
import AllowanceRules from '@/components/AllowanceRules'
import { ALLOWANCE_TYPES, MAX_ALLOWANCE_YEN, isCorporateAllowance } from '@/lib/allowance'

interface PocketMoneyRecord {
  id: number // 利用者のID
  allocated: number | null // 支給額（未設定は null）
  used: number
  remaining: number | null
  person: {
    id: number
    name: string
    gender: string | null
    facility: string | null
    allowanceManagementType: string | null
  }
}

interface PocketMoneyData {
  records: PocketMoneyRecord[]
  total: { allocated: number; used: number; remaining: number }
  unsetCount: number
}

const yen = (n: number) => `¥${n.toLocaleString()}`

async function loadData(): Promise<PocketMoneyData> {
  const res = await fetch('/api/pocket-money?tripId=1')
  if (!res.ok) throw new Error('データ取得に失敗しました')
  return res.json()
}

export default function AdminPocketMoneyPage() {
  const [data, setData] = useState<PocketMoneyData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editAllocated, setEditAllocated] = useState('')
  const [editUsed, setEditUsed] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const refresh = useCallback(async () => {
    try {
      setData(await loadData())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'データ取得エラー')
    }
  }, [])

  useEffect(() => {
    loadData().then(setData).catch(e => setError(e instanceof Error ? e.message : 'データ取得エラー'))
  }, [])

  const startEdit = (record: PocketMoneyRecord) => {
    setEditingId(record.id)
    setEditAllocated(record.allocated === null ? '' : String(record.allocated))
    setEditUsed(String(record.used))
  }

  const handleSave = async (record: PocketMoneyRecord) => {
    const allocated = Number(editAllocated)
    const used = Number(editUsed)
    if (editAllocated.trim() === '' || !Number.isInteger(allocated) || allocated < 0 || allocated > MAX_ALLOWANCE_YEN) {
      showToast('⚠️ 支給額を0円以上の整数で入力してください')
      return
    }
    if (!Number.isInteger(used) || used < 0 || used > MAX_ALLOWANCE_YEN) {
      showToast('⚠️ 使用額を0円以上の整数で入力してください')
      return
    }
    setSaving(true)
    const res = await fetch(`/api/pocket-money/person/${record.person.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tripId: 1, allocated, used }),
    })
    setSaving(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      showToast(`❌ ${body.error || '保存に失敗しました'}`)
      return
    }
    showToast(used > allocated ? '⚠️ 保存しました（使用額が支給額を超えています）' : '✅ 精算情報を更新しました')
    setEditingId(null)
    await refresh()
  }

  return (
    <div className="space-y-5">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-800 text-white px-4 py-3 rounded-xl shadow-xl text-sm">
          {toast}
        </div>
      )}

      <div className="pt-12 lg:pt-0">
        <h1 className="text-2xl font-bold text-gray-800">💴 小遣い精算</h1>
        <p className="text-gray-500 text-sm mt-1">小遣いの管理区分・事後回収の設定と、利用者ごとの支給額・使用額・残額の管理</p>
      </div>

      {/* 事前のルール設定（管理区分・事後回収の要否） */}
      <AllowanceRules />

      {/* 合計サマリー（自己管理の方と支給額が未設定の方は含まない） */}
      {data && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-blue-50 rounded-2xl border-2 border-blue-200 p-4 text-center">
              <div className="text-xs text-blue-600 mb-1">支給合計</div>
              <div className="text-xl font-bold text-blue-800 tabular-nums">{yen(data.total.allocated)}</div>
            </div>
            <div className="bg-orange-50 rounded-2xl border-2 border-orange-200 p-4 text-center">
              <div className="text-xs text-orange-600 mb-1">使用合計</div>
              <div className="text-xl font-bold text-orange-800 tabular-nums">{yen(data.total.used)}</div>
            </div>
            <div className="bg-green-50 rounded-2xl border-2 border-green-200 p-4 text-center">
              <div className="text-xs text-green-600 mb-1">残金合計</div>
              <div className="text-xl font-bold text-green-800 tabular-nums">{yen(data.total.remaining)}</div>
            </div>
          </div>
          {data.unsetCount > 0 && (
            <p className="text-sm">
              <span className="inline-flex items-center gap-1 rounded-full border border-orange-300 bg-orange-50 px-3 py-1 font-semibold text-orange-800">
                ⚠️ 支給額が未設定の方 {data.unsetCount}名（「✏️ 編集」から入力してください）
              </span>
            </p>
          )}
        </>
      )}

      {/* 一覧 */}
      {error ? (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-center">⚠ {error}</div>
      ) : !data ? (
        <div className="text-center py-10 text-gray-400">読み込み中...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3">
          {data.records.map(record => {
            const corporate = isCorporateAllowance(record.person.allowanceManagementType)
            const typeLabel = ALLOWANCE_TYPES.find(t => t.value === record.person.allowanceManagementType)?.label
            const isEditing = editingId === record.id
            const rate = record.allocated ? Math.round((record.used / record.allocated) * 100) : 0
            return (
              <div key={record.id} className={`break-inside-avoid rounded-2xl border-2 shadow-sm p-4 ${corporate ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-200'}`}>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xl">{record.person.gender === '女' ? '👩' : '👨'}</span>
                    <div className="min-w-0">
                      <span className={`font-semibold text-sm ${corporate ? 'text-gray-800' : 'text-gray-500'}`}>{record.person.name}</span>
                      <div className="text-xs text-gray-400">
                        {record.person.facility}
                        {typeLabel && <span className="ml-1.5 rounded bg-gray-100 px-1 text-[10px] text-gray-600">{typeLabel}</span>}
                      </div>
                    </div>
                  </div>
                  {corporate && (
                    <button
                      onClick={() => (isEditing ? setEditingId(null) : startEdit(record))}
                      className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        isEditing ? 'bg-gray-200 text-gray-600' : 'bg-green-100 text-green-700 hover:bg-green-200'
                      }`}
                    >
                      {isEditing ? 'キャンセル' : '✏️ 編集'}
                    </button>
                  )}
                </div>

                {!corporate ? (
                  // 自己管理（法人準備なし）は法人がお金を預からないため、支給額の入力・精算の対象外
                  <p className="text-xs text-gray-500">自己管理（法人準備なし）のため、支給額の設定・精算の対象外です。</p>
                ) : isEditing ? (
                  <div className="flex gap-2 items-end">
                    <label className="flex-1 min-w-0">
                      <span className="text-xs text-gray-500 block mb-1">支給額（円）</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={editAllocated}
                        onChange={e => setEditAllocated(e.target.value)}
                        placeholder="例: 5000"
                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                        min="0"
                        step="100"
                      />
                    </label>
                    <label className="flex-1 min-w-0">
                      <span className="text-xs text-gray-500 block mb-1">使用額（円）</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={editUsed}
                        onChange={e => setEditUsed(e.target.value)}
                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                        min="0"
                      />
                    </label>
                    <button
                      onClick={() => handleSave(record)}
                      disabled={saving}
                      className="shrink-0 bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50"
                    >
                      {saving ? '...' : '✅ 保存'}
                    </button>
                  </div>
                ) : (
                  <>
                    {/* 使用率バー（個別の支給額に対する割合） */}
                    <div className="mb-3 bg-gray-100 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full transition-all ${rate >= 100 ? 'bg-red-500' : rate >= 80 ? 'bg-orange-500' : 'bg-green-500'}`}
                        style={{ width: `${Math.min(rate, 100)}%` }}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center tabular-nums">
                      <div>
                        <div className="text-xs text-gray-500">支給</div>
                        <div className={`font-bold ${record.allocated === null ? 'text-orange-600 text-sm' : 'text-gray-700'}`}>
                          {record.allocated === null ? '未設定' : yen(record.allocated)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-orange-500">使用</div>
                        <div className="font-bold text-orange-700">{yen(record.used)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-green-500">残金</div>
                        <div className={`font-bold ${record.remaining === null ? 'text-gray-400' : record.remaining >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                          {record.remaining === null ? '—' : yen(record.remaining)}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
