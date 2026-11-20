// 席レイアウトの配置図（閲覧・印刷用。ドラッグなし・サーバーでも描ける）
// 座標は lib/seating.ts の論理ピクセル。縮小は呼び出し側で zoom を指定する
import { isWheelchairSeat, landmarkKindOf, tableGeometry, type SeatLayoutData, type SeatPerson } from '@/lib/seating'

const personColor = (p: SeatPerson) =>
  p.isWheelchair ? 'bg-pink-100 border-pink-400' : p.role === 'STAFF' ? 'bg-blue-100 border-blue-300' : 'bg-white border-gray-500'

export default function SeatingPlanStatic({ layout, personAt, zoom = 1 }: {
  layout: SeatLayoutData
  personAt: (tableId: number, seatIndex: number) => SeatPerson | null
  zoom?: number
}) {
  return (
    <div style={{ width: layout.width * zoom, height: layout.height * zoom }} className="overflow-hidden">
      <div
        className="relative border-2 border-gray-500 bg-white"
        style={{ width: layout.width, height: layout.height, zoom }}
      >
        {layout.landmarks.map(l => {
          const kind = landmarkKindOf(l.kind)
          return (
            <div
              key={`l${l.id}`}
              className={`absolute flex items-center justify-center rounded-md border-2 text-center text-sm font-bold leading-tight ${kind.className}`}
              style={{ left: l.x, top: l.y, width: l.w, height: l.h }}
            >
              <span className="px-1">{kind.icon} {l.label}</span>
            </div>
          )
        })}
        {layout.tables.map(t => {
          const g = tableGeometry(t)
          const seated = g.seats.filter((_, i) => personAt(t.id, i)).length
          return (
            <div key={`t${t.id}`} className="absolute" style={{ left: t.x, top: t.y, width: g.w, height: g.h }}>
              <div
                className={`absolute flex flex-col items-center justify-center border-2 border-amber-700/60 bg-amber-100 text-center leading-tight ${g.body.round ? 'rounded-full' : 'rounded-md'}`}
                style={{ left: g.body.x, top: g.body.y, width: g.body.w, height: g.body.h }}
              >
                <span className="max-w-full truncate px-1 text-xs font-bold text-amber-950">{t.name}</span>
                <span className="text-[10px] text-amber-900">
                  {seated}/{t.seats}
                  {t.memo ? ` ・${t.memo}` : ''}
                </span>
              </div>
              {g.seats.map((s, i) => {
                const p = personAt(t.id, i)
                const wc = isWheelchairSeat(t, i)
                // 車椅子の方が普通の席・車椅子枠に別の方 → ⚠️
                const warn = !!p && p.isWheelchair !== wc
                return (
                  <div
                    key={i}
                    className={`absolute flex items-center gap-0.5 overflow-hidden rounded-md border-2 px-1 text-[11px] font-bold leading-tight ${
                      p ? personColor(p) : wc ? 'border-dashed border-pink-400 bg-pink-50 text-pink-700 justify-center' : 'border-dashed border-gray-300 bg-white text-gray-400 justify-center'
                    } ${wc && p ? 'outline-2 outline-dashed outline-pink-500' : ''}`}
                    style={{ left: s.x, top: s.y, width: s.w, height: s.h }}
                  >
                    {p ? (
                      <>
                        {warn && <span className="shrink-0">⚠️</span>}
                        {p.isWheelchair && <span className="shrink-0">♿</span>}
                        <span className="min-w-0 break-all line-clamp-2">{p.name.replace(/　/g, ' ')}</span>
                        {p.isFishNG && <span className="shrink-0 text-[8px]">🐟❌</span>}
                      </>
                    ) : wc ? `♿ ${i + 1}` : i + 1}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
