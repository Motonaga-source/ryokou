import { forwardRef, type HTMLAttributes, type SyntheticEvent } from 'react'
import { BAN_NUMBERS, type BanNumber, type BathingPerson } from '@/lib/bathing'

// 班ごとの色（選択中のボタン・閲覧用ラベル）
const BAN_STYLES: Record<BanNumber, string> = {
  1: 'bg-indigo-600 text-white border-indigo-600',
  2: 'bg-emerald-600 text-white border-emerald-600',
  3: 'bg-amber-500 text-white border-amber-500',
}

// ボタン操作がカードのドラッグ開始として扱われないようにする
const stopDrag = (e: SyntheticEvent) => e.stopPropagation()

// 人員カード（teams / rooms と同じ配色・アイコン・レイアウト）
type Props = HTMLAttributes<HTMLDivElement> & {
  person: BathingPerson
  draggable?: boolean
  isDragging?: boolean
  isOverlay?: boolean
  // 班の表示: 'edit' = 切り替えボタン（管理画面）、'label' = 閲覧用ラベル、未指定 = 非表示
  banMode?: 'edit' | 'label'
  onBanChange?: (banNumber: BanNumber | null) => void
}

const BathingPersonCard = forwardRef<HTMLDivElement, Props>(function BathingPersonCard(
  {
    person, draggable = false, isDragging = false, isOverlay = false,
    banMode, onBanChange, className = '', ...rest
  },
  ref,
) {
  // 色分けロジック: 車椅子 > スタッフ > 一般
  const bgClass = person.isWheelchair
    ? 'bg-pink-100 border-pink-400'
    : person.role === 'STAFF'
    ? 'bg-blue-100 border-blue-300'
    : 'bg-white border-gray-300'

  const icon = person.role === 'STAFF'
    ? '👨‍💼'
    : person.gender === '女'
    ? '👩'
    : '👨'

  return (
    <div
      ref={ref}
      {...rest}
      className={`
        w-full flex items-center gap-2 p-2 rounded-md shadow-sm border-2 transition-colors
        ${bgClass}
        ${draggable ? 'cursor-grab touch-none' : ''}
        ${isDragging && !isOverlay ? 'opacity-30' : 'opacity-100'}
        ${isOverlay ? 'shadow-2xl scale-105 rotate-2 cursor-grabbing z-50' : ''}
        ${className}
      `}
    >
      <div className="flex items-center justify-center shrink-0 w-6 h-6 text-sm">
        {icon}
      </div>
      <div className="flex-1 min-w-0 flex items-center gap-1 text-left">
        {person.isWheelchair && <span className="shrink-0 text-sm">♿️</span>}
        <span className="flex-1 min-w-0 truncate block font-bold text-sm text-gray-800">
          {person.name}
        </span>
      </div>
      {banMode === 'edit' && (
        <div className="shrink-0 flex items-center gap-0.5" role="group" aria-label="班">
          {BAN_NUMBERS.map(n => {
            const active = person.banNumber === n
            return (
              <button
                key={n}
                type="button"
                aria-label={`${n}班`}
                aria-pressed={active}
                title={active ? `${n}班（タップで解除）` : `${n}班に設定`}
                onMouseDown={stopDrag}
                onTouchStart={stopDrag}
                onPointerDown={stopDrag}
                onKeyDown={stopDrag}
                onClick={e => {
                  e.stopPropagation()
                  onBanChange?.(active ? null : n)
                }}
                className={`w-6 h-6 rounded border text-[11px] font-bold leading-none transition-colors ${
                  active ? BAN_STYLES[n] : 'bg-white/80 text-gray-500 border-gray-300 hover:bg-gray-100'
                }`}
              >
                {n}
              </button>
            )
          })}
        </div>
      )}
      {banMode === 'label' && person.banNumber && BAN_STYLES[person.banNumber as BanNumber] && (
        <span className={`shrink-0 px-1.5 py-0.5 rounded border text-[11px] font-bold leading-none ${BAN_STYLES[person.banNumber as BanNumber]}`}>
          {person.banNumber}班
        </span>
      )}
    </div>
  )
})

export default BathingPersonCard
