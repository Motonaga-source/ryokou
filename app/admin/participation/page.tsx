'use client'
// 参加者の登録: 法人共通の名簿（全員）から、選択中のイベントに「参加／不参加／保留」を付ける
// 氏名・車椅子利用・魚料理NG などの本人の情報は全イベント共通（名簿の編集は「参加者名簿 (編集)」で行う）

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import FishNGBadge from '@/components/FishNGBadge'
import { useCurrentEvent } from '@/lib/useCurrentEvent'
import { formatEventPeriod } from '@/lib/event-shared'
import { PARTICIPATION_STATUSES, type ParticipationRow, type ParticipationStatus } from '@/lib/participation'

const ROLES = [
  { key: 'USER', label: '🧑 利用者' },
  { key: 'STAFF', label: '👨‍💼 スタッフ' },
] as const
const FILTERS = ['全て', '参加', '不参加', '保留', '未登録'] as const
type Filter = (typeof FILTERS)[number]

const STATUS_STYLE: Record<ParticipationStatus, { on: string; off: string }> = {
  参加: { on: 'bg-green-600 text-white border-green-600', off: 'bg-white text-green-700 border-green-300 hover:bg-green-50' },
  不参加: { on: 'bg-red-500 text-white border-red-500', off: 'bg-white text-red-600 border-red-200 hover:bg-red-50' },
  保留: { on: 'bg-amber-400 text-amber-950 border-amber-400', off: 'bg-white text-amber-700 border-amber-200 hover:bg-amber-50' },
}

async function loadRows(): Promise<ParticipationRow[]> {
  const res = await fetch('/api/participation', { cache: 'no-store' })
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? '名簿の取得に失敗しました')
  return res.json()
}

export default function ParticipationPage() {
  const { event, readOnly } = useCurrentEvent()
  const [rows, setRows] = useState<ParticipationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [role, setRole] = useState<'USER' | 'STAFF'>('USER')
  const [facility, setFacility] = useState('全て')
  const [filter, setFilter] = useState<Filter>('全て')
  const [search, setSearch] = useState('')

  const reload = useCallback(async () => {
    try {
      setRows(await loadRows())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : '名簿の取得に失敗しました')
    }
  }, [])

  useEffect(() => {
    loadRows()
      .then(setRows)
      .catch(e => setError(e instanceof Error ? e.message : '名簿の取得に失敗しました'))
      .finally(() => setLoading(false))
  }, [])

  const facilities = useMemo(
    () => ['全て', ...new Set(rows.map(r => r.facility).filter((f): f is string => !!f))],
    [rows]
  )
  const roleRows = rows.filter(r => r.role === role)
  const visible = roleRows.filter(r => {
    if (facility !== '全て' && r.facility !== facility) return false
    if (filter === '未登録' ? r.status !== null : filter !== '全て' && r.status !== filter) return false
    if (search && !r.name.includes(search) && !(r.facility ?? '').includes(search)) return false
    return true
  })
  const count = (list: ParticipationRow[], s: ParticipationStatus | null) => list.filter(r => r.status === s).length

  // 参加状況を保存する（画面は先に切り替え、失敗したら読み込み直す）
  const save = async (personIds: number[], status: ParticipationStatus) => {
    if (readOnly || personIds.length === 0) return
    setSaving(true)
    setRows(prev => prev.map(r => (personIds.includes(r.id) ? { ...r, status } : r)))
    try {
      const res = await fetch('/api/participation', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personIds, status }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? '保存に失敗しました')
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存に失敗しました')
      await reload()
    } finally {
      setSaving(false)
    }
  }

  const saveVisible = (status: ParticipationStatus) => {
    const targets = visible.filter(r => r.status !== status)
    if (targets.length === 0) return
    if (!confirm(`表示中の ${targets.length}名を「${status}」にします。よろしいですか？`)) return
    save(targets.map(r => r.id), status)
  }

  return (
    <div className="space-y-5">
      <div className="pt-12 lg:pt-0">
        <h1 className="text-2xl font-bold text-gray-800">✅ 参加者の登録</h1>
        <p className="text-gray-500 text-sm mt-1">
          {event ? `${event.name}（${formatEventPeriod(event)}）` : 'イベント'}に参加する人を選びます。
          氏名・車椅子・魚料理NGなどの本人の情報は全イベント共通です（
          <Link href="/admin/persons" className="text-blue-600 underline">参加者名簿 (編集)</Link>
          で変更）。
        </p>
      </div>

      {/* 集計 */}
      <div className="flex flex-wrap gap-2 text-sm">
        {ROLES.map(r => {
          const list = rows.filter(p => p.role === r.key)
          return (
            <div key={r.key} className="rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm">
              <span className="font-semibold text-gray-700">{r.label}</span>
              <span className="ml-2 text-green-700">参加 <b>{count(list, '参加')}</b></span>
              <span className="ml-2 text-red-600">不参加 {count(list, '不参加')}</span>
              <span className="ml-2 text-amber-700">保留 {count(list, '保留')}</span>
              <span className="ml-2 text-gray-500">未登録 {count(list, null)}</span>
            </div>
          )
        })}
      </div>

      {/* 絞り込み */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm space-y-3">
        <div className="flex gap-2">
          {ROLES.map(r => (
            <button
              key={r.key}
              onClick={() => setRole(r.key)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${role === r.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <input
          type="search"
          placeholder="名前・施設で検索..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <div className="flex gap-2 flex-wrap">
          {facilities.map(f => (
            <button
              key={f}
              onClick={() => setFacility(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium ${facility === f ? 'bg-blue-100 text-blue-700 border border-blue-300' : 'bg-gray-100 text-gray-600'}`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap">
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium ${filter === f ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-gray-100 text-gray-600'}`}
            >
              {f}
            </button>
          ))}
        </div>
        {!readOnly && (
          <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
            <span className="text-xs text-gray-500">表示中の {visible.length}名をまとめて:</span>
            {PARTICIPATION_STATUSES.map(s => (
              <button
                key={s}
                disabled={saving || visible.length === 0}
                onClick={() => saveVisible(s)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-semibold disabled:opacity-40 ${STATUS_STYLE[s].off}`}
              >
                {s}にする
              </button>
            ))}
          </div>
        )}
      </div>

      {error && <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-2 rounded-lg text-sm">{error}</div>}

      {/* 一覧 */}
      {loading ? (
        <div className="text-center py-10 text-gray-400">読み込み中...</div>
      ) : visible.length === 0 ? (
        <div className="text-center py-10 text-gray-400">該当する方が見つかりませんでした</div>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {visible.map(r => (
            <li
              key={r.id}
              className={`flex items-center gap-3 rounded-2xl border-2 p-3 shadow-sm ${r.isWheelchair ? 'bg-pink-50 border-pink-200' : 'bg-white border-gray-200'}`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-semibold text-gray-800 truncate">{r.isWheelchair && '♿️ '}{r.name}</span>
                  {r.isFishNG && <FishNGBadge />}
                  {r.status === null && <span className="px-2 py-0.5 rounded-full text-[10px] bg-gray-100 text-gray-500">未登録</span>}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">🏠 {r.facility || '施設不明'}</div>
              </div>
              <div className="flex shrink-0 overflow-hidden rounded-lg">
                {PARTICIPATION_STATUSES.map(s => (
                  <button
                    key={s}
                    disabled={readOnly || saving}
                    onClick={() => r.status !== s && save([r.id], s)}
                    aria-pressed={r.status === s}
                    className={`border px-2.5 py-1.5 text-xs font-semibold first:rounded-l-lg last:rounded-r-lg -ml-px first:ml-0 disabled:cursor-not-allowed ${r.status === s ? STATUS_STYLE[s].on : STATUS_STYLE[s].off} ${readOnly && r.status !== s ? 'opacity-40' : ''}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
