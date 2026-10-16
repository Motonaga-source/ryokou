'use client'

import { useEffect, useState, type ReactNode } from 'react'
import {
  SUPPLY_CATEGORIES,
  WHEELCHAIR_LOAN,
  WHEELCHAIR_SOURCES,
  type SuppliesResponse,
  type SupplyCategory,
  type SupplyItem,
  type WheelchairPerson,
} from '@/lib/supplies'

async function loadSupplies(): Promise<SuppliesResponse> {
  const res = await fetch('/api/supplies?tripId=1')
  return res.json()
}

// 持ち物チェックリスト（一般画面・管理画面で共通）
// チェックの ON/OFF はどちらの画面でも可能。admin のときは品目の追加・削除と車椅子の出所設定もできる
export default function SupplyChecklist({ admin = false }: { admin?: boolean }) {
  const [data, setData] = useState<SuppliesResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadSupplies().then(setData)
  }, [])

  const refresh = async () => setData(await loadSupplies())

  const send = async (url: string, method: string, body?: unknown) => {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      setError(json.error || '保存に失敗しました')
      await refresh()
      return false
    }
    setError(null)
    return true
  }

  const patchItem = (id: number, patch: Partial<SupplyItem>) =>
    setData(d => d && { ...d, items: d.items.map(i => (i.id === id ? { ...i, ...patch } : i)) })
  const patchWheelchair = (id: number, patch: Partial<WheelchairPerson>) =>
    setData(d => d && { ...d, wheelchairs: d.wheelchairs.map(p => (p.id === id ? { ...p, ...patch } : p)) })

  const toggleItem = (item: SupplyItem) => {
    patchItem(item.id, { isChecked: !item.isChecked })
    send(`/api/supplies/${item.id}`, 'PATCH', { isChecked: !item.isChecked })
  }

  const toggleWheelchair = (p: WheelchairPerson) => {
    patchWheelchair(p.id, { wheelchairPrepared: !p.wheelchairPrepared })
    send(`/api/supplies/wheelchairs/${p.id}`, 'PATCH', { wheelchairPrepared: !p.wheelchairPrepared })
  }

  const setSource = (p: WheelchairPerson, source: string | null) => {
    patchWheelchair(p.id, { wheelchairSource: source })
    send(`/api/supplies/wheelchairs/${p.id}`, 'PATCH', { wheelchairSource: source })
  }

  const addItem = async (category: SupplyCategory, itemName: string) => {
    const ok = await send('/api/supplies', 'POST', { tripId: 1, category, itemName })
    if (ok) await refresh()
    return ok
  }

  const deleteItem = async (item: SupplyItem) => {
    if (!confirm(`「${item.itemName}」を削除しますか？`)) return
    setData(d => d && { ...d, items: d.items.filter(i => i.id !== item.id) })
    await send(`/api/supplies/${item.id}`, 'DELETE')
  }

  if (!data) return <div className="text-center py-10 text-gray-400">読み込み中...</div>

  const common = data.items.filter(i => i.category === SUPPLY_CATEGORIES.COMMON)
  const medicine = data.items.filter(i => i.category === SUPPLY_CATEGORIES.MEDICINE)
  const loans = data.wheelchairs.filter(p => p.wheelchairSource === WHEELCHAIR_LOAN)

  const total = common.length + medicine.length + loans.length
  const done = [...common, ...medicine].filter(i => i.isChecked).length + loans.filter(p => p.wheelchairPrepared).length

  return (
    <div className="space-y-5">
      {error && (
        <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-2 rounded-lg text-sm">{error}</div>
      )}

      {/* 全体の進捗 */}
      <div className="bg-white rounded-2xl border-2 border-gray-200 shadow-sm p-4">
        <div className="flex items-center justify-between text-sm font-semibold text-gray-700 mb-2">
          <span>準備状況</span>
          <span className={done === total && total > 0 ? 'text-green-600' : ''}>
            {done} / {total} 完了{done === total && total > 0 && ' 🎉'}
          </span>
        </div>
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 transition-all"
            style={{ width: `${total ? (done / total) * 100 : 0}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        {/* ① 共通備品 */}
        <Section
          icon="🧤"
          title="共通備品"
          subtitle="グレイス準備"
          done={common.filter(i => i.isChecked).length}
          total={common.length}
        >
          <ItemList items={common} admin={admin} onToggle={toggleItem} onDelete={deleteItem} />
          {admin && <AddItemForm onAdd={name => addItem(SUPPLY_CATEGORIES.COMMON, name)} placeholder="例: 体温計" />}
        </Section>

        {/* ② 貸出用車椅子 */}
        <Section
          icon="♿️"
          title="貸出用車椅子"
          subtitle="グレイス準備"
          done={loans.filter(p => p.wheelchairPrepared).length}
          total={loans.length}
        >
          <div className="mb-3 rounded-xl bg-pink-50 border-2 border-pink-200 px-4 py-3 text-center">
            <span className="text-sm text-pink-800">必要台数：</span>
            <span className="text-2xl font-bold text-pink-700">{loans.length}</span>
            <span className="text-sm text-pink-800">台</span>
          </div>
          {loans.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-3">
              グレイス貸出の利用者はいません
              {admin && <><br />下の「車椅子の出所」で設定できます</>}
            </p>
          ) : (
            <ul className="space-y-2">
              {loans.map(p => (
                <li key={p.id}>
                  <CheckRow checked={p.wheelchairPrepared} onToggle={() => toggleWheelchair(p)} label={p.name} />
                </li>
              ))}
            </ul>
          )}
          {admin && <WheelchairSourceEditor persons={data.wheelchairs} onChange={setSource} />}
        </Section>

        {/* ③ 施設別の薬 */}
        <Section
          icon="💊"
          title="施設別の薬"
          subtitle="担当者一括管理"
          done={medicine.filter(i => i.isChecked).length}
          total={medicine.length}
        >
          <ItemList items={medicine} admin={admin} onToggle={toggleItem} onDelete={deleteItem} />
          {admin && <AddItemForm onAdd={name => addItem(SUPPLY_CATEGORIES.MEDICINE, name)} placeholder="例: ○○（担当：○○）" />}
        </Section>
      </div>
    </div>
  )
}

function Section({ icon, title, subtitle, done, total, children }: {
  icon: string
  title: string
  subtitle: string
  done: number
  total: number
  children: ReactNode
}) {
  const complete = total > 0 && done === total
  return (
    <section className="bg-white rounded-2xl border-2 border-gray-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b-2 border-gray-100 flex items-center justify-between gap-2">
        <h2 className="font-bold text-gray-800 min-w-0">
          {icon} {title}
          <span className="ml-1 text-xs font-medium text-gray-500">（{subtitle}）</span>
        </h2>
        <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${
          complete ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
        }`}>
          {done}/{total}
        </span>
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}

function CheckRow({ checked, onToggle, label }: { checked: boolean; onToggle: () => void; label: string }) {
  return (
    <label className={`flex-1 min-w-0 flex items-center gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer select-none transition-colors ${
      checked ? 'bg-green-50 border-green-300' : 'bg-white border-gray-200 hover:bg-gray-50'
    }`}>
      <input type="checkbox" checked={checked} onChange={onToggle} className="w-5 h-5 shrink-0 accent-green-600" />
      <span className={`min-w-0 break-words text-sm font-medium ${checked ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
        {label}
      </span>
    </label>
  )
}

function ItemList({ items, admin, onToggle, onDelete }: {
  items: SupplyItem[]
  admin: boolean
  onToggle: (item: SupplyItem) => void
  onDelete: (item: SupplyItem) => void
}) {
  if (items.length === 0) return <p className="text-sm text-gray-400 text-center py-3">項目がありません</p>
  return (
    <ul className="space-y-2">
      {items.map(item => (
        <li key={item.id} className="flex items-center gap-2">
          <CheckRow checked={item.isChecked} onToggle={() => onToggle(item)} label={item.itemName} />
          {admin && (
            <button
              type="button"
              aria-label={`${item.itemName}を削除`}
              title="削除"
              onClick={() => onDelete(item)}
              className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-sm hover:bg-red-50"
            >
              🗑️
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}

function AddItemForm({ onAdd, placeholder }: { onAdd: (name: string) => Promise<boolean>; placeholder: string }) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  return (
    <form
      className="mt-3 flex gap-2"
      onSubmit={async e => {
        e.preventDefault()
        if (!name.trim()) return
        setSaving(true)
        if (await onAdd(name)) setName('')
        setSaving(false)
      }}
    >
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder={placeholder}
        className="flex-1 min-w-0 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
      <button
        type="submit"
        disabled={saving || !name.trim()}
        className="shrink-0 px-3 py-2 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"
      >
        追加
      </button>
    </form>
  )
}

function WheelchairSourceEditor({ persons, onChange }: {
  persons: WheelchairPerson[]
  onChange: (p: WheelchairPerson, source: string | null) => void
}) {
  return (
    <details className="mt-4 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50" open={persons.every(p => !p.wheelchairSource)}>
      <summary className="px-4 py-2 text-sm font-semibold text-gray-700 cursor-pointer">
        ⚙️ 車椅子の出所（{persons.length}名）
      </summary>
      <ul className="px-3 pb-3 space-y-1.5">
        {persons.length === 0 && <li className="text-xs text-gray-400">車椅子利用の参加者はいません</li>}
        {persons.map(p => (
          <li key={p.id} className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 px-3 py-1.5">
            <span className="flex-1 min-w-0 truncate text-sm text-gray-800">{p.name}</span>
            <select
              value={p.wheelchairSource ?? ''}
              onChange={e => onChange(p, e.target.value || null)}
              className="shrink-0 border border-gray-300 rounded-md px-2 py-1 text-xs bg-white"
            >
              <option value="">未設定</option>
              {WHEELCHAIR_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </li>
        ))}
      </ul>
    </details>
  )
}
