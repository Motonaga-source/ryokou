import { forwardRef, type HTMLAttributes } from 'react'
import FishNGBadge from '@/components/FishNGBadge'
import type { BanquetPerson } from '@/lib/banquet'

// 宴会席次の人員カード（teams / rooms / bathing と同じ配色・アイコン）
// compact: 席の中に収める小さい表示
type Props = HTMLAttributes<HTMLDivElement> & {
  person: BanquetPerson
  compact?: boolean
  draggable?: boolean
  isDragging?: boolean
  isOverlay?: boolean
}

const BanquetPersonCard = forwardRef<HTMLDivElement, Props>(function BanquetPersonCard(
  { person, compact = false, draggable = false, isDragging = false, isOverlay = false, className = '', ...rest },
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
        w-full flex items-center shadow-sm border-2 transition-colors
        ${compact ? 'h-full gap-0.5 px-1 py-1 rounded' : 'gap-2 p-2 rounded-md'}
        ${bgClass}
        ${draggable ? 'cursor-grab touch-none' : ''}
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
      <div className="flex-1 min-w-0 flex items-center gap-1 text-left">
        {person.isWheelchair && <span className={`shrink-0 ${compact ? 'text-xs' : 'text-sm'}`}>♿️</span>}
        <span className={`flex-1 min-w-0 truncate block font-bold text-gray-800 ${compact ? 'text-xs' : 'text-sm'}`}>
          {person.name}
        </span>
        {person.isFishNG && <FishNGBadge />}
      </div>
    </div>
  )
})

export default BanquetPersonCard
