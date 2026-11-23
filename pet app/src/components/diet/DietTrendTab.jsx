import PixelIcon from '../brand/PixelIcon'
import EmptyState from '../ui/EmptyState'
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
  under: { label: '低於範圍', className: 'bg-honey-50 text-honey-text border-honey-200' },
  in_range: { label: '範圍內', className: 'bg-pine-50 text-pine-700 border-pine-100' },
  over: { label: '超出範圍', className: 'bg-clay-50 text-clay border-clay-200' },
  no_data: { label: '無紀錄', className: 'bg-cream text-ink-soft border-sand' },
  no_target: { label: '無建議範圍', className: 'bg-cream text-ink-soft border-sand' }
}

const TICK_COLOR = {
  under: '#c96f2e',
  in_range: '#2c5a43',
  over: '#b4552f',
  no_data: '#8e978d',
  no_target: '#8e978d'
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
      <div className="rounded-3xl border border-hair shadow-card bg-plate p-6">
        <div className="skeleton h-56" />
      </div>
    )
  }

  if (isError) {
    return (
      <EmptyState icon="chart" title="暫時無法取得熱量趨勢" desc="請稍後再試。" />
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-hair shadow-card bg-plate p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-start gap-2.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-honey-100">
              <PixelIcon name="chart" size={28} />
            </span>
            <div>
              <h2 className="font-brand text-lg font-extrabold text-pine-900">一週熱量<span className="hl">趨勢</span></h2>
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

      <div className="overflow-hidden rounded-3xl border border-hair shadow-card bg-plate">
        <div className="border-b border-hair px-5 py-3.5">
          <h2 className="font-brand text-base font-extrabold text-pine-900">每日攝取與建議範圍</h2>
        </div>
        <div className="divide-y divide-hair">
          {days.map(day => {
            const info = STATUS[day.status] || STATUS.no_data
            const isSelected = day.date === selectedDate
            const hasRange = day.minKcal !== null && day.maxKcal !== null
            const actual = day.hasData ? Number(day.actualKcal) : null
            const ceiling = hasRange
              ? Math.max(Number(day.maxKcal) * 1.25, actual || 0, 1)
              : Math.max(actual || 0, 1)
            const pos = value => Math.min(100, Math.max(0, (Number(value) / ceiling) * 100))
            return (
              <button
                key={day.date}
                type="button"
                onClick={() => onSelectDate(day.date)}
                className={`flex w-full flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-3 text-left transition-colors ${
                  isSelected ? 'bg-lime/20' : 'hover:bg-cream'
                }`}
              >
                <span className="w-16 font-mono text-sm font-bold tabular-nums text-pine-900">
                  {day.date.slice(5).replace('-', '/')}
                </span>
                <span className="w-24 whitespace-nowrap">
                  <span className="font-brand text-base font-extrabold tabular-nums text-pine-900">
                    {day.hasData ? formatKcal(day.actualKcal) : '—'}
                  </span>
                  {day.hasData && <span className="ml-1 font-mono text-[10px] text-ink-mute">kcal</span>}
                </span>
                <span className="min-w-[130px] flex-1">
                  <span className="block font-mono text-[11px] tabular-nums text-ink-soft">
                    {hasRange
                      ? `${formatKcal(day.minKcal)}–${formatKcal(day.maxKcal)} kcal`
                      : '無建議範圍'}
                  </span>
                  <span className="relative mt-1.5 block h-2 rounded-full bg-hair" aria-hidden="true">
                    {hasRange && (
                      <span
                        className="absolute inset-y-0 rounded-full bg-lime/70"
                        style={{
                          left: `${pos(day.minKcal)}%`,
                          width: `${Math.max(pos(day.maxKcal) - pos(day.minKcal), 1)}%`
                        }}
                      />
                    )}
                    {actual !== null && (
                      <span
                        className="absolute top-1/2 h-4 w-1.5 -translate-y-1/2 rounded-full shadow-[0_0_0_2px_#fffdf6]"
                        style={{
                          left: `calc(${pos(actual)}% - 3px)`,
                          backgroundColor: TICK_COLOR[day.status] || TICK_COLOR.no_data
                        }}
                      />
                    )}
                  </span>
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
