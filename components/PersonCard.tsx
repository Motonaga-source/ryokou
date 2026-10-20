import { forwardRef, type HTMLAttributes } from 'react'
import FishNGBadge from '@/components/FishNGBadge'

export interface CardPerson {
  id: number
  name: string
  role: string
  gender: string | null
  isWheelchair?: boolean
  isFishNG?: boolean
}

// 人員カード（teams / rooms / bathing と同じ配色・アイコン）。宴会席次・集合送迎で使用
// compact: 席の中に収める小さい表示
// memo: 名前の下に小さく表示する補足（集合・送迎画面の送迎メモなど）
// wrapName: 狭い枠でも名前を省略せず折り返して表示する（昼食席順の席など）
type Props = HTMLAttributes<HTMLDivElement> & {
  person: CardPerson
  compact?: boolean
  memo?: string | null
  wrapName?: boolean
  draggable?: boolean
  isDragging?: boolean
  isOverlay?: boolean
}

const PersonCard = forwardRef<HTMLDivElement, Props>(function PersonCard(
  { person, compact = false, memo, wrapName = false, draggable = false, isDragging = false, isOverlay = false, className = '', ...rest },
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
      title={person.name}
      className={`
        print-avoid-break w-full flex items-center shadow-sm border-2 transition-colors
        ${compact ? 'h-full gap-0.5 px-1 py-1 rounded' : 'gap-2 p-2 rounded-md'}
        ${bgClass}
        ${draggable ? 'cursor-grab touch-manipulation' : ''}
        ${isDragging && !isOverlay ? 'opacity-30' : 'opacity-100'}
        ${isOverlay ? 'shadow-2xl scale-105 rotate-2 cursor-grabbing z-50' : ''}
        ${className}
      `}
    >
      {!compact && (
        <div className="flex items-center justify-center shrink-0 w-6 h-6 text-sm">
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0 text-left">
        <div className="flex items-center gap-1">
          {person.isWheelchair && <span className={`shrink-0 ${compact ? 'text-xs' : 'text-sm'}`}>♿️</span>}
          <span className={`flex-1 min-w-0 block font-bold text-gray-800 ${wrapName ? 'break-words leading-tight [word-break:keep-all]' : 'truncate'} ${compact ? 'text-xs' : 'text-sm'}`}>
            {person.name}
          </span>
          {person.isFishNG && <FishNGBadge />}
        </div>
        {memo && (
          <p className="mt-0.5 text-[11px] leading-snug text-gray-600 break-words">📝 {memo}</p>
        )}
      </div>
    </div>
  )
})

export default PersonCard
