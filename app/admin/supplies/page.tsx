import SupplyList from '@/components/SupplyList'

export default function AdminSuppliesPage() {
  return (
    <div className="space-y-5">
      <div className="pt-12 md:pt-0">
        <h1 className="text-2xl font-bold text-gray-800">🎒 持ち物リスト</h1>
        <p className="text-sm text-gray-500 mt-1">品目の追加・編集・削除と、車椅子の出所（グレイス貸出／持参）を設定できます。</p>
      </div>
      <SupplyList admin />
    </div>
  )
}
