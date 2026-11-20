import TransportBoard from '@/components/TransportBoard'

export default function TransportPage() {
  return (
    <div className="space-y-5">
      <div className="pt-12 lg:pt-0">
        <h1 className="text-2xl font-bold text-gray-800">🚐 送迎表</h1>
        <p className="text-sm text-gray-500 mt-1">拠点ごとの送迎（車・徒歩など）の一覧です（閲覧専用）。📝 は送迎メモです。</p>
      </div>
      <TransportBoard />
    </div>
  )
}
