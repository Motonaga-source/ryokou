'use client'

import { useEffect, useState } from 'react'
import { sortMenuItems } from '@/lib/menu'

const CACHE_KEY = 'menu-order'
// 並び替え画面で保存したときに発火し、表示中のサイドバーへ即時反映する
export const MENU_ORDER_EVENT = 'menu-order-changed'

function readCache(): string[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeCache(order: string[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(order))
  } catch {
    // 保存できなくても表示には影響しない
  }
}

export function notifyMenuOrderChanged(order: string[]) {
  writeCache(order)
  window.dispatchEvent(new CustomEvent<string[]>(MENU_ORDER_EVENT, { detail: order }))
}

// DB に保存された並び順でメニュー項目を返す（読み込み中は前回の並び順、なければ既定の順）
export function useMenuItems() {
  const [order, setOrder] = useState<string[] | null>(null)

  useEffect(() => {
    let active = true
    const cached = readCache()
    if (cached) queueMicrotask(() => active && setOrder(cached))

    fetch('/api/menu-order')
      .then(res => (res.ok ? res.json() : null))
      .then((data: { order: string[] } | null) => {
        if (!active || !data) return
        writeCache(data.order)
        setOrder(data.order)
      })
      .catch(() => {})

    const onChange = (e: Event) => setOrder((e as CustomEvent<string[]>).detail)
    window.addEventListener(MENU_ORDER_EVENT, onChange)
    return () => {
      active = false
      window.removeEventListener(MENU_ORDER_EVENT, onChange)
    }
  }, [])

  return sortMenuItems(order)
}
