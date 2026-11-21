import CalorieTrendChart from './CalorieTrendChart'

// ======================================================
// 一週熱量趨勢
//
// 同時呈現：
//   - 每日實際攝取（折線／點）
//   - 當日建議範圍（最低～最高，綠色區塊）
//   - 缺漏日期（不當成 0 kcal）
// ======================================================

const STATUS = {
  under: { label: '低於範圍', className: 'bg-[#fff8e9] text-[#a5681c] border-[#f0d9b5]' },
  in_range: { label: '範圍內', className: 'bg-pine-50 text-pine-700 border-pine-100' },
  over: { label: '超出範圍', className: 'bg-[#fdf0ec] text-[#b4552f] border-[#f3c2b8]' },
  no_data: { label: '無紀錄', className: 'bg-[#faf7ef] text-ink-soft border-[#eae6d8]' },
  no_target: { label: '無建議範圍', className: 'bg-[#faf7ef] text-ink-soft border-[#eae6d8]' }
}

function formatKcal(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number.toLocaleString('zh-TW') : '—'
}

export default function DietTrendTab({
  days = [],
  isLoading,
  isError,
  selectedDate,
  onSelectDate,
  rangeRule
}) {
  if (isLoading) {
    return (
      <div className="rounded-3xl border border-[#f3e3cd] bg-plate p-6">
        <div className="h-56 animate-pulse rounded-2xl bg-[#faf7ef]" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="rounded-3xl border border-[#f3e3cd] bg-plate p-8 text-center">
        <p className="text-sm text-ink-soft">暫時無法取得熱量趨勢，請稍後再試。</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-[#f3e3cd] bg-plate p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-start gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-pine-50 text-pine-700">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 20V5M4 20h16" />
                <path d="M7.5 16l3.5-4 3 2 4.5-6" />
              </svg>
            </span>
            <div>
              <h2 className="text-sm font-bold text-pine-900">一週熱量趨勢</h2>
              <p className="mt-0.5 text-xs text-ink-soft">實際攝取與每日建議範圍（最低～最高）</p>
            </div>
          </div>
          <span className="text-[11px] text-ink-soft/80">
            {rangeRule || '建議範圍依體重與個別條件估算'}
          </span>
        </div>

        <CalorieTrendChart
          days={days}
          selectedDate={selectedDate}
          onSelectDate={onSelectDate}
        />
      </div>

      <div className="overflow-hidden rounded-3xl border border-[#f3e3cd] bg-plate">
        <div className="border-b border-[#f3ead9] px-5 py-3.5">
          <h2 className="text-sm font-bold text-pine-900">每日攝取與建議範圍</h2>
        </div>
        <div className="divide-y divide-[#f7f3e9]">
          {days.map(day => {
            const info = STATUS[day.status] || STATUS.no_data
            const isSelected = day.date === selectedDate
            return (
              <button
                key={day.date}
                type="button"
                onClick={() => onSelectDate(day.date)}
                className={`flex w-full flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-3 text-left transition-colors ${
                  isSelected ? 'bg-pine-50/70' : 'hover:bg-[#faf7ef]'
                }`}
              >
                <span className={`w-16 text-sm font-bold ${isSelected ? 'text-pine-700' : 'text-pine-900'}`}>
                  {day.date.slice(5).replace('-', '/')}
                </span>
                <span className="w-24 text-sm font-extrabold tabular-nums text-pine-900">
                  {day.hasData ? `${formatKcal(day.actualKcal)} kcal` : '—'}
                </span>
                <span className="min-w-[130px] flex-1 text-xs text-ink-soft">
                  {day.minKcal !== null && day.maxKcal !== null
                    ? `${formatKcal(day.minKcal)}–${formatKcal(day.maxKcal)} kcal`
                    : '無建議範圍'}
                </span>
                <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${info.className}`}>
                  {info.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <p className="px-1 text-[11px] leading-relaxed text-ink-soft/80">
        沒有紀錄的日期會顯示「—／無紀錄」，不會被算成 0 kcal。
        歷史建議範圍會保留當時的計算基準，體重更新不會改寫過去的判斷。
      </p>
    </div>
  )
}
