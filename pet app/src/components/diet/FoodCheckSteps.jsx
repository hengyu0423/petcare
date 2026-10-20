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
    <div className="bg-[#fafafa] border border-[#d9d9d9] p-3.5 my-3" data-theme="light">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-mono text-[#8a8a8a] uppercase tracking-wider">
          餵食安全管線檢測 // SAFETY_PIPELINE
        </span>
        {checking && (
          <span className="text-[10px] font-mono text-[#191919] flex items-center gap-1 animate-pulse">
            <Loader2 size={11} className="animate-spin" />
            CHECKING...
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {STEPS.map((step, index) => {
          const count = counts[step.key]
          let badgeStyle = 'bg-white border-[#d9d9d9] text-[#8a8a8a]'
          let Icon = null

          if (!checking) {
            if (count === 0) {
              badgeStyle = 'bg-white border-[#191919] text-[#191919] font-bold'
              Icon = Check
            } else {
              badgeStyle = 'bg-[#fffbeb] border-[#fde68a] text-[#b45309] font-bold'
              Icon = AlertTriangle
            }
          }

          return (
            <div key={step.key} className="flex items-center gap-1.5">
              {index > 0 && (
                <ChevronRight size={13} className="text-[#b0b0b0]" />
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

        <ChevronRight size={13} className="text-[#b0b0b0]" />

        <span className="text-[11px] font-mono px-2.5 py-1 border border-[#e5e5e5] bg-[#f5f5f5] text-[#8a8a8a]">
          確認給食
        </span>
      </div>

      <p className="text-[11px] font-mono text-[#8a8a8a] mt-2.5">
        {checking
          ? '// 正在進行多階段安全分析與過敏比對...'
          : total === 0
            ? '// 安全檢測完畢，未發現飲食衝突或過敏禁忌項目。'
            : `// 檢測發現 ${total} 項注意事項，請詳閱下方警訊提醒。`}
      </p>
    </div>
  )
}