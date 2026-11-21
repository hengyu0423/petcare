// =====================================================
// AI 回覆後的「接下來可以問」
//
// items：後端依這次命中的知識庫條目產生的追問（最多 3 則）
// 點擊就等於使用者送出這句話
// =====================================================

export default function FollowupSuggestions({
  items,
  onSelect,
  disabled = false
}) {
  const list = Array.isArray(items)
    ? items.filter(text => typeof text === 'string' && text.trim())
    : []

  if (list.length === 0) return null

  return (
    <div className="mb-3">
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-pine-700">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
          <path d="M9 17.5h6M10 20h4" />
          <path d="M8 13a5 5 0 1 1 8 0c-.9 1-1.5 1.8-1.5 3h-5c0-1.2-.6-2-1.5-3Z" />
        </svg>
        接下來可以問
      </p>

      <div className="flex flex-wrap gap-2">
        {list.map(text => (
          <button
            key={text}
            type="button"
            onClick={() => onSelect(text)}
            disabled={disabled}
            className="rounded-full border border-[#f0d9b5] bg-[#fff8e9] px-3 py-1.5 text-left text-xs font-semibold text-[#7a5200] transition-colors hover:bg-[#fdf0d9] disabled:opacity-50"
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  )
}
