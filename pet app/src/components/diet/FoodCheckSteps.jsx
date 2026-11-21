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

const ICON = {
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  alert: <><path d="M12 4.5 21 19.5H3L12 4.5Z" /><path d="M12 10v4M12 17h.01" /></>,
  dot: <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />
}

function LineIcon({ name, size = 12 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      {ICON[name] || ICON.dot}
    </svg>
  )
}

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
    <div className="rounded-2xl border border-[#eae6d8] bg-[#faf7ef] p-3.5">
      <p className="mb-2.5 text-xs font-bold text-pine-900">餵食前檢查</p>

      <div className="flex flex-wrap items-center gap-1.5">
        {STEPS.map((step, index) => {
          const count = counts[step.key]
          let style = 'bg-[#eae6d8] text-ink-soft'
          let icon = 'dot'

          if (!checking) {
            if (count === 0) {
              style = 'bg-pine-50 text-pine-700'
              icon = 'check'
            } else {
              style = 'bg-[#fff3d6] text-[#a5681c]'
              icon = 'alert'
            }
          }

          return (
            <div key={step.key} className="flex items-center gap-1.5">
              {index > 0 && <LineIcon name="arrow" size={11} />}
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold ${style} ${checking ? 'animate-pulse' : ''}`}>
                <LineIcon name={icon} size={12} />
                {step.label}
                {icon === 'alert' && count > 0 && count}
              </span>
            </div>
          )
        })}

        <LineIcon name="arrow" size={11} />
        <span className="rounded-full bg-[#eae6d8] px-2 py-1 text-xs font-bold text-ink-soft">
          確認餵食
        </span>
      </div>

      <p className="mt-2.5 text-xs text-ink-soft">
        {checking
          ? '正在檢查這個食物…'
          : total === 0
            ? '沒有發現需要注意的地方，可以確認餵食。'
            : `共有 ${total} 項提醒，看完下方說明後再決定要不要餵。`}
      </p>
    </div>
  )
}
