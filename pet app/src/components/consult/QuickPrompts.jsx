// =====================================================
// 健康諮詢的「預先選項」
//
// - compact = false：空對話時使用，顯示類別分頁，與該類別的所有問題
// - compact = true ：對話進行中使用，預設只顯示類別按鈕，點開才展開問題，
//                    不會佔太多版面
// =====================================================

import { useMemo, useState } from 'react'
import { getQuickPromptCategories } from './quickPromptData'

const ICON = {
  symptoms: <><path d="M6 4v5a4 4 0 0 0 8 0V4" /><path d="M10 13v2.5a4.5 4.5 0 0 0 9 0V13" /><circle cx="19" cy="12" r="1.8" /></>,
  emergency: <><path d="M12 4.5 21 19.5H3L12 4.5Z" /><path d="M12 10v4M12 17h.01" /></>,
  diet: <><path d="M3.5 11.5h17" /><path d="M5 11.5c0 4.7 3.1 8 7 8s7-3.3 7-8" /><path d="M9 8c0-1.7 1.4-3 3-3s3 1.3 3 3" /></>,
  prevention: <><path d="M12 3.5 5 6v5.5c0 4.2 3 7.5 7 9 4-1.5 7-4.8 7-9V6l-7-2.5Z" /><path d="M9 12l2 2 4-4" /></>,
  newowner: <><ellipse cx="7" cy="8" rx="2" ry="2.4" /><ellipse cx="12" cy="5.8" rx="2" ry="2.4" /><ellipse cx="17" cy="8" rx="2" ry="2.4" /><path d="M12 11c-3 0-5.5 2.2-5.5 4.8 0 1.7 1.4 2.9 3 2.9 1 0 1.6-.5 2.5-.5s1.5.5 2.5.5c1.6 0 3-1.2 3-2.9C17.5 13.2 15 11 12 11Z" /></>,
  generic: <><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3Z" /></>
}

function LineIcon({ name, size = 14 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      {ICON[name] || ICON.generic}
    </svg>
  )
}

export default function QuickPrompts({
  species,
  onSelect,
  disabled = false,
  compact = false
}) {
  const categories = useMemo(
    () => getQuickPromptCategories(species),
    [species]
  )

  const [activeId, setActiveId] = useState(null)

  // 展開中的類別：精簡模式預設不展開；完整模式預設第一個類別
  const active =
    categories.find(c => c.id === activeId) ||
    (compact ? null : categories[0])

  const handleSelect = text => {
    onSelect(text)

    if (compact) setActiveId(null)
  }

  const tabClass = isActive =>
    compact
      ? `inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold transition-colors disabled:opacity-50 ${
          isActive
            ? 'border-pine-700/40 bg-pine-800 text-[#fdf8ec]'
            : 'border-[#eae6d8] bg-plate text-ink-soft hover:border-pine-700/30 hover:bg-[#fdf6ea] hover:text-pine-700'
        }`
      : `inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-bold transition-colors disabled:opacity-50 ${
          isActive
            ? 'border-pine-800 bg-pine-800 text-[#fdf8ec]'
            : 'border-[#eae6d8] bg-plate text-ink-soft hover:border-pine-700/30 hover:bg-[#fdf6ea] hover:text-pine-700'
        }`

  const promptClass = compact
    ? 'rounded-full border border-[#eae6d8] bg-plate px-3 py-1 text-xs font-semibold text-pine-800 transition-colors hover:border-pine-700/30 hover:bg-[#fdf6ea] disabled:opacity-50'
    : 'rounded-full border border-[#eae6d8] bg-plate px-4 py-2 text-sm font-semibold text-pine-800 transition-colors hover:border-pine-700/30 hover:bg-[#fdf6ea] disabled:opacity-50'

  return (
    <div className={compact ? 'mb-3' : ''}>
      {/* 類別 */}
      {categories.length > 1 && (
        <div className={`flex flex-wrap gap-2 ${compact ? 'mb-2' : 'mb-4 justify-center'}`}>
          {categories.map(category => {
            const isActive = active?.id === category.id

            return (
              <button
                key={category.id}
                type="button"
                aria-pressed={isActive}
                onClick={() =>
                  setActiveId(compact && isActive ? null : category.id)
                }
                className={tabClass(isActive)}
              >
                <LineIcon name={category.id} />
                {category.label}
              </button>
            )
          })}
        </div>
      )}

      {/* 該類別的問題 */}
      {active && (
        <div className={`flex flex-wrap gap-2 ${compact ? 'max-h-40 overflow-y-auto' : 'justify-center'}`}>
          {active.prompts.map(prompt => (
            <button
              key={prompt.label + prompt.text}
              type="button"
              onClick={() => handleSelect(prompt.text)}
              disabled={disabled}
              className={promptClass}
            >
              {prompt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
