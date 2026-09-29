// ======================================================
// 餵食前檢查流程
//
//   選擇食物 → 健康歷史與偏好 → 近期飲食 → 營養與安全
//            → 顯示警訊／建議 → 確認餵食
//
// 「自己選擇」與「依照飲食計畫」都會經過同一個流程。
// 每個警訊由後端標上所屬階段（warning.check）。
// ======================================================

const STEPS = [
  { key: 'health', label: '健康歷史與偏好' },
  { key: 'recentDiet', label: '近期飲食' },
  { key: 'nutrition', label: '營養與安全' }
]

export default function FoodCheckSteps({
  warnings = [],
  checking = false,
  checked = false
}) {
  if (!checking && !checked) return null

  const counts = { health: 0, recentDiet: 0, nutrition: 0 }

  for (const w of warnings) {
    const key = w.check in counts ? w.check : 'nutrition'
    counts[key] += 1
  }

  const total = warnings.length

  return (
    <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">

      <p className="text-xs font-bold text-gray-600 mb-2">
        餵食前檢查
      </p>

      <div className="flex flex-wrap items-center gap-1.5">

        {STEPS.map((step, index) => {
          const count = counts[step.key]

          let style = 'bg-gray-100 text-gray-500'
          let icon = '…'

          if (!checking) {
            if (count === 0) {
              style = 'bg-green-50 text-green-600'
              icon = '✓'
            } else {
              style = 'bg-amber-50 text-amber-700'
              icon = `⚠️ ${count}`
            }
          }

          return (
            <div key={step.key} className="flex items-center gap-1.5">

              {index > 0 && (
                <span className="text-gray-300 text-xs">→</span>
              )}

              <span
                className={`text-xs font-medium px-2 py-1 rounded-full ${style} ${
                  checking ? 'animate-pulse' : ''
                }`}
              >
                {icon} {step.label}
              </span>

            </div>
          )
        })}

        <span className="text-gray-300 text-xs">→</span>

        <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-500">
          確認餵食
        </span>

      </div>

      <p className="text-xs text-gray-400 mt-2">
        {checking
          ? '正在檢查這個食物…'
          : total === 0
            ? '沒有發現需要注意的地方，可以確認餵食。'
            : `共有 ${total} 項提醒，看完下方說明後再決定要不要餵。`}
      </p>

    </div>
  )
}