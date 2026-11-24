import { Link } from 'react-router-dom'
import PixelAssistant from '../brand/PixelAssistant'

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
            <span className="mr-1 font-mono text-ink-faint">{String(index + 1).padStart(2, '0')}</span>
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
      {/* 今日飲食分析（深綠功能區） */}
      <div className="forest-band rounded-3xl bg-pine-800 px-5 pb-8 pt-8 text-paper shadow-card sm:px-6">
        <div className="relative flex flex-wrap items-center gap-3">
          <PixelAssistant tile size={40} mood={loadingAdvice ? 'typing' : 'idle'} />
          <h2 className="font-brand text-lg font-extrabold text-paper">
            AI 個人化<span className="text-lime">飲食建議</span>
          </h2>
          <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 font-mono text-[10px] font-bold tracking-wider text-paper/75">
            Powered by Groq
          </span>
        </div>

        <div className="relative mt-5">
          <p className="font-mono text-[11px] font-bold tracking-[0.14em] text-lime">01 · 今日飲食分析</p>
          <p className="mt-2 text-xs leading-relaxed text-paper/70">
            系統會讀取 {pet?.name || '這隻寵物'} 的寵物資料、
            {dateLabel}的飲食紀錄、每日建議範圍與健康紀錄，產生個人化建議。
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-semibold text-paper">
            <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-0.5">
              實際：<span className="font-mono tabular-nums">{hasData ? `${formatKcal(actualKcal)} kcal` : '尚無紀錄'}</span>
            </span>
            {hasTarget && (
              <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-0.5">
                建議：<span className="font-mono tabular-nums">{formatKcal(target.minKcal)}–{formatKcal(target.maxKcal)} kcal</span>
              </span>
            )}
            {statusLabel && (
              <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-0.5">狀態：{statusLabel}</span>
            )}
            {consultationsCount > 0 && (
              <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-0.5">
                健康諮詢 <span className="font-mono tabular-nums">{consultationsCount}</span> 筆
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onAnalyze}
            disabled={loadingAdvice}
            className="btn-lime mt-5 flex w-full items-center justify-center gap-1.5 rounded-xl bg-lime px-4 py-3 font-brand text-sm font-extrabold text-pine-900 disabled:opacity-60"
          >
            <LineIcon name="spark" size={15} />
            {loadingAdvice ? '分析中…' : '分析今日飲食'}
          </button>
        </div>
      </div>

      {/* 主動提問 */}
      <div className="rounded-3xl border border-hair shadow-card bg-plate p-5">
        <p className="font-mono text-[11px] font-bold tracking-[0.14em] text-honey-deep">02 · 主動提問</p>
        <p className="mt-1 text-xs leading-relaxed text-ink-soft">
          AI 會沿用同一份寵物資料、當日飲食、建議範圍與健康狀況回答。
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {EXAMPLES.map(example => (
            <button
              key={example}
              type="button"
              onClick={() => setAdviceQuestion(example)}
              className="rounded-full border border-hair-strong bg-cream px-3 py-1 text-[11px] font-semibold text-pine-800 transition-colors hover:border-pine-700/40 hover:bg-warm"
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
            className="min-w-0 flex-1 rounded-xl border border-sand bg-cream px-3 py-2.5 text-sm text-ink placeholder:text-ink-soft/60 focus:border-pine-700/40 focus:bg-plate focus:outline-none"
          />
          <button
            type="button"
            onClick={onAsk}
            disabled={sendingQuestion || loadingAdvice || !adviceQuestion.trim()}
            className="shrink-0 rounded-xl bg-pine-800 px-4 py-2.5 font-brand text-xs font-extrabold text-warm transition-colors hover:bg-pine-700 disabled:opacity-50"
          >
            {sendingQuestion ? '思考中…' : '取得建議'}
          </button>
        </div>
      </div>

      {/* 載入／錯誤 */}
      {loadingAdvice && (
        <div className="flex items-start gap-2.5">
          <PixelAssistant tile size={34} mood="typing" />
          <div className="bubble-ai px-4 py-3">
            <div className="flex h-5 items-center gap-1.5">
              {[0, 1, 2].map(i => (
                <div key={i} className="h-2 w-2 animate-bounce rounded-[2px] bg-pine-700" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
            <p className="mt-1 text-xs text-ink-soft">AI 正在分析健康、當日與近期飲食紀錄…</p>
          </div>
        </div>
      )}

      {adviceError && (
        <div role="alert" className="rounded-2xl border-2 border-clay bg-clay-50 p-3.5">
          <p className="text-xs font-semibold text-clay">{adviceError}</p>
        </div>
      )}

      {/* 今日分析結果 */}
      {dietAdvice && (
        <div className="flex items-start gap-2.5">
          <PixelAssistant tile size={34} />
          <div className="bubble-ai min-w-0 flex-1 p-4">
            <p className="mb-2 font-mono text-[11px] font-bold tracking-[0.14em] text-honey-deep">今日飲食分析</p>
            <div className="text-sm leading-relaxed text-ink" dangerouslySetInnerHTML={{ __html: adviceHtml(dietAdvice) }} />
            <AdviceSources sources={adviceSources} />
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-pine-100 pt-3">
              <p className="flex items-center gap-1 text-xs text-ink-soft">
                <LineIcon name="alert" size={13} />
                此建議僅供參考，請諮詢專業獸醫
              </p>
              <button type="button" onClick={onAnalyze} className="shrink-0 text-xs font-bold text-pine-700 hover:underline">
                重新分析
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 追加提問結果（即使還沒做今日分析也會顯示） */}
      {adviceFollowups.length > 0 && (
        <div className="space-y-4">
          {adviceFollowups.map((item, index) => (
            <div key={index} className="space-y-2.5">
              <div className="flex justify-end">
                <div className="bubble-user max-w-[88%] px-4 py-2.5 text-sm font-bold">{item.question}</div>
              </div>
              <div className="flex items-start gap-2.5">
                <PixelAssistant tile size={34} />
                <div className="bubble-ai min-w-0 flex-1 p-4">
                  <div className="text-sm leading-relaxed text-ink" dangerouslySetInnerHTML={{ __html: adviceHtml(item.answer) }} />
                  <AdviceSources sources={item.sources} />
                </div>
              </div>
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
