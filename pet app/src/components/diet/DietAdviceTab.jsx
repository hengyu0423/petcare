import { Link } from 'react-router-dom'

// ======================================================
// AI 飲食建議
//
// 兩個入口：
//   1. 今日飲食分析：自動讀取寵物資料、當日飲食、建議範圍與健康紀錄
//   2. 主動提問：飼主直接問飲食問題，AI 沿用同一份資料回答
// ======================================================

const EXAMPLES = [
  '今天可以額外餵雞胸肉嗎？',
  '今天熱量已經超標，晚餐怎麼調整？',
  '寵物最近有嘔吐情況，飲食要注意什麼？'
]

const ICON = {
  spark: <><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3Z" /><path d="M18.5 15l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9.9-2.1Z" /></>,
  book: <><path d="M5 4.5h6a2.5 2.5 0 0 1 2.5 2.5v12A2.5 2.5 0 0 0 11 16.5H5Z" /><path d="M19 4.5h-6A2.5 2.5 0 0 0 10.5 7v12A2.5 2.5 0 0 1 13 16.5h6Z" /></>,
  alert: <><path d="M12 4.5 21 19.5H3L12 4.5Z" /><path d="M12 10v4M12 17h.01" /></>,
  question: <><circle cx="12" cy="12" r="8.5" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 1-1 1.7M12 16.5h.01" /></>
}

function LineIcon({ name, size = 16, className = '' }) {
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
      className={`shrink-0 ${className}`}
    >
      {ICON[name] || ICON.spark}
    </svg>
  )
}

function adviceHtml(text) {
  return String(text || '')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>')
}

function AdviceSources({ sources }) {
  if (!sources?.length) return null

  return (
    <div className="mt-3 border-t border-pine-100 pt-3">
      <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold text-pine-700">
        <LineIcon name="book" size={13} />
        回答依據獸醫資料庫（{sources.length} 筆）
      </p>
      <ul className="space-y-1">
        {sources.map((item, index) => (
          <li key={`${item.title}-${index}`} className="text-[11px] leading-relaxed text-ink-soft">
            {index + 1}.{' '}
            {item.url ? (
              <a href={item.url} target="_blank" rel="noreferrer" className="font-semibold text-pine-700 hover:underline">
                {item.title}
              </a>
            ) : item.title}
            {item.source && <span className="text-ink-soft/70">（{item.source}）</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}

function formatKcal(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number.toLocaleString('zh-TW') : '—'
}

export default function DietAdviceTab({
  pet,
  dateLabel,
  target,
  actualKcal,
  hasData,
  statusLabel,
  dietAdvice,
  loadingAdvice,
  adviceError,
  adviceSources,
  adviceQuestion,
  setAdviceQuestion,
  adviceFollowups,
  sendingQuestion,
  onAnalyze,
  onAsk,
  consultationsCount
}) {
  const hasTarget =
    Number.isFinite(Number(target?.targetKcal)) &&
    Number(target?.targetKcal) > 0

  return (
    <div className="space-y-4">
      {/* 今日飲食分析 */}
      <div className="rounded-3xl border border-[#f3e3cd] bg-plate p-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-pine-800 text-[#f5c04a]">
            <LineIcon name="spark" size={18} />
          </span>
          <h2 className="text-sm font-bold text-pine-900">AI 個人化飲食建議</h2>
          <span className="rounded-full bg-pine-50 px-2 py-0.5 text-xs font-bold text-pine-700">
            Powered by Groq
          </span>
        </div>

        <div className="mt-4 rounded-2xl border border-[#e8d9bd] bg-[#fff8e9] p-4">
          <p className="text-xs font-bold text-[#7a5200]">① 今日飲食分析</p>
          <p className="mt-1.5 text-xs leading-relaxed text-[#6b5637]">
            系統會讀取 {pet?.name || '這隻寵物'} 的寵物資料、
            {dateLabel}的飲食紀錄、每日建議範圍與健康紀錄，產生個人化建議。
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-semibold text-[#7a5200]">
            <span className="rounded-full bg-plate/80 px-2 py-0.5">
              實際：{hasData ? `${formatKcal(actualKcal)} kcal` : '尚無紀錄'}
            </span>
            {hasTarget && (
              <span className="rounded-full bg-plate/80 px-2 py-0.5">
                建議：{formatKcal(target.minKcal)}–{formatKcal(target.maxKcal)} kcal
              </span>
            )}
            {statusLabel && <span className="rounded-full bg-plate/80 px-2 py-0.5">狀態：{statusLabel}</span>}
            {consultationsCount > 0 && (
              <span className="rounded-full bg-plate/80 px-2 py-0.5">健康諮詢 {consultationsCount} 筆</span>
            )}
          </div>
          <button
            type="button"
            onClick={onAnalyze}
            disabled={loadingAdvice}
            className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#f5c04a] px-4 py-2.5 text-sm font-extrabold text-pine-900 shadow-[0_4px_0_#c96f2e] transition-all hover:bg-[#f0b23a] active:translate-y-[3px] active:shadow-none disabled:opacity-50"
          >
            <LineIcon name="spark" size={15} />
            {loadingAdvice ? '分析中…' : '分析今日飲食'}
          </button>
        </div>
      </div>

      {/* 主動提問 */}
      <div className="rounded-3xl border border-[#f3e3cd] bg-plate p-5">
        <p className="text-xs font-bold text-pine-900">② 主動提問</p>
        <p className="mt-1 text-xs leading-relaxed text-ink-soft">
          AI 會沿用同一份寵物資料、當日飲食、建議範圍與健康狀況回答。
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {EXAMPLES.map(example => (
            <button
              key={example}
              type="button"
              onClick={() => setAdviceQuestion(example)}
              className="rounded-full border border-[#e8d9bd] bg-[#faf7ef] px-3 py-1 text-[11px] font-semibold text-pine-800 transition-colors hover:border-pine-700/40 hover:bg-[#fdf6ea]"
            >
              {example}
            </button>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            value={adviceQuestion}
            onChange={e => setAdviceQuestion(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault()
                onAsk()
              }
            }}
            placeholder="例如：今天可以增加雞胸肉嗎？"
            maxLength={200}
            className="min-w-0 flex-1 rounded-xl border border-[#eae6d8] bg-[#faf7ef] px-3 py-2.5 text-sm text-ink placeholder:text-ink-soft/60 focus:border-pine-700/40 focus:bg-plate focus:outline-none"
          />
          <button
            type="button"
            onClick={onAsk}
            disabled={sendingQuestion || loadingAdvice || !adviceQuestion.trim()}
            className="shrink-0 rounded-xl bg-pine-800 px-4 py-2.5 text-xs font-bold text-[#fdf8ec] transition-colors hover:bg-pine-700 disabled:opacity-50"
          >
            {sendingQuestion ? '思考中…' : '取得建議'}
          </button>
        </div>
      </div>

      {/* 載入／錯誤 */}
      {loadingAdvice && (
        <div className="rounded-3xl border border-[#f3e3cd] bg-plate p-6 text-center">
          <div className="mb-2 flex justify-center gap-1.5">
            {[0, 1, 2].map(i => (
              <div key={i} className="h-2 w-2 animate-bounce rounded-full bg-pine-700" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
          <p className="text-xs text-ink-soft">AI 正在分析健康、當日與近期飲食紀錄…</p>
        </div>
      )}

      {adviceError && (
        <div role="alert" className="rounded-xl border border-[#f3c2b8] bg-[#fdf0ec] p-3">
          <p className="text-xs font-semibold text-[#b4552f]">{adviceError}</p>
        </div>
      )}

      {/* 今日分析結果 */}
      {dietAdvice && (
        <div className="rounded-2xl border border-pine-100 bg-pine-50/60 p-4">
          <div className="text-sm leading-relaxed text-ink" dangerouslySetInnerHTML={{ __html: adviceHtml(dietAdvice) }} />
          <AdviceSources sources={adviceSources} />
          <div className="mt-3 flex items-center justify-between border-t border-pine-100 pt-3">
            <p className="flex items-center gap-1 text-xs text-ink-soft">
              <LineIcon name="alert" size={13} />
              此建議僅供參考，請諮詢專業獸醫
            </p>
            <button type="button" onClick={onAnalyze} className="text-xs font-bold text-pine-700 hover:underline">
              重新分析
            </button>
          </div>
        </div>
      )}

      {/* 追加提問結果（即使還沒做今日分析也會顯示） */}
      {adviceFollowups.length > 0 && (
        <div className="space-y-3">
          {adviceFollowups.map((item, index) => (
            <div key={index} className="rounded-2xl border border-[#f3e3cd] bg-plate p-4">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-pine-800">
                <LineIcon name="question" size={14} />
                {item.question}
              </p>
              <div className="text-sm leading-relaxed text-ink" dangerouslySetInnerHTML={{ __html: adviceHtml(item.answer) }} />
              <AdviceSources sources={item.sources} />
            </div>
          ))}
        </div>
      )}

      <p className="px-1 text-[11px] leading-relaxed text-ink-soft/80">
        若寵物出現持續嘔吐、腹瀉、呼吸困難或疑似中毒，請優先聯絡獸醫，不要只依賴飲食建議。
        <Link to="/health-consult" className="ml-1 font-bold text-pine-700 hover:underline">前往健康諮詢 →</Link>
      </p>
    </div>
  )
}
