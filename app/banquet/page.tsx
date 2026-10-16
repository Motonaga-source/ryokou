import BanquetBoard from '@/components/BanquetBoard'

export default function BanquetPage() {
  return (
    <div className="space-y-5">
      <div className="pt-12 lg:pt-0">
        <h1 className="text-2xl font-bold text-gray-800">🍶 宴会 席順</h1>
        <p className="text-sm text-gray-500 mt-1">宴会場の席次表です（閲覧専用）。🐟❌ は魚料理NGの方です。</p>
      </div>
      <BanquetBoard />
    </div>
  )
}
