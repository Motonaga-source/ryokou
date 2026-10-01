'use client'

import { useEffect, useState, useCallback } from 'react'

interface Person {
  id: number
  name: string
  gender: string | null
  role: string
  facility: string | null
  notes: string | null
  isWheelchair: boolean
  medication: {
    hasBreakfast: boolean
    hasLunch: boolean
    hasDinner: boolean
    hasSleep: boolean
    hasAsNeeded: boolean
  } | null
  participations: Array<{ status: string; feeMethod: string | null; feeCollected: boolean }>
  roomAssignments: Array<{ room: { roomNumber: string; floor: number } }>
}

const FACILITIES = ['グレイス', '瓜破西', 'ドルチェ', 'セントリビエ', '全て']
const STATUSES = ['参加', '不参加', '保留', '全て']

export default function PersonsPage() {
  const [persons, setPersons] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState({ role: 'USER', facility: '全て', status: '全て', search: '' })
  
  // editingId === -1 means "Create New"
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<Partial<Person> & { status?: string }>({})
  const [saving, setSaving] = useState(false)

  const fetchPersons = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/persons?role=${filter.role}&tripId=1`)
      if (!res.ok) throw new Error('データ取得に失敗しました')
      const data = await res.json()
      setPersons(data)
    } catch (e: any) {
      alert(e.message || 'データ取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [filter.role])

  useEffect(() => { fetchPersons() }, [fetchPersons])

  const filtered = persons.filter((p) => {
    if (filter.facility !== '全て' && p.facility !== filter.facility) return false
    if (filter.status !== '全て') {
      const part = p.participations[0]
      if (!part || part.status !== filter.status) return false
    }
    if (filter.search) {
      return p.name.includes(filter.search) || (p.facility || '').includes(filter.search)
    }
    return true
  })

  const handleCreate = () => {
    setEditingId(-1)
    setEditForm({
      name: '',
      gender: '男',
      role: filter.role,
      facility: '',
      notes: '',
      status: filter.role === 'STAFF' ? '参加' : '保留'
    })
  }

  const handleEdit = (person: Person) => {
    setEditingId(person.id)
    setEditForm({ 
      name: person.name, 
      gender: person.gender, 
      role: person.role,
      facility: person.facility, 
      notes: person.notes,
      isWheelchair: person.isWheelchair,
      status: person.participations[0]?.status || '参加'
    })
  }

  const handleSave = async () => {
    if (!editingId) return
    setSaving(true)
    
    if (editingId === -1) {
      await fetch('/api/persons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
    } else {
      await fetch(`/api/persons/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
    }

    setSaving(false)
    setEditingId(null)
    fetchPersons()
  }

  const handleDelete = async (id: number) => {
    if (!confirm('本当に削除しますか？')) return
    setSaving(true)
    try {
      const res = await fetch(`/api/persons/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const errorData = await res.json()
        alert(`削除エラー: ${errorData.error}`)
      }
    } catch (e) {
      alert('ネットワークエラーが発生しました')
    }
    setSaving(false)
    fetchPersons()
  }

  const getStatusBadge = (person: Person) => {
    const part = person.participations[0]
    if (!part) return <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500">未設定</span>
    const colors: Record<string, string> = {
      参加: 'bg-green-100 text-green-700',
      不参加: 'bg-red-100 text-red-700',
      保留: 'bg-yellow-100 text-yellow-700',
    }
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[part.status] || 'bg-gray-100'}`}>
        {part.status}
      </span>
    )
  }

  const getRoom = (person: Person) => {
    const ra = person.roomAssignments?.[0]
    return ra ? `${ra.room.floor}F-${ra.room.roomNumber}号室` : '未割り当て'
  }

  return (
    <div className="space-y-5">
      <div className="pt-12 md:pt-0 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">👥 参加者名簿 (編集)</h1>
          <p className="text-gray-500 text-sm mt-1">
            {filtered.length}名 / 全{persons.length}名
          </p>
        </div>
        
      </div>

      {/* フィルター */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm space-y-3">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter((f) => ({ ...f, role: 'USER' }))}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${filter.role === 'USER' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            🧑 利用者
          </button>
          <button
            onClick={() => setFilter((f) => ({ ...f, role: 'STAFF' }))}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${filter.role === 'STAFF' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            👨‍💼 スタッフ
          </button>
        </div>

        <input
          type="search"
          placeholder="名前・施設で検索..."
          value={filter.search}
          onChange={(e) => setFilter((f) => ({ ...f, search: e.target.value }))}
          className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />

        <div className="flex gap-2 flex-wrap">
          {FACILITIES.map((f) => (
            <button
              key={f}
              onClick={() => setFilter((prev) => ({ ...prev, facility: f }))}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filter.facility === f ? 'bg-blue-100 text-blue-700 border border-blue-300' : 'bg-gray-100 text-gray-600'}`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setFilter((prev) => ({ ...prev, status: s }))}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filter.status === s ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-gray-100 text-gray-600'}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* 一覧 */}
      {loading ? (
        <div className="text-center py-10 text-gray-400">読み込み中...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          
          {editingId === -1 && (
             <div className="bg-white rounded-2xl border-2 border-blue-400 shadow-lg overflow-hidden flex flex-col p-4 space-y-3">
               <div className="flex justify-between items-center">
                 <h3 className="font-bold text-blue-700">✨ 新規追加</h3>
                 <button onClick={() => setEditingId(null)} className="text-gray-400 text-sm">キャンセル</button>
               </div>
               <input
                 value={editForm.name || ''}
                 onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                 className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm"
                 placeholder="氏名 (必須)"
               />
               <div className="grid grid-cols-2 gap-2">
                 <select
                   value={editForm.gender || ''}
                   onChange={(e) => setEditForm((f) => ({ ...f, gender: e.target.value }))}
                   className="border border-gray-300 rounded-xl px-3 py-2 text-sm"
                 >
                   <option value="男">男</option>
                   <option value="女">女</option>
                 </select>
                 <select
                   value={editForm.role || ''}
                   onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}
                   className="border border-gray-300 rounded-xl px-3 py-2 text-sm"
                 >
                   <option value="USER">利用者</option>
                   <option value="STAFF">スタッフ</option>
                 </select>
               </div>
               <div className="grid grid-cols-2 gap-2">
                 <select
                   value={editForm.facility || ''}
                   onChange={(e) => setEditForm((f) => ({ ...f, facility: e.target.value }))}
                   className="border border-gray-300 rounded-xl px-3 py-2 text-sm"
                 >
                   <option value="">施設未設定</option>
                   {FACILITIES.filter((f) => f !== '全て').map((f) => (
                     <option key={f} value={f}>{f}</option>
                   ))}
                 </select>
                 <select
                   value={editForm.status || '参加'}
                   onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
                   className="border border-gray-300 rounded-xl px-3 py-2 text-sm"
                 >
                   <option value="参加">参加</option>
                   <option value="不参加">不参加</option>
                   <option value="保留">保留</option>
                 </select>
               </div>
               <textarea
                 value={editForm.notes || ''}
                 onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                 className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm"
                 placeholder="備考"
                 rows={2}
               />
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={(editForm as any).isWheelchair || false}
                    onChange={(e) => setEditForm((f) => ({ ...f, isWheelchair: e.target.checked }))}
                    className="w-4 h-4 accent-pink-500"
                  />
                  <span className="text-sm text-gray-700">♿ 車椅子利用</span>
                </label>
                              <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={(editForm as any).isWheelchair || false}
                    onChange={(e) => setEditForm((f) => ({ ...f, isWheelchair: e.target.checked }))}
                    className="w-4 h-4 accent-pink-500"
                  />
                  <span className="text-sm text-gray-700">♿ 車椅子利用</span>
                </label>
<button
                 onClick={handleSave}
                 disabled={saving || !editForm.name}
                 className="w-full bg-blue-600 text-white rounded-xl py-2.5 font-medium text-sm disabled:opacity-50"
               >
                 {saving ? '保存中...' : '✅ 登録する'}
               </button>
             </div>
          )}

          {filtered.map((person) => (
            <div key={person.id} className={`rounded-2xl border-2 shadow-sm overflow-hidden flex flex-col ${person.isWheelchair ? 'bg-pink-100 border-pink-300' : person.role === 'STAFF' ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'}`}>
              {editingId === person.id ? (
                // 編集フォーム
                <div className="p-4 space-y-3 flex-1 border-2 border-blue-400 rounded-2xl">
                  <div className="flex justify-between items-center">
                    <h3 className="font-semibold text-gray-700">✏️ 編集中</h3>
                    <button onClick={() => setEditingId(null)} className="text-gray-400 text-sm">キャンセル</button>
                  </div>
                  <input
                    value={editForm.name || ''}
                    onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm"
                    placeholder="氏名"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={editForm.gender || ''}
                      onChange={(e) => setEditForm((f) => ({ ...f, gender: e.target.value }))}
                      className="border border-gray-300 rounded-xl px-3 py-2 text-sm"
                    >
                      <option value="">性別不明</option>
                      <option value="男">男</option>
                      <option value="女">女</option>
                    </select>
                    <select
                      value={editForm.role || ''}
                      onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}
                      className="border border-gray-300 rounded-xl px-3 py-2 text-sm"
                    >
                      <option value="USER">利用者</option>
                      <option value="STAFF">スタッフ</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={editForm.facility || ''}
                      onChange={(e) => setEditForm((f) => ({ ...f, facility: e.target.value }))}
                      className="border border-gray-300 rounded-xl px-3 py-2 text-sm"
                    >
                      <option value="">施設未設定</option>
                      {FACILITIES.filter((f) => f !== '全て').map((f) => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                    <select
                      value={editForm.status || '参加'}
                      onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
                      className="border border-gray-300 rounded-xl px-3 py-2 text-sm"
                    >
                      <option value="参加">参加</option>
                      <option value="不参加">不参加</option>
                      <option value="保留">保留</option>
                    </select>
                  </div>
                  <textarea
                    value={editForm.notes || ''}
                    onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm"
                    placeholder="備考"
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDelete(person.id)}
                      disabled={saving}
                      className="bg-red-50 text-red-600 rounded-xl px-4 font-medium text-sm disabled:opacity-50 hover:bg-red-100"
                    >
                      削除
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex-1 bg-blue-600 text-white rounded-xl py-2.5 font-medium text-sm disabled:opacity-50 hover:bg-blue-700"
                    >
                      {saving ? '保存中...' : '✅ 保存する'}
                    </button>
                  </div>
                </div>
              ) : (
                // 表示モード
                <div className="p-4 flex items-start gap-3 h-full">
                  {/* アバター */}
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center text-xl shrink-0 ${person.gender === '女' ? 'bg-pink-100' : 'bg-blue-100'}`}>
                    {person.gender === '女' ? '👩' : '👨'}
                  </div>
                  {/* 情報 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-800">{person.isWheelchair && '♿️ '}{person.name}</span>
                      {getStatusBadge(person)}
                    </div>
                    {person.medication && (person.medication.hasBreakfast || person.medication.hasLunch || person.medication.hasDinner || person.medication.hasSleep || person.medication.hasAsNeeded) && (
                      <div className="mt-1">
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-purple-100 text-purple-700 font-medium">
                          💊 服薬あり
                        </span>
                      </div>
                    )}
                    <div className="text-xs text-gray-500 mt-2 flex items-center gap-3">
                      <span>🏠 {person.facility || '施設不明'}</span>
                      <span>🛏️ {getRoom(person)}</span>
                    </div>
                    {person.notes && (
                      <div className="text-xs text-amber-600 mt-2 p-2 bg-amber-50 rounded-lg">
                        ⚠️ {person.notes}
                      </div>
                    )}
                  </div>
                  {/* 編集ボタン */}
                  
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {filtered.length === 0 && !loading && editingId !== -1 && (
        <div className="text-center py-10 text-gray-400">
          該当する方が見つかりませんでした
        </div>
      )}
    </div>
  )
}
