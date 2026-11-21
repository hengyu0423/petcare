import { Link } from 'react-router-dom'

// ======================================================
// 今日飲食總覽（精簡版）
//
// 只保留一般飼主最需要的四件事：
//   實際攝取、建議值、建議範圍、狀態。
// 其餘細節（餐次完成度、營養比例）交給下面的計畫與紀錄，
// 避免同一頁重複顯示。
// ======================================================

const STATUS = {
  no_data: {
    label: '尚無紀錄',
    className: 'bg-[#faf7ef] text-ink-soft border-[#eae6d8]',
    bar: '#8e978d'
  },
  no_target: {
    label: '無法估算',
    className: 'bg-[#faf7ef] text-ink-soft border-[#eae6d8]',
    bar: '#8e978d'
  },
  under: {
    label: '低於建議範圍',
    className: 'bg-[#fff8e9] text-[#a5681c] border-[#f0d9b5]',
    bar: '#c96f2e'
  },
  in_range: {
    label: '在建議範圍內',
    className: 'bg-pine-50 text-pine-700 border-pine-100',
    bar: '#2c5a43'
  },
  over: {
    label: '超出建議範圍',
    className: 'bg-[#fdf0ec] text-[#b4552f] border-[#f3c2b8]',
    bar: '#b4552f'
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
    <div className="rounded-3xl border border-[#f3e3cd] bg-plate p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold tracking-wide text-ink-soft">
            {dateLabel}飲食
          </p>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <p className="font-brand text-4xl font-extrabold leading-none tabular-nums text-pine-900">
              {hasData ? formatKcal(actual) : '—'}
            </p>
            <span className="text-sm font-semibold text-ink-soft">
              {hasTarget ? `/ 建議 ${formatKcal(targetKcal)} kcal` : '/ 尚無建議值'}
            </span>
          </div>
          <p className="mt-2 text-xs text-ink-soft">
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
        <div className="mt-5">
          <div className="relative h-3 rounded-full bg-[#faf7ef]">
            <div
              className="absolute bottom-0 top-0 rounded-full border border-pine-100 bg-pine-100"
              style={{
                left: `${pos(minKcal)}%`,
                width: `${Math.max(pos(maxKcal) - pos(minKcal), 1)}%`
              }}
            />
            {hasData && (
              <div
                className="absolute top-1/2 h-6 w-1.5 -translate-y-1/2 rounded-full shadow-[0_2px_6px_rgba(87,54,17,0.35)]"
                style={{
                  left: `calc(${pos(actual)}% - 3px)`,
                  backgroundColor: info.bar
                }}
              />
            )}
          </div>
          <div className="mt-2 flex justify-between text-[11px] font-medium text-ink-soft/80">
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
        <p className="mt-4 rounded-xl bg-[#faf7ef] px-3 py-2.5 text-xs text-ink-soft">
          還沒有餵食紀錄。新增後，這裡會自動顯示今天的攝取量與狀態。
        </p>
      )}

      <div className="mt-3 flex justify-end">
        <Link
          to="/weekly-report"
          className="text-xs font-bold text-pine-700 transition-colors hover:text-[#c96f2e]"
        >
          查看健康週報 →
        </Link>
      </div>
    </div>
  )
}
