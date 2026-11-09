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
  under: {
    label: '低於範圍',
    className: 'bg-amber-50 text-amber-700 border-amber-200'
  },
  in_range: {
    label: '範圍內',
    className: 'bg-green-50 text-green-700 border-green-200'
  },
  over: {
    label: '超出範圍',
    className: 'bg-red-50 text-red-600 border-red-200'
  },
  no_data: {
    label: '無紀錄',
    className: 'bg-gray-100 text-gray-500 border-gray-200'
  },
  no_target: {
    label: '無建議範圍',
    className: 'bg-gray-100 text-gray-500 border-gray-200'
  }
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
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="h-56 rounded-xl bg-gray-50 animate-pulse" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center">
        <p className="text-sm text-gray-500">
          暫時無法取得熱量趨勢，請稍後再試。
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">

      <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5">

        <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
          <div>
            <h2 className="text-sm font-bold text-gray-800">
              📈 一週熱量趨勢
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              實際攝取與每日建議範圍（最低～最高）
            </p>
          </div>

          <span className="text-[11px] text-gray-400">
            {rangeRule || '建議範圍依體重與個別條件估算'}
          </span>
        </div>

        <CalorieTrendChart
          days={days}
          selectedDate={selectedDate}
          onSelectDate={onSelectDate}
        />

      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">

        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-800">
            每日攝取與建議範圍
          </h2>
        </div>

        <div className="divide-y divide-gray-50">

          {days.map(day => {
            const info = STATUS[day.status] || STATUS.no_data
            const isSelected = day.date === selectedDate

            return (
              <button
                key={day.date}
                type="button"
                onClick={() => onSelectDate(day.date)}
                className={`w-full text-left px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 transition-colors ${
                  isSelected
                    ? 'bg-green-50/60'
                    : 'hover:bg-gray-50'
                }`}
              >

                <span
                  className={`text-sm font-semibold w-16 ${
                    isSelected ? 'text-green-700' : 'text-gray-700'
                  }`}
                >
                  {day.date.slice(5).replace('-', '/')}
                </span>

                <span className="text-sm font-bold text-gray-800 w-24">
                  {day.hasData
                    ? `${formatKcal(day.actualKcal)} kcal`
                    : '—'}
                </span>

                <span className="text-xs text-gray-400 flex-1 min-w-[130px]">
                  {day.minKcal !== null && day.maxKcal !== null
                    ? `${formatKcal(day.minKcal)}–${formatKcal(day.maxKcal)} kcal`
                    : '無建議範圍'}
                </span>

                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${info.className}`}
                >
                  {info.label}
                </span>

              </button>
            )
          })}

        </div>

      </div>

      <p className="text-[11px] text-gray-400 px-1 leading-relaxed">
        沒有紀錄的日期會顯示「—／無紀錄」，不會被算成 0 kcal。
        歷史建議範圍會保留當時的計算基準，體重更新不會改寫過去的判斷。
      </p>

    </div>
  )
}
