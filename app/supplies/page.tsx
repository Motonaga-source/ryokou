import SupplyChecklist from '@/components/SupplyChecklist'

export default function SuppliesPage() {
  return (
    <div className="space-y-5">
      <div className="pt-12 md:pt-0">
        <h1 className="text-2xl font-bold text-gray-800">🎒 持ち物チェックリスト</h1>
        <p className="text-sm text-gray-500 mt-1">準備できたものをタップしてチェックしてください。</p>
      </div>
      <SupplyChecklist />
    </div>
  )
}
