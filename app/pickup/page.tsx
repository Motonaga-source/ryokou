import PickupBoard from '@/components/PickupBoard'

export default function PickupPage() {
  return (
    <div className="space-y-5">
      <div className="pt-12 md:pt-0">
        <h1 className="text-2xl font-bold text-gray-800">🚗 集合・送迎</h1>
        <p className="text-sm text-gray-500 mt-1">集合方法と送迎車の割り当て一覧です（閲覧専用）。📝 は送迎メモです。</p>
      </div>
      <PickupBoard />
    </div>
  )
}
