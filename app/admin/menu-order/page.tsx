'use client'

import { useEffect, useState } from 'react'
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { MENU_ITEMS, sortMenuItems, type MenuItem } from '@/lib/menu'
import { notifyMenuOrderChanged } from '@/lib/useMenuOrder'

export default function MenuOrderPage() {
  const [items, setItems] = useState<MenuItem[] | null>(null)
  const [savedOrder, setSavedOrder] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  useEffect(() => {
    fetch('/api/menu-order')
      .then(res => res.json())
      .then((data: { order: string[] }) => {
        const sorted = sortMenuItems(data.order)
        setItems(sorted)
        setSavedOrder(sorted.map(m => m.path))
      })
  }, [])

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const move = (from: number, to: number) => {
    setItems(list => (list ? arrayMove(list, from, to) : list))
    setMessage(null)
  }

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!items || !over || active.id === over.id) return
    move(items.findIndex(m => m.path === active.id), items.findIndex(m => m.path === over.id))
  }

  const save = async () => {
    if (!items) return
    setSaving(true)
    const order = items.map(m => m.path)
    const res = await fetch('/api/menu-order', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order }),
    })
    setSaving(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setMessage({ type: 'error', text: data.error || '保存に失敗しました' })
      return
    }
    setSavedOrder(order)
    notifyMenuOrderChanged(order)
    setMessage({ type: 'ok', text: '並び順を保存しました。サイドバーに反映されています。' })
  }

  const dirty = !!items && items.map(m => m.path).join() !== savedOrder.join()

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="pt-12 lg:pt-0">
        <h1 className="text-2xl font-bold text-gray-800">⚙️ メニュー並び替え</h1>
        <p className="text-sm text-gray-500 mt-1">
          ドラッグ（スマホは長押し）または ↑↓ ボタンで並べ替えて「保存」してください。一般画面と管理画面の両方のメニューに反映されます。
        </p>
      </div>

      {message && (
        <div className={`px-4 py-2 rounded-lg text-sm border ${
          message.type === 'ok' ? 'bg-green-50 border-green-300 text-green-700' : 'bg-red-50 border-red-300 text-red-700'
        }`}>
          {message.text}
        </div>
      )}

      {!items ? (
        <div className="text-center py-10 text-gray-400">読み込み中...</div>
      ) : (
        <>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={items.map(m => m.path)} strategy={verticalListSortingStrategy}>
              <ul className="space-y-2">
                {items.map((m, i) => (
                  <SortableRow
                    key={m.path}
                    item={m}
                    index={i}
                    isFirst={i === 0}
                    isLast={i === items.length - 1}
                    onMove={dir => move(i, i + dir)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>

          <div className="flex flex-wrap justify-between gap-2 sticky bottom-4">
            <button
              type="button"
              onClick={() => { setItems(MENU_ITEMS); setMessage(null) }}
              className="px-4 py-2 rounded-xl text-sm border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 shadow-sm"
            >
              初期の並び順に戻す
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving || !dirty}
              className="px-6 py-2 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 shadow-sm"
            >
              {saving ? '保存中...' : dirty ? '保存' : '保存済み'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function SortableRow({ item, index, isFirst, isLast, onMove }: {
  item: MenuItem
  index: number
  isFirst: boolean
  isLast: boolean
  onMove: (dir: -1 | 1) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.path })

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-3 bg-white rounded-xl border-2 px-3 py-2.5 ${
        isDragging ? 'border-blue-400 shadow-lg relative z-10' : 'border-gray-200 shadow-sm'
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`${item.label}をドラッグして移動`}
        className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 cursor-grab active:cursor-grabbing touch-none"
      >
        ⠿
      </button>
      <span className="shrink-0 w-6 text-right text-xs font-bold text-gray-400">{index + 1}</span>
      <span className="text-lg shrink-0">{item.icon}</span>
      <span className="flex-1 min-w-0 truncate text-sm font-medium text-gray-800">{item.label}</span>
      <div className="shrink-0 flex gap-1">
        <button
          type="button"
          aria-label="上へ"
          disabled={isFirst}
          onClick={() => onMove(-1)}
          className="w-7 h-7 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-30"
        >
          ↑
        </button>
        <button
          type="button"
          aria-label="下へ"
          disabled={isLast}
          onClick={() => onMove(1)}
          className="w-7 h-7 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-30"
        >
          ↓
        </button>
      </div>
    </li>
  )
}
