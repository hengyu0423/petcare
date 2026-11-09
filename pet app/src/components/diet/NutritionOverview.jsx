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
    className: 'bg-gray-100 text-gray-500 border-gray-200',
    bar: '#9ca3af'
  },
  no_target: {
    label: '無法估算',
    className: 'bg-gray-100 text-gray-500 border-gray-200',
    bar: '#9ca3af'
  },
  under: {
    label: '低於建議範圍',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
    bar: '#f59e0b'
  },
  in_range: {
    label: '在建議範圍內',
    className: 'bg-green-50 text-green-700 border-green-200',
    bar: '#22c55e'
  },
  over: {
    label: '超出建議範圍',
    className: 'bg-red-50 text-red-600 border-red-200',
    bar: '#ef4444'
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
    <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 mb-4">

      <div className="flex items-start justify-between gap-3">

        <div className="min-w-0">
          <p className="text-xs font-semibold text-gray-400">
            {dateLabel}飲食
          </p>

          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mt-1">
            <p className="text-3xl font-bold text-gray-800 leading-none">
              {hasData ? formatKcal(actual) : '—'}
            </p>

            <span className="text-sm text-gray-400">
              {hasTarget
                ? `/ 建議 ${formatKcal(targetKcal)} kcal`
                : '/ 尚無建議值'}
            </span>
          </div>

          <p className="text-xs text-gray-500 mt-1.5">
            {hasTarget
              ? `建議範圍 ${formatKcal(minKcal)}–${formatKcal(maxKcal)} kcal`
              : '需要體重資料才能估算建議範圍'}
          </p>
        </div>

        <span
          className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border ${info.className}`}
        >
          {info.label}
        </span>

      </div>

      {hasTarget && (
        <div className="mt-4">

          <div className="relative h-2.5 rounded-full bg-gray-100">

            <div
              className="absolute top-0 bottom-0 rounded-full bg-green-100 border border-green-200"
              style={{
                left: `${pos(minKcal)}%`,
                width: `${Math.max(pos(maxKcal) - pos(minKcal), 1)}%`
              }}
            />

            {hasData && (
              <div
                className="absolute top-1/2 -translate-y-1/2 w-1.5 h-5 rounded-full shadow-sm"
                style={{
                  left: `calc(${pos(actual)}% - 3px)`,
                  backgroundColor: info.bar
                }}
              />
            )}

          </div>

          <div className="flex justify-between text-[11px] text-gray-400 mt-1.5">
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
        <p className="text-xs text-gray-500 mt-3">
          還沒有餵食紀錄。新增後，這裡會自動顯示今天的攝取量與狀態。
        </p>
      )}

      <div className="flex justify-end mt-2">
        <Link
          to="/weekly-report"
          className="text-[11px] text-gray-400 hover:text-green-600 hover:underline"
        >
          查看健康週報 →
        </Link>
      </div>

    </div>
  )
}
