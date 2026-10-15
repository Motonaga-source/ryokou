import { forwardRef, type HTMLAttributes } from 'react'
import type { BathingPerson } from '@/lib/bathing'

// 人員カード（teams / rooms と同じ配色・アイコン・レイアウト）
type Props = HTMLAttributes<HTMLDivElement> & {
  person: BathingPerson
  draggable?: boolean
  isDragging?: boolean
  isOverlay?: boolean
}

const BathingPersonCard = forwardRef<HTMLDivElement, Props>(function BathingPersonCard(
  { person, draggable = false, isDragging = false, isOverlay = false, className = '', ...rest },
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
    </div>
  )
})

export default BathingPersonCard
