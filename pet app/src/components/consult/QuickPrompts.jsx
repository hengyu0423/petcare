// =====================================================
// 健康諮詢的「預先選項」
//
// - compact = false：空對話時使用，顯示類別分頁，與該類別的所有問題
// - compact = true ：對話進行中使用，預設只顯示類別按鈕，點開才展開問題，
//                    不會佔太多版面
// =====================================================

import { useMemo, useState } from 'react'
import { getQuickPromptCategories } from './quickPromptData'

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
      ? `text-xs rounded-full px-3 py-1 border transition-all disabled:opacity-50 ${
          isActive
            ? 'bg-green-50 border-green-300 text-green-700'
            : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-green-300 hover:text-green-600'
        }`
      : `text-sm rounded-full px-4 py-1.5 border transition-all ${
          isActive
            ? 'bg-green-500 border-green-500 text-white'
            : 'bg-white border-gray-200 text-gray-500 hover:border-green-300 hover:text-green-600'
        }`

  const promptClass = compact
    ? 'text-xs bg-white border border-gray-200 rounded-full px-3 py-1 text-gray-600 hover:border-green-300 hover:bg-green-50 hover:text-green-700 transition-all disabled:opacity-50'
    : 'bg-white border border-gray-200 rounded-full px-4 py-2 text-sm text-gray-600 hover:border-green-300 hover:bg-green-50 hover:text-green-700 transition-all disabled:opacity-50'

  return (
    <div className={compact ? 'mb-3' : ''}>
      {/* 類別 */}
      {categories.length > 1 && (
        <div
          className={`flex flex-wrap gap-2 ${
            compact ? 'mb-2' : 'justify-center mb-4'
          }`}
        >
          {categories.map(category => {
            const isActive = active?.id === category.id

            return (
              <button
                key={category.id}
                type="button"
                aria-pressed={isActive}
                onClick={() =>
                  setActiveId(
                    compact && isActive ? null : category.id
                  )
                }
                className={tabClass(isActive)}
              >
                {category.icon} {category.label}
              </button>
            )
          })}
        </div>
      )}

      {/* 該類別的問題 */}
      {active && (
        <div
          className={`flex flex-wrap gap-2 ${
            compact
              ? 'max-h-40 overflow-y-auto'
              : 'justify-center'
          }`}
        >
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
