// サイドバーのメニュー定義（一般画面・管理画面で共通）
// 並び順は MenuOrder テーブル（管理画面の「メニュー並び替え」で変更）に従い、未登録の項目は末尾に定義順で並ぶ

// 印刷専用まとめページ（サイドバーなしの全幅で表示）
export const PRINT_PATH = '/print'

export interface MenuItem {
  path: string // 一般画面のパス。管理画面は adminPath
  label: string
  icon: string
  adminPath: string
  adminLabel: string
  adminIcon?: string
}

const item = (path: string, label: string, icon: string, adminLabel = `${label} (編集)`): MenuItem => ({
  path,
  label,
  icon,
  adminPath: path === '/' ? '/admin' : `/admin${path}`,
  adminLabel,
})

export const MENU_ITEMS: MenuItem[] = [
  { ...item('/', 'ダッシュボード', '🏠', '管理ダッシュボード'), adminIcon: '⚙️' },
  item('/persons', '参加者名簿', '👥'),
  item('/rooms', '部屋割り管理', '🏨'),
  item('/bus', 'バス座席表', '🚌'),
  item('/vitals', 'バイタルチェック', '💊'),
  item('/medications', '服薬情報管理', '💉'),
  item('/teams', 'チーム・配置', '📋'),
  item('/bathing', '入浴管理', '♨️'),
  item('/banquet', '宴会 席順', '🍶'),
  item('/pickup', '集合・送迎', '🚗'),
  item('/schedule', 'スケジュール', '🗓️'),
  item('/supplies', '持ち物', '🎒'),
  item('/pocket-money', '小遣い精算', '💴'),
  // 印刷専用ページは一般・管理の両方から同じ /print を開く
  { ...item(PRINT_PATH, '全画面一括印刷', '🖨️', '全画面一括印刷'), adminPath: PRINT_PATH },
]

// 管理画面のメニュー末尾に固定する項目（管理者専用のため一般画面にはなく、並び替えの対象外）
export const ROLL_CALL_ADMIN_ITEM = { href: '/admin/roll-call', label: '点呼チェック', icon: '📝' }
export const MENU_ORDER_ADMIN_ITEM = { href: '/admin/menu-order', label: 'メニュー並び替え', icon: '⚙️' }

export function isMenuPath(value: unknown): value is string {
  return MENU_ITEMS.some(m => m.path === value)
}

// 保存済みの並び順（path の配列）に従って並べる。並び順にない項目は末尾に定義順で追加
export function sortMenuItems(order: string[] | null): MenuItem[] {
  if (!order) return MENU_ITEMS
  const rank = new Map(order.map((path, i) => [path, i]))
  return [...MENU_ITEMS].sort((a, b) => {
    const ra = rank.get(a.path) ?? Infinity
    const rb = rank.get(b.path) ?? Infinity
    if (ra !== rb) return ra - rb
    return MENU_ITEMS.indexOf(a) - MENU_ITEMS.indexOf(b)
  })
}
