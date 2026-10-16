'use client'

import { useEffect, useState, useCallback, type ReactNode } from 'react'

interface Schedule {
  id: number
  timeLabel: string
  location: string
  description: string | null
  assignedTo: string | null
  dayNo: number
  sortOrder: number
}

interface ScheduleForm {
  dayNo: number
  timeLabel: string
  location: string
  description: string
  assignedTo: string
}

const DAY_COLORS = ['', 'from-blue-500 to-blue-700', 'from-green-500 to-green-700']
const DAY_NAMES = ['', '1日目（10/29・木）', '2日目（10/30・金）']

async function loadSchedules(): Promise<Schedule[]> {
  const res = await fetch('/api/schedule?tripId=1')
  return res.json()
}

const toForm = (s: Schedule): ScheduleForm => ({
  dayNo: s.dayNo,
  timeLabel: s.timeLabel,
  location: s.location,
  description: s.description ?? '',
  assignedTo: s.assignedTo ?? '',
})

export default function AdminSchedulePage() {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  const [activeDay, setActiveDay] = useState(1)
  // 編集中の行（'new' は新規追加フォーム）
  const [editingId, setEditingId] = useState<number | 'new' | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchSchedules = useCallback(async () => {
    setSchedules(await loadSchedules())
  }, [])

  useEffect(() => {
    loadSchedules().then(data => {
      setSchedules(data)
      setLoading(false)
    })
  }, [])

  const daySchedules = schedules.filter((s) => s.dayNo === activeDay)

  const isImportant = (s: Schedule) =>
    s.timeLabel.includes('重要') || (s.description || '').includes('重要') || (s.description || '').includes('禁止')

  const request = async (url: string, method: string, body?: unknown) => {
    setSaving(true)
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    setSaving(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error || '保存に失敗しました')
      return false
    }
    setError(null)
    return true
  }

  const handleSave = async (form: ScheduleForm) => {
    const ok = editingId === 'new'
      ? await request('/api/schedule', 'POST', { tripId: 1, ...form })
      : await request(`/api/schedule/${editingId}`, 'PUT', form)
    if (!ok) return
    setEditingId(null)
    setActiveDay(form.dayNo)
    await fetchSchedules()
  }

  const handleDelete = async (s: Schedule) => {
    if (!confirm(`「${s.timeLabel} ${s.location}」を削除しますか？`)) return
    if (await request(`/api/schedule/${s.id}`, 'DELETE')) await fetchSchedules()
  }

  const handleMove = async (idx: number, dir: -1 | 1) => {
    const next = [...daySchedules]
    const j = idx + dir
    if (j < 0 || j >= next.length) return
    ;[next[idx], next[j]] = [next[j], next[idx]]
    // Optimistic UI
    const order = new Map(next.map((s, i) => [s.id, i + 1]))
    setSchedules(prev => prev
      .map(s => (order.has(s.id) ? { ...s, sortOrder: order.get(s.id)! } : s))
      .sort((a, b) => a.dayNo - b.dayNo || a.sortOrder - b.sortOrder))
    await request('/api/schedule/reorder', 'PUT', { ids: next.map(s => s.id) })
    await fetchSchedules()
  }

  return (
    <div className="space-y-5">
      <div className="pt-12 lg:pt-0">
        <h1 className="text-2xl font-bold text-gray-800">🗓️ スケジュール</h1>
        <p className="text-gray-500 text-sm mt-1">旅行当日の流れと担当者（追加・編集・並べ替えができます）</p>
      </div>

      {/* 日付切替 */}
      <div className="flex gap-2">
        {[1, 2].map((day) => (
          <button
            key={day}
            onClick={() => { setActiveDay(day); setEditingId(null) }}
            className={`flex-1 py-3 rounded-2xl font-semibold text-sm transition-all ${activeDay === day ? 'print-keep' : ''} ${
              activeDay === day
                ? `bg-gradient-to-r ${DAY_COLORS[day]} text-white shadow-lg`
                : 'bg-white border-2 border-gray-200 text-gray-600'
            }`}
          >
            {DAY_NAMES[day]}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-2 rounded-lg text-sm">{error}</div>
      )}

      {loading ? (
        <div className="text-center py-10 text-gray-400">読み込み中...</div>
      ) : (
        <div className="relative">
          {/* タイムライン縦線 */}
          <div className="absolute left-[52px] top-0 bottom-0 w-0.5 bg-gray-200 md:left-[72px]" />

          <div className="space-y-4">
            {daySchedules.map((s, idx) => {
              const important = isImportant(s)
              return (
                <div key={s.id} className="flex gap-4 relative">
                  {/* 時刻 */}
                  <div className="w-14 shrink-0 text-right pt-3 md:w-20">
                    <span className={`text-xs font-bold leading-tight ${important ? 'text-red-600' : 'text-gray-500'}`}>
                      {s.timeLabel}
                    </span>
                  </div>

                  {/* ドット */}
                  <div className={`w-4 h-4 rounded-full border-2 shrink-0 mt-3.5 z-10 ${
                    important ? 'bg-red-500 border-red-400' : 'bg-white border-blue-400'
                  }`} />

                  {editingId === s.id ? (
                    <div className="flex-1 min-w-0 mb-2">
                      <ScheduleEditor
                        initial={toForm(s)}
                        saving={saving}
                        onSave={handleSave}
                        onCancel={() => setEditingId(null)}
                      />
                    </div>
                  ) : (
                    /* カード */
                    <div className={`flex-1 min-w-0 rounded-2xl p-4 shadow-sm border-2 mb-2 ${
                      important
                        ? 'bg-red-50 border-red-200'
                        : 'bg-white border-gray-200'
                    }`}>
                      <div className="flex items-start gap-2">
                        <h3 className={`flex-1 min-w-0 font-bold text-sm ${important ? 'text-red-800' : 'text-gray-800'}`}>
                          {important && '⚠️ '}{s.location}
                        </h3>
                        <div className="shrink-0 flex items-center gap-1">
                          <IconButton label="上へ" disabled={idx === 0 || saving} onClick={() => handleMove(idx, -1)}>↑</IconButton>
                          <IconButton label="下へ" disabled={idx === daySchedules.length - 1 || saving} onClick={() => handleMove(idx, 1)}>↓</IconButton>
                          <IconButton label="編集" disabled={saving} onClick={() => setEditingId(s.id)}>✏️</IconButton>
                          <IconButton label="削除" disabled={saving} onClick={() => handleDelete(s)}>🗑️</IconButton>
                        </div>
                      </div>
                      {s.description && (
                        <p className={`text-xs mt-1.5 leading-relaxed whitespace-pre-wrap ${important ? 'text-red-700' : 'text-gray-600'}`}>
                          {s.description}
                        </p>
                      )}
                      {s.assignedTo && (
                        <div className="mt-2 flex items-center gap-1">
                          <span className="text-xs text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                            👤 {s.assignedTo}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* 追加 */}
          <div className="relative z-10 mt-4">
            {editingId === 'new' ? (
              <ScheduleEditor
                initial={{ dayNo: activeDay, timeLabel: '', location: '', description: '', assignedTo: '' }}
                saving={saving}
                onSave={handleSave}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <button
                onClick={() => setEditingId('new')}
                className="w-full py-3 rounded-2xl border-2 border-dashed border-blue-300 text-blue-600 font-semibold text-sm bg-white hover:bg-blue-50 transition-colors"
              >
                ＋ {DAY_NAMES[activeDay]}に予定を追加
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function IconButton({ label, disabled, onClick, children }: {
  label: string
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  )
}

function ScheduleEditor({ initial, saving, onSave, onCancel }: {
  initial: ScheduleForm
  saving: boolean
  onSave: (form: ScheduleForm) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState(initial)
  const set = <K extends keyof ScheduleForm>(key: K, value: ScheduleForm[K]) => setForm(f => ({ ...f, [key]: value }))
  const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400'

  return (
    <form
      onSubmit={e => { e.preventDefault(); onSave(form) }}
      className="rounded-2xl p-4 shadow-md border-2 border-blue-300 bg-white space-y-3"
    >
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-semibold text-gray-600">日付</span>
          <select className={inputClass} value={form.dayNo} onChange={e => set('dayNo', Number(e.target.value))}>
            {[1, 2].map(d => <option key={d} value={d}>{DAY_NAMES[d]}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-gray-600">時刻 *</span>
          <input className={inputClass} value={form.timeLabel} onChange={e => set('timeLabel', e.target.value)} placeholder="例: 08:30" required />
        </label>
      </div>
      <label className="block">
        <span className="text-xs font-semibold text-gray-600">内容 *</span>
        <input className={inputClass} value={form.location} onChange={e => set('location', e.target.value)} placeholder="例: 琵琶湖博物館 着" required />
      </label>
      <label className="block">
        <span className="text-xs font-semibold text-gray-600">詳細・メモ</span>
        <textarea className={inputClass} rows={2} value={form.description} onChange={e => set('description', e.target.value)} />
      </label>
      <label className="block">
        <span className="text-xs font-semibold text-gray-600">担当者</span>
        <input className={inputClass} value={form.assignedTo} onChange={e => set('assignedTo', e.target.value)} placeholder="例: 全員" />
      </label>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg text-sm border border-gray-300 text-gray-600 hover:bg-gray-50">
          キャンセル
        </button>
        <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
          {saving ? '保存中...' : '保存'}
        </button>
      </div>
    </form>
  )
}
