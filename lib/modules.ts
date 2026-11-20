// イベントごとに ON/OFF できる機能（モジュール）の定義（サーバー・画面の両方で使う）
// 機能のキーはメニューのパスから先頭の "/" を除いたもの（例: "/pickup" → "pickup"）。並び順はメニューの並び順（全体で1つ）に従う
import { MENU_ITEMS, PRINT_PATH, ROLL_CALL_ADMIN_ITEM } from './menu'

export interface ModuleDef {
  key: string
  label: string
  icon: string
  menuPath: string | null // 一般画面のメニューのパス（管理画面専用の機能は null）
  adminPath: string
}

// どのイベントでも常に使えるページ（機能の ON/OFF の対象外）
const ALWAYS_ON_MENU_PATHS = ['/', PRINT_PATH]

export const MODULES: ModuleDef[] = [
  ...MENU_ITEMS.filter(m => !ALWAYS_ON_MENU_PATHS.includes(m.path)).map(m => ({
    key: m.path.slice(1),
    label: m.label,
    icon: m.icon,
    menuPath: m.path,
    adminPath: m.adminPath,
  })),
  { key: 'roll-call', label: ROLL_CALL_ADMIN_ITEM.label, icon: ROLL_CALL_ADMIN_ITEM.icon, menuPath: null, adminPath: ROLL_CALL_ADMIN_ITEM.href },
]

export const ALL_MODULE_KEYS = MODULES.map(m => m.key)

export const isModuleKey = (v: unknown): v is string => typeof v === 'string' && ALL_MODULE_KEYS.includes(v)

// 保存できる形に整える（未知のキー・重複を除き、定義順に並べる）
export const normalizeModules = (value: unknown): string[] =>
  Array.isArray(value) ? ALL_MODULE_KEYS.filter(k => value.includes(k)) : []

// パス（一般画面・管理画面）がどの機能のページか。機能に属さないページは null
export function moduleOfPath(pathname: string): string | null {
  const path = pathname.startsWith('/admin') ? pathname.slice('/admin'.length) || '/' : pathname
  const first = path.split('/')[1] ?? ''
  return isModuleKey(first) ? first : null
}

// そのパスを選択中のイベントで使えるか（機能に属さないページは常に使える）
export function isPathEnabled(pathname: string, modules: string[]) {
  const key = moduleOfPath(pathname)
  return key === null || modules.includes(key)
}

// メニューのパス（一般画面）が使えるか。ダッシュボード・印刷は常に使える
export function isMenuPathEnabled(menuPath: string, modules: string[]) {
  return ALWAYS_ON_MENU_PATHS.includes(menuPath) || modules.includes(menuPath.slice(1))
}

export const moduleLabel = (key: string) => MODULES.find(m => m.key === key)?.label ?? key
