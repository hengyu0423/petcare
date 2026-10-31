// =====================================================
// AI 回覆的「參考來源」
//
// 資料來自後端的 msg.sources：[{ slug, title, source, url }]
// - 同一個來源頁面可能對應多個主題，依網址合併顯示
// - 只接受 http / https 連結，其他一律不顯示
// - 預設收合，避免對話太長
// =====================================================

function isSafeUrl(url) {
  return typeof url === 'string' && /^https?:\/\//i.test(url)
}

export default function KnowledgeSources({ sources }) {
  const list = Array.isArray(sources) ? sources : []

  const grouped = new Map()

  for (const item of list) {
    if (!item || !isSafeUrl(item.url)) continue

    if (!grouped.has(item.url)) {
      grouped.set(item.url, {
        url: item.url,
        source: item.source || item.url,
        topics: []
      })
    }

    const group = grouped.get(item.url)

    if (item.title && !group.topics.includes(item.title)) {
      group.topics.push(item.title)
    }
  }

  const groups = [...grouped.values()]

  if (groups.length === 0) return null

  return (
    <details className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
      <summary className="cursor-pointer select-none font-medium text-gray-500 hover:text-gray-700">
        📚 參考來源（{groups.length}）
      </summary>

      <ul className="mt-2 space-y-2">
        {groups.map(group => (
          <li key={group.url} className="leading-relaxed">
            <a
              href={group.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-600 hover:underline break-words"
            >
              {group.source}
            </a>

            {group.topics.length > 0 && (
              <div className="text-gray-400">
                相關主題：{group.topics.join('、')}
              </div>
            )}
          </li>
        ))}
      </ul>

      <p className="mt-2 text-gray-400">
        以上為資料整理，僅供參考，不能取代獸醫診斷。
      </p>
    </details>
  )
}
