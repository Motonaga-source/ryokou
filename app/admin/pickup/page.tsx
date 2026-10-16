import PickupBoard from '@/components/PickupBoard'

export default function AdminPickupPage() {
  return (
    <div className="space-y-5">
      <div className="pt-12 md:pt-0">
        <h1 className="text-2xl font-bold text-gray-800">🚗 集合・送迎</h1>
        <p className="text-sm text-gray-500 mt-1">
          長押しでドラッグ＆ドロップして集合方法・送迎車を割り当てます。定員を超えた送迎車は赤く表示されます。送迎メモは参加者名簿で編集できます。
        </p>
      </div>
      <PickupBoard editable />
    </div>
  )
}
