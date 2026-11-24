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
    <details className="mt-3 border-t border-pine-100 pt-3 text-xs text-ink-soft">
      <summary className="cursor-pointer select-none font-bold text-pine-700 transition-colors hover:text-honey-deep">
        <span className="inline-flex items-center gap-1.5">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
            <path d="M5 4.5h6a2.5 2.5 0 0 1 2.5 2.5v12A2.5 2.5 0 0 0 11 16.5H5Z" />
            <path d="M19 4.5h-6A2.5 2.5 0 0 0 10.5 7v12A2.5 2.5 0 0 1 13 16.5h6Z" />
          </svg>
          參考來源（{groups.length}）
        </span>
      </summary>

      <ul className="mt-2 space-y-2">
        {groups.map(group => (
          <li key={group.url} className="leading-relaxed">
            <a
              href={group.url}
              target="_blank"
              rel="noopener noreferrer"
              className="break-words font-semibold text-pine-700 hover:underline"
            >
              {group.source}
            </a>

            {group.topics.length > 0 && (
              <div className="text-ink-soft/80">
                相關主題：{group.topics.join('、')}
              </div>
            )}
          </li>
        ))}
      </ul>

      <p className="mt-2 text-ink-soft/80">
        以上為資料整理，僅供參考，不能取代獸醫診斷。
      </p>
    </details>
  )
}
