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

// 持ち物リスト（一般画面・管理画面で共通）
// 一般画面は閲覧のみ。admin のときは品目の追加・名前の編集・削除と、車椅子の出所設定ができる
export default function SupplyList({ admin = false }: { admin?: boolean }) {
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

  const setSource = (p: WheelchairPerson, source: string | null) => {
    setData(d => d && { ...d, wheelchairs: d.wheelchairs.map(w => (w.id === p.id ? { ...w, wheelchairSource: source } : w)) })
    send(`/api/supplies/wheelchairs/${p.id}`, 'PATCH', { wheelchairSource: source })
  }

  const addItem = async (category: SupplyCategory, itemName: string) => {
    const ok = await send('/api/supplies', 'POST', { tripId: 1, category, itemName })
    if (ok) await refresh()
    return ok
  }

  const renameItem = async (item: SupplyItem, itemName: string) => {
    setData(d => d && { ...d, items: d.items.map(i => (i.id === item.id ? { ...i, itemName } : i)) })
    return send(`/api/supplies/${item.id}`, 'PUT', { itemName })
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

  return (
    <div className="space-y-5">
      {error && (
        <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-2 rounded-lg text-sm">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        {/* ① 共通備品 */}
        <Section icon="🧤" title="共通備品" subtitle="グレイス準備">
          <ItemList items={common} admin={admin} onRename={renameItem} onDelete={deleteItem} />
          {admin && <AddItemForm onAdd={name => addItem(SUPPLY_CATEGORIES.COMMON, name)} placeholder="例: 体温計" />}
        </Section>

        {/* ② 貸出用車椅子 */}
        <Section icon="♿️" title={`貸出用車椅子（${loans.length}台）`} subtitle="グレイス準備">
          {loans.length === 0 ? (
            <p className="text-sm text-gray-400 py-1">
              グレイス貸出の利用者はいません
              {admin && <><br />下の「車椅子の出所」で設定できます</>}
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {loans.map(p => (
                <li key={p.id} className="py-2">
                  <Bullet>{p.name}</Bullet>
                </li>
              ))}
            </ul>
          )}
          {admin && <WheelchairSourceEditor persons={data.wheelchairs} onChange={setSource} />}
        </Section>

        {/* ③ 施設別の薬 */}
        <Section icon="💊" title="施設別の薬" subtitle="担当者一括管理">
          <ItemList items={medicine} admin={admin} onRename={renameItem} onDelete={deleteItem} />
          {admin && <AddItemForm onAdd={name => addItem(SUPPLY_CATEGORIES.MEDICINE, name)} placeholder="例: ○○（担当：○○）" />}
        </Section>
      </div>
    </div>
  )
}

function Section({ icon, title, subtitle, children }: {
  icon: string
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <section className="bg-white rounded-2xl border-2 border-gray-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b-2 border-gray-100">
        <h2 className="font-bold text-gray-800">
          {icon} {title}
          <span className="ml-1 text-xs font-medium text-gray-500">（{subtitle}）</span>
        </h2>
      </div>
      <div className="px-4 py-2">{children}</div>
    </section>
  )
}

function Bullet({ children }: { children: ReactNode }) {
  return (
    <span className="flex-1 min-w-0 flex gap-1.5 text-sm text-gray-800">
      <span className="shrink-0 text-gray-400">・</span>
      <span className="min-w-0 break-words">{children}</span>
    </span>
  )
}

function ItemList({ items, admin, onRename, onDelete }: {
  items: SupplyItem[]
  admin: boolean
  onRename: (item: SupplyItem, itemName: string) => Promise<boolean>
  onDelete: (item: SupplyItem) => void
}) {
  const [editingId, setEditingId] = useState<number | null>(null)

  if (items.length === 0) return <p className="text-sm text-gray-400 py-1">項目がありません</p>
  return (
    <ul className="divide-y divide-gray-100">
      {items.map(item => (
        <li key={item.id} className="py-2 flex items-center gap-2">
          {editingId === item.id ? (
            <RenameForm
              initial={item.itemName}
              onSave={async name => {
                if (name === item.itemName || await onRename(item, name)) setEditingId(null)
              }}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <>
              <Bullet>{item.itemName}</Bullet>
              {admin && (
                <>
                  <IconButton label={`${item.itemName}を編集`} onClick={() => setEditingId(item.id)}>✏️</IconButton>
                  <IconButton label={`${item.itemName}を削除`} onClick={() => onDelete(item)}>🗑️</IconButton>
                </>
              )}
            </>
          )}
        </li>
      ))}
    </ul>
  )
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-sm hover:bg-gray-100"
    >
      {children}
    </button>
  )
}

const inputClass = 'flex-1 min-w-0 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400'

function RenameForm({ initial, onSave, onCancel }: {
  initial: string
  onSave: (name: string) => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState(initial)
  const [saving, setSaving] = useState(false)

  return (
    <form
      className="flex-1 min-w-0 flex gap-1.5"
      onSubmit={async e => {
        e.preventDefault()
        if (!name.trim()) return
        setSaving(true)
        await onSave(name.trim())
        setSaving(false)
      }}
    >
      <input
        autoFocus
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Escape') onCancel() }}
        className={inputClass}
      />
      <button
        type="submit"
        disabled={saving || !name.trim()}
        className="shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"
      >
        保存
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="shrink-0 px-2.5 py-1.5 rounded-lg text-xs border border-gray-300 text-gray-600 hover:bg-gray-50"
      >
        取消
      </button>
    </form>
  )
}

function AddItemForm({ onAdd, placeholder }: { onAdd: (name: string) => Promise<boolean>; placeholder: string }) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  return (
    <form
      className="mt-2 mb-2 flex gap-2"
      onSubmit={async e => {
        e.preventDefault()
        if (!name.trim()) return
        setSaving(true)
        if (await onAdd(name)) setName('')
        setSaving(false)
      }}
    >
      <input value={name} onChange={e => setName(e.target.value)} placeholder={placeholder} className={inputClass} />
      <button
        type="submit"
        disabled={saving || !name.trim()}
        className="shrink-0 px-3 py-1.5 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"
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
    <details className="mt-2 mb-2 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50" open={persons.every(p => !p.wheelchairSource)}>
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
