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
      <p className="text-xs text-gray-400 mb-1.5">
        💡 接下來可以問
      </p>

      <div className="flex flex-wrap gap-2">
        {list.map(text => (
          <button
            key={text}
            type="button"
            onClick={() => onSelect(text)}
            disabled={disabled}
            className="text-xs text-left bg-green-50 border border-green-200 text-green-700 rounded-full px-3 py-1.5 hover:bg-green-100 transition-all disabled:opacity-50"
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  )
}
