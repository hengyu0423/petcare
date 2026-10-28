import { Check, AlertTriangle, ChevronRight, Loader2 } from 'lucide-react'

const STEPS = [
  { key: 'health',     label: '健康歷史與偏好' },
  { key: 'recentDiet', label: '近期飲食紀錄' },
  { key: 'nutrition',  label: '營養安全檢核' }
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
    <div className="bg-[var(--ef-paper)] border border-[var(--ef-rule)] p-3.5 my-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-mono text-[var(--ef-ink-2)] uppercase tracking-wider">
          餵食安全管線檢測 // SAFETY_PIPELINE
        </span>
        {checking && (
          <span className="text-[10px] font-mono text-[var(--ef-ink)] flex items-center gap-1 animate-pulse">
            <Loader2 size={11} className="animate-spin" />
            CHECKING...
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {STEPS.map((step, index) => {
          const count = counts[step.key]
          let badgeStyle = 'bg-[var(--ef-panel)] border-[var(--ef-rule)] text-[var(--ef-ink-2)]'
          let Icon = null

          if (!checking) {
            if (count === 0) {
              badgeStyle = 'bg-[var(--ef-panel)] border-[var(--ef-ink)] text-[var(--ef-ink)] font-bold'
              Icon = Check
            } else {
              badgeStyle = 'bg-[var(--ef-signal)] border-[var(--ef-ink)] text-[var(--ef-on-signal)] font-bold'
              Icon = AlertTriangle
            }
          }

          return (
            <div key={step.key} className="flex items-center gap-1.5">
              {index > 0 && (
                <ChevronRight size={13} className="text-[var(--ef-rule)]" />
              )}
              <span
                className={`text-[11px] font-mono px-2.5 py-1 border flex items-center gap-1 transition-colors ${badgeStyle} ${
                  checking ? 'animate-pulse' : ''
                }`}
              >
                {Icon && <Icon size={12} />}
                <span>{step.label}</span>
                {!checking && count > 0 && <span className="text-[10px]">({count})</span>}
              </span>
            </div>
          )
        })}

        <ChevronRight size={13} className="text-[var(--ef-rule)]" />

        <span className="text-[11px] font-mono px-2.5 py-1 border border-[var(--ef-rule)] bg-[var(--ef-paper)] text-[var(--ef-ink-2)]">
          確認給食
        </span>
      </div>

      <p className="text-[11px] font-mono text-[var(--ef-ink-2)] mt-2.5">
        {checking
          ? '// 正在進行多階段安全分析與過敏比對...'
          : total === 0
            ? '// 安全檢測完畢，未發現飲食衝突或過敏禁忌項目。'
            : `// 檢測發現 ${total} 項注意事項，請詳閱下方警訊提醒。`}
      </p>
    </div>
  )
}