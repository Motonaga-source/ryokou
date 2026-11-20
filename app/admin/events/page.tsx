'use client'
// イベント管理: イベントの作成・編集、使う機能の ON/OFF、終了（閲覧専用）・再開
// 機能の並び順はメニューの並び順（全体で1つ。「メニュー並び替え」で変更）に従う

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { MODULES, type ModuleDef } from '@/lib/modules'
import { useMenuItems } from '@/lib/useMenuOrder'
import { switchEvent, useCurrentEvent } from '@/lib/useCurrentEvent'
import type { EventDetail } from '@/lib/event-input'

type FormState = {
  name: string
  destination: string
  startDate: string
  endDate: string
  travelFee: string
  pocketMoney: string
  dashboardNotes: string
  modules: string[]
}

const EMPTY_FORM: FormState = {
  name: '',
  destination: '',
  startDate: '',
  endDate: '',
  travelFee: '',
  pocketMoney: '',
  dashboardNotes: '',
  // 新しいイベントは「参加者名簿」だけ ON で始める（必要な機能を選んで ON にする）
  modules: ['persons'],
}

const toForm = (e: EventDetail): FormState => ({
  name: e.name,
  destination: e.destination,
  startDate: e.startDate,
  endDate: e.endDate,
  travelFee: e.travelFee === null ? '' : String(e.travelFee),
  pocketMoney: e.pocketMoney === null ? '' : String(e.pocketMoney),
  dashboardNotes: e.dashboardNotes ?? '',
  modules: e.modules,
})

const period = (e: { startDate: string; endDate: string }) => {
  const f = (s: string) => `${Number(s.slice(5, 7))}/${Number(s.slice(8, 10))}`
  return e.startDate === e.endDate ? `${e.startDate.slice(0, 4)}/${f(e.startDate)}` : `${e.startDate.slice(0, 4)}/${f(e.startDate)} 〜 ${f(e.endDate)}`
}

async function send(url: string, method: string, body: unknown) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const json = await res.json().catch(() => null)
  if (!res.ok) throw new Error(json?.error ?? '保存に失敗しました')
  return json
}

export default function EventsPage() {
  const { event: current } = useCurrentEvent()
  const menuItems = useMenuItems()
  const [events, setEvents] = useState<EventDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<number | 'new' | null>(null)

  // 機能をメニューの並び順で並べる（メニューにない管理者専用の機能は末尾）
  const orderedModules = useMemo(() => {
    const byMenu = menuItems.map(m => MODULES.find(x => x.menuPath === m.path)).filter((m): m is ModuleDef => !!m)
    return [...byMenu, ...MODULES.filter(m => !byMenu.includes(m))]
  }, [menuItems])

  const load = useCallback(async () => {
    const res = await fetch('/api/events?detail=1', { cache: 'no-store' })
    if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? 'イベントの取得に失敗しました')
    return (await res.json()) as EventDetail[]
  }, [])

  useEffect(() => {
    load()
      .then(setEvents)
      .catch(e => setError(e instanceof Error ? e.message : 'イベントの取得に失敗しました'))
      .finally(() => setLoading(false))
  }, [load])

  // 保存のあと: 選択中のイベントを変えたときはメニューなどにも反映するため読み込み直す
  const afterSave = async (id: number) => {
    if (current?.id === id) {
      window.location.reload()
      return
    }
    setEvents(await load())
    setEditing(null)
    setError(null)
  }

  const create = async (form: FormState) => {
    const { id } = await send('/api/events', 'POST', form)
    if (confirm('イベントを作りました。このイベントに切り替えますか？')) {
      await switchEvent(id)
      return
    }
    await afterSave(id)
  }

  const update = async (id: number, body: Record<string, unknown>) => {
    await send(`/api/events/${id}`, 'PUT', body)
    await afterSave(id)
  }

  return (
    <div className="space-y-5">
      <div className="pt-12 lg:pt-0 flex flex-wrap justify-between items-end gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">🗂️ イベント管理</h1>
          <p className="text-gray-500 text-sm mt-1">
            イベントの作成・編集と、イベントごとに使う機能の ON/OFF を設定します。メニューの並び順は全イベント共通です（
            <Link href="/admin/menu-order" className="text-blue-600 underline">メニュー並び替え</Link>）。
          </p>
        </div>
        {editing !== 'new' && (
          <button
            onClick={() => setEditing('new')}
            className="bg-blue-600 text-white px-4 py-2 rounded-xl font-medium shadow-sm hover:bg-blue-700"
          >
            ＋ 新しいイベント
          </button>
        )}
      </div>

      {error && <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-2 rounded-lg text-sm">{error}</div>}

      {editing === 'new' && (
        <EventForm
          title="✨ 新しいイベント"
          initial={EMPTY_FORM}
          modules={orderedModules}
          submitLabel="✅ 作成する"
          onSubmit={create}
          onCancel={() => setEditing(null)}
        />
      )}

      {loading ? (
        <div className="text-center py-10 text-gray-400">読み込み中...</div>
      ) : (
        <div className="space-y-4">
          {events.map(e =>
            editing === e.id ? (
              <EventForm
                key={e.id}
                title={`✏️ ${e.name}`}
                initial={toForm(e)}
                modules={orderedModules}
                closed={e.status === 'CLOSED'}
                submitLabel="✅ 保存する"
                onSubmit={form => update(e.id, form)}
                onCancel={() => setEditing(null)}
                onClose={() => update(e.id, { status: 'CLOSED' })}
                onReopen={() => update(e.id, { status: 'ACTIVE' })}
              />
            ) : (
              <EventCard
                key={e.id}
                event={e}
                modules={orderedModules}
                isCurrent={current?.id === e.id}
                onEdit={() => setEditing(e.id)}
                onSwitch={() => switchEvent(e.id)}
              />
            )
          )}
        </div>
      )}
    </div>
  )
}

function EventCard({ event: e, modules, isCurrent, onEdit, onSwitch }: {
  event: EventDetail
  modules: ModuleDef[]
  isCurrent: boolean
  onEdit: () => void
  onSwitch: () => void
}) {
  const on = modules.filter(m => e.modules.includes(m.key))
  return (
    <div className={`rounded-2xl border-2 bg-white p-4 shadow-sm ${isCurrent ? 'border-blue-400' : 'border-gray-200'}`}>
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold text-gray-800">{e.name}</h2>
            {e.status === 'CLOSED' ? (
              <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">🔒 終了（閲覧専用）</span>
            ) : (
              <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700">開催予定</span>
            )}
            {isCurrent && <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700">選択中</span>}
          </div>
          <p className="mt-1 text-sm text-gray-500">
            📅 {period(e)}
            {e.destination && <>　📍 {e.destination}</>}
            　👥 参加 {e.participants}名
          </p>
        </div>
        <div className="flex gap-2">
          {!isCurrent && (
            <button onClick={onSwitch} className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100">
              このイベントに切り替え
            </button>
          )}
          <button onClick={onEdit} className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200">
            {e.status === 'CLOSED' ? '詳細・再開' : '✏️ 編集'}
          </button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {on.length === 0 ? (
          <span className="text-xs text-gray-400">使う機能が選ばれていません</span>
        ) : (
          on.map(m => (
            <span key={m.key} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
              {m.icon} {m.label}
            </span>
          ))
        )}
      </div>
    </div>
  )
}

function EventForm({ title, initial, modules, closed = false, submitLabel, onSubmit, onCancel, onClose, onReopen }: {
  title: string
  initial: FormState
  modules: ModuleDef[]
  closed?: boolean
  submitLabel: string
  onSubmit: (form: FormState) => Promise<void>
  onCancel: () => void
  onClose?: () => Promise<void>
  onReopen?: () => Promise<void>
}) {
  const [form, setForm] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm(f => ({ ...f, [key]: value }))
  const toggle = (key: string) =>
    set('modules', form.modules.includes(key) ? form.modules.filter(k => k !== key) : [...form.modules, key])
  const input = 'w-full border border-gray-300 rounded-xl px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-500'

  const run = async (fn: () => Promise<void>) => {
    setSaving(true)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={e => {
        e.preventDefault()
        run(() => onSubmit(form))
      }}
      className="rounded-2xl border-2 border-blue-400 bg-white p-4 shadow-lg space-y-4"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-blue-700">{title}</h2>
        <button type="button" onClick={onCancel} className="text-sm text-gray-400">
          閉じる
        </button>
      </div>

      {closed && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          🔒 終了したイベントのため閲覧専用です。内容を直すときは、下の「再開する」を押してから編集してください。
        </div>
      )}

      <fieldset disabled={closed || saving} className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="text-xs font-semibold text-gray-600">イベント名 *</span>
            <input className={input} value={form.name} onChange={e => set('name', e.target.value)} placeholder="例: 焼肉食べ放題" required />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-gray-600">場所</span>
            <input className={input} value={form.destination} onChange={e => set('destination', e.target.value)} placeholder="例: ○○店" />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-gray-600">開始日 *</span>
            <input
              type="date"
              className={input}
              value={form.startDate}
              onChange={e => setForm(f => ({ ...f, startDate: e.target.value, endDate: f.endDate && f.endDate >= e.target.value ? f.endDate : e.target.value }))}
              required
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-gray-600">終了日 *（日帰りは開始日と同じ日）</span>
            <input type="date" className={input} value={form.endDate} min={form.startDate} onChange={e => set('endDate', e.target.value)} required />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-gray-600">旅費・参加費（円・任意）</span>
            <input type="number" min={0} className={input} value={form.travelFee} onChange={e => set('travelFee', e.target.value)} />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-gray-600">小遣い支給額（円・任意。「小遣い精算」が ON のとき表示）</span>
            <input type="number" min={0} className={input} value={form.pocketMoney} onChange={e => set('pocketMoney', e.target.value)} />
          </label>
        </div>

        <label className="block">
          <span className="text-xs font-semibold text-gray-600">ダッシュボードの「重要な注意事項」（1行に1項目。**囲んだ文字** は太字）</span>
          <textarea
            className={input}
            rows={4}
            value={form.dashboardNotes}
            onChange={e => set('dashboardNotes', e.target.value)}
            placeholder={'例: 🚫 **アルコール提供NG**：○○様'}
          />
        </label>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-gray-600">
              使う機能（ON の機能だけがメニューとダッシュボードに出ます）　{form.modules.length}/{modules.length}
            </span>
            <div className="flex gap-2">
              <button type="button" onClick={() => set('modules', modules.map(m => m.key))} className="rounded-lg bg-gray-100 px-2 py-1 text-xs text-gray-700 disabled:opacity-50">
                すべて ON
              </button>
              <button type="button" onClick={() => set('modules', [])} className="rounded-lg bg-gray-100 px-2 py-1 text-xs text-gray-700 disabled:opacity-50">
                すべて OFF
              </button>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4">
            {modules.map(m => {
              const on = form.modules.includes(m.key)
              return (
                <label
                  key={m.key}
                  className={`flex cursor-pointer items-center gap-2 rounded-xl border-2 px-3 py-2 text-sm ${on ? 'border-blue-400 bg-blue-50 text-blue-800' : 'border-gray-200 bg-white text-gray-500'}`}
                >
                  <input type="checkbox" checked={on} onChange={() => toggle(m.key)} className="h-4 w-4 accent-blue-600" />
                  <span>{m.icon}</span>
                  <span className="font-medium">{m.label}</span>
                  {!m.menuPath && <span className="text-[10px] text-gray-400">管理者のみ</span>}
                </label>
              )
            })}
          </div>
          <p className="mt-2 text-xs text-gray-500">
            ダッシュボード・全画面一括印刷・自分の担当・参加者の登録は、どのイベントでも使えます。OFF にしても登録済みのデータは消えません。
          </p>
        </div>
      </fieldset>

      {error && <div className="bg-red-50 border border-red-300 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>}

      <div className="flex flex-wrap items-center gap-2">
        {!closed && (
          <button type="submit" disabled={saving} className="flex-1 min-w-40 rounded-xl bg-blue-600 py-2.5 text-sm font-medium text-white disabled:opacity-50 hover:bg-blue-700">
            {saving ? '保存中...' : submitLabel}
          </button>
        )}
        {onClose && !closed && (
          <button
            type="button"
            disabled={saving}
            onClick={() => confirm('このイベントを「終了」にします。終了すると閲覧専用になり、変更できなくなります。よろしいですか？') && run(onClose)}
            className="rounded-xl bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
          >
            🔒 終了にする（閲覧専用）
          </button>
        )}
        {onReopen && closed && (
          <button
            type="button"
            disabled={saving}
            onClick={() => confirm('このイベントを「再開」します。再開すると、また変更できるようになります。よろしいですか？') && run(onReopen)}
            className="rounded-xl bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            🔓 再開する
          </button>
        )}
      </div>
    </form>
  )
}
