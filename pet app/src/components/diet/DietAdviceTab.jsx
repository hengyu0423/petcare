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

function adviceHtml(text) {
  return String(text || '')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>')
}

function AdviceSources({ sources }) {
  if (!sources?.length) return null

  return (
    <div className="mt-3 pt-3 border-t border-green-200">
      <p className="text-[11px] font-semibold text-gray-500 mb-1">
        📚 回答依據獸醫資料庫（{sources.length} 筆）
      </p>

      <ul className="space-y-1">
        {sources.map((item, index) => (
          <li
            key={`${item.title}-${index}`}
            className="text-[11px] leading-relaxed text-gray-500"
          >
            {index + 1}.{' '}
            {item.url ? (
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="text-green-600 hover:underline"
              >
                {item.title}
              </a>
            ) : (
              item.title
            )}
            {item.source && (
              <span className="text-gray-400">（{item.source}）</span>
            )}
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
      <div className="bg-white border border-gray-200 rounded-2xl p-5">

        <div className="flex items-center gap-2">
          <span className="text-lg">🤖</span>
          <h2 className="text-sm font-bold text-gray-800">
            AI 個人化飲食建議
          </h2>
          <span className="text-xs bg-green-50 text-green-600 font-semibold px-2 py-0.5 rounded-full">
            Powered by Groq
          </span>
        </div>

        <div className="mt-4 bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">

          <p className="text-xs font-bold text-green-700">
            ① 今日飲食分析
          </p>

          <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">
            系統會讀取 {pet?.name || '這隻寵物'} 的寵物資料、
            {dateLabel}的飲食紀錄、每日建議範圍與健康紀錄，
            產生個人化建議。
          </p>

          <div className="flex flex-wrap gap-1.5 mt-2 text-[11px] text-gray-500">
            <span className="bg-white/80 rounded-full px-2 py-0.5">
              實際：{hasData ? `${formatKcal(actualKcal)} kcal` : '尚無紀錄'}
            </span>

            {hasTarget && (
              <span className="bg-white/80 rounded-full px-2 py-0.5">
                建議：{formatKcal(target.minKcal)}–{formatKcal(target.maxKcal)} kcal
              </span>
            )}

            {statusLabel && (
              <span className="bg-white/80 rounded-full px-2 py-0.5">
                狀態：{statusLabel}
              </span>
            )}

            {consultationsCount > 0 && (
              <span className="bg-white/80 rounded-full px-2 py-0.5">
                健康諮詢 {consultationsCount} 筆
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={onAnalyze}
            disabled={loadingAdvice}
            className="mt-3 w-full bg-green-500 hover:bg-green-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {loadingAdvice ? '分析中…' : '✨ 分析今日飲食'}
          </button>

        </div>

      </div>

      {/* 主動提問 */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">

        <p className="text-xs font-bold text-gray-700">
          ② 主動提問
        </p>

        <p className="text-xs text-gray-400 mt-1 leading-relaxed">
          AI 會沿用同一份寵物資料、當日飲食、建議範圍與健康狀況回答。
        </p>

        <div className="flex flex-wrap gap-1.5 mt-2">
          {EXAMPLES.map(example => (
            <button
              key={example}
              type="button"
              onClick={() => setAdviceQuestion(example)}
              className="text-[11px] text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-full px-2.5 py-1 transition-colors"
            >
              {example}
            </button>
          ))}
        </div>

        <div className="flex gap-2 mt-3">

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
            className="flex-1 min-w-0 border border-gray-200 bg-gray-50 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-300 focus:bg-white"
          />

          <button
            type="button"
            onClick={onAsk}
            disabled={
              sendingQuestion || loadingAdvice || !adviceQuestion.trim()
            }
            className="shrink-0 bg-green-500 hover:bg-green-600 text-white px-4 py-2.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
          >
            {sendingQuestion ? '思考中…' : '取得建議'}
          </button>

        </div>

      </div>

      {/* 載入／錯誤 */}
      {loadingAdvice && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 text-center">
          <div className="flex gap-1.5 justify-center mb-2">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-2 h-2 bg-green-400 rounded-full animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>

          <p className="text-xs text-gray-400">
            AI 正在分析健康、當日與近期飲食紀錄…
          </p>
        </div>
      )}

      {adviceError && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-3">
          <p className="text-xs text-red-500">{adviceError}</p>
        </div>
      )}

      {/* 今日分析結果 */}
      {dietAdvice && (
        <div className="bg-green-50 border border-green-100 rounded-xl p-4">

          <div
            className="text-sm text-gray-700 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: adviceHtml(dietAdvice) }}
          />

          <AdviceSources sources={adviceSources} />

          <div className="mt-3 pt-3 border-t border-green-200 flex items-center justify-between">
            <p className="text-xs text-gray-400">
              ⚠️ 此建議僅供參考，請諮詢專業獸醫
            </p>

            <button
              type="button"
              onClick={onAnalyze}
              className="text-xs text-green-500 hover:underline font-medium"
            >
              重新分析
            </button>
          </div>

        </div>
      )}

      {/* 追加提問結果（即使還沒做今日分析也會顯示） */}
      {adviceFollowups.length > 0 && (
        <div className="space-y-3">
          {adviceFollowups.map((item, index) => (
            <div
              key={index}
              className="bg-white border border-gray-200 rounded-xl p-4"
            >
              <p className="text-xs font-semibold text-gray-600 mb-2">
                ❓ {item.question}
              </p>

              <div
                className="text-sm text-gray-700 leading-relaxed"
                dangerouslySetInnerHTML={{
                  __html: adviceHtml(item.answer)
                }}
              />

              <AdviceSources sources={item.sources} />
            </div>
          ))}
        </div>
      )}

      <p className="text-[11px] text-gray-400 leading-relaxed px-1">
        若寵物出現持續嘔吐、腹瀉、呼吸困難或疑似中毒，
        請優先聯絡獸醫，不要只依賴飲食建議。
        <Link
          to="/health-consult"
          className="text-green-600 font-semibold hover:underline ml-1"
        >
          前往健康諮詢 →
        </Link>
      </p>

    </div>
  )
}
