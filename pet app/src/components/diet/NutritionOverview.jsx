import { Link } from 'react-router-dom'

// ======================================================
// 今日飲食總覽（精簡版）
//
// 只保留一般飼主最需要的四件事：
//   實際攝取、建議值、建議範圍、狀態。
// 其餘細節（餐次完成度、營養比例）交給下面的計畫與紀錄，
// 避免同一頁重複顯示。
// ======================================================

// 深綠底上的狀態色：className 是狀態標籤，bar 是進度標記
const STATUS = {
  no_data: {
    label: '尚無紀錄',
    className: 'border-white/20 bg-white/10 text-paper/80',
    bar: '#aab7ad'
  },
  no_target: {
    label: '無法估算',
    className: 'border-white/20 bg-white/10 text-paper/80',
    bar: '#aab7ad'
  },
  under: {
    label: '低於建議範圍',
    className: 'border-honey/40 bg-honey/15 text-honey',
    bar: '#f5c04a'
  },
  in_range: {
    label: '在建議範圍內',
    className: 'border-lime/40 bg-lime/15 text-lime',
    bar: '#d3f26a'
  },
  over: {
    label: '超出建議範圍',
    className: 'border-clay-200/40 bg-clay-200/15 text-clay-200',
    bar: '#f3b49c'
  }
}

function formatKcal(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '—'
  return number.toLocaleString('zh-TW')
}

export default function NutritionOverview({
  dateLabel,
  target,
  actualKcal,
  hasData,
  status
}) {
  const info = STATUS[status] || STATUS.no_data

  const targetKcal = Number(target?.targetKcal)
  const minKcal = Number(target?.minKcal)
  const maxKcal = Number(target?.maxKcal)

  const hasTarget = Number.isFinite(targetKcal) && targetKcal > 0
  const actual = hasData ? Number(actualKcal) : null

  const percent =
    hasData && hasTarget
      ? Math.round((actual / targetKcal) * 100)
      : null

  const ceiling = hasTarget
    ? Math.max(maxKcal * 1.25, actual || 0, targetKcal)
    : Math.max(actual || 0, 1)

  const pos = value => {
    const number = Number(value)
    if (!Number.isFinite(number)) return 0
    return Math.min(Math.max((number / ceiling) * 100, 0), 100)
  }

  return (
    <div className="forest-band rounded-3xl bg-pine-800 px-5 pb-8 pt-8 text-paper shadow-card sm:px-6">
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[11px] font-bold tracking-[0.14em] text-lime">
            {dateLabel}飲食
          </p>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <p className="font-brand text-5xl font-extrabold leading-none tabular-nums text-paper">
              {hasData ? formatKcal(actual) : '—'}
            </p>
            <span className="text-sm font-semibold text-paper/65">
              {hasTarget ? `/ 建議 ${formatKcal(targetKcal)} kcal` : '/ 尚無建議值'}
            </span>
          </div>
          <p className="mt-2 text-xs text-paper/60">
            {hasTarget
              ? `建議範圍 ${formatKcal(minKcal)}–${formatKcal(maxKcal)} kcal`
              : '需要體重資料才能估算建議範圍'}
          </p>
        </div>

        <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold ${info.className}`}>
          {info.label}
        </span>
      </div>

      {hasTarget && (
        <div className="relative mt-6">
          <div className="relative h-3 rounded-full bg-white/10">
            <div
              className="absolute bottom-0 top-0 rounded-full bg-white/20"
              style={{
                left: `${pos(minKcal)}%`,
                width: `${Math.max(pos(maxKcal) - pos(minKcal), 1)}%`
              }}
            />
            {hasData && (
              <div
                className="absolute top-1/2 h-6 w-1.5 -translate-y-1/2 rounded-full shadow-[0_0_0_2px_var(--color-pine-800)]"
                style={{
                  left: `calc(${pos(actual)}% - 3px)`,
                  backgroundColor: info.bar
                }}
              />
            )}
          </div>
          <div className="mt-2 flex justify-between text-[11px] font-medium text-paper/60">
            <span>0</span>
            <span>
              {percent !== null
                ? `約為建議值的 ${percent}%`
                : hasData
                  ? '沒有可比較的建議值'
                  : '這天沒有紀錄，不會算成 0 kcal'}
            </span>
            <span>{formatKcal(Math.round(ceiling))} kcal</span>
          </div>
        </div>
      )}

      {!hasData && (
        <p className="relative mt-4 rounded-xl bg-white/10 px-3 py-2.5 text-xs text-paper/75">
          還沒有餵食紀錄。新增後，這裡會自動顯示今天的攝取量與狀態。
        </p>
      )}

      <div className="relative mt-3 flex justify-end">
        <Link
          to="/weekly-report"
          className="text-xs font-bold text-lime transition-colors hover:text-paper"
        >
          查看健康週報 →
        </Link>
      </div>
    </div>
  )
}
