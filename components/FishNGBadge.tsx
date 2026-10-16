// 魚料理NGのバッジ（人員カードの名前の横に表示。車椅子の ♿️ と並べて使う）
export default function FishNGBadge({ className = '' }: { className?: string }) {
  return (
    <span
      title="魚料理NG"
      aria-label="魚料理NG"
      className={`shrink-0 inline-flex items-center rounded border border-orange-300 bg-orange-100 px-0.5 text-[11px] leading-tight ${className}`}
    >
      🐟❌
    </span>
  )
}
