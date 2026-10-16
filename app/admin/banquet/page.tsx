import BanquetBoard from '@/components/BanquetBoard'

export default function AdminBanquetPage() {
  return (
    <div className="space-y-5">
      <div className="pt-12 lg:pt-0">
        <h1 className="text-2xl font-bold text-gray-800">🍶 宴会 席順</h1>
        <p className="text-sm text-gray-500 mt-1">
          長押しでドラッグ＆ドロップして席を割り当てます。座っている人の席へ落とすと入れ替わります。🐟❌ は魚料理NGの方です。
        </p>
      </div>
      <BanquetBoard editable />
    </div>
  )
}
