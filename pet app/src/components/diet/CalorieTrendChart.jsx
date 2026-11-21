// ======================================================
// 一週熱量趨勢（折線圖）
//
// - 折線／點：每日實際攝取
// - 綠色區塊：當日建議範圍（最低～最高）
// - 沒有紀錄的日期會斷線，不會畫成 0 kcal
// ======================================================

const WIDTH = 660
const HEIGHT = 240
const PAD = { top: 18, right: 16, bottom: 34, left: 52 }

const STATUS_COLOR = {
  under: '#c96f2e',
  in_range: '#2c5a43',
  over: '#b4552f',
  no_data: '#8e978d',
  no_target: '#8e978d'
}

function niceMax(value) {
  if (!Number.isFinite(value) || value <= 0) return 2000
  return Math.ceil(value / 100) * 100
}

function shortDate(date) {
  return String(date || '').slice(5).replace('-', '/')
}

export default function CalorieTrendChart({
  days = [],
  selectedDate,
  onSelectDate
}) {
  if (days.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-ink-soft">
        目前沒有可顯示的趨勢資料。
      </div>
    )
  }

  const values = days.flatMap(day =>
    [day.actualKcal, day.minKcal, day.maxKcal].filter(
      value => value !== null && value !== undefined
    )
  )

  const maxValue = Math.max(...values, 1)
  const yMax = niceMax(maxValue * 1.15)

  const chartW = WIDTH - PAD.left - PAD.right
  const chartH = HEIGHT - PAD.top - PAD.bottom

  const x = index =>
    days.length === 1
      ? PAD.left + chartW / 2
      : PAD.left + (index / (days.length - 1)) * chartW

  const y = value =>
    PAD.top + (1 - Number(value || 0) / yMax) * chartH

  // 連續有建議範圍的日期 → 一段色帶
  const rangeRuns = []
  let currentRun = []

  days.forEach((day, index) => {
    const valid =
      day.minKcal !== null &&
      day.minKcal !== undefined &&
      day.maxKcal !== null &&
      day.maxKcal !== undefined

    if (valid) {
      currentRun.push({ ...day, index })
    } else if (currentRun.length > 0) {
      rangeRuns.push(currentRun)
      currentRun = []
    }
  })

  if (currentRun.length > 0) rangeRuns.push(currentRun)

  // 連續有實際紀錄的日期 → 一段折線
  const actualRuns = []
  let actualRun = []

  days.forEach((day, index) => {
    if (day.hasData && day.actualKcal !== null) {
      actualRun.push({ ...day, index })
    } else if (actualRun.length > 0) {
      actualRuns.push(actualRun)
      actualRun = []
    }
  })

  if (actualRun.length > 0) actualRuns.push(actualRun)

  const selectedIndex = days.findIndex(day => day.date === selectedDate)

  return (
    <div>

      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full min-w-[560px]"
          role="img"
          aria-label="一週熱量趨勢圖"
        >

          {/* 水平格線與 Y 軸 */}
          {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
            const value = Math.round(yMax * ratio)
            const yy = y(value)

            return (
              <g key={ratio}>
                <line
                  x1={PAD.left}
                  y1={yy}
                  x2={WIDTH - PAD.right}
                  y2={yy}
                  stroke="#f1ede2"
                  strokeWidth="1"
                />
                <text
                  x={PAD.left - 8}
                  y={yy + 3}
                  textAnchor="end"
                  fontSize="9"
                  fill="#8e978d"
                >
                  {value.toLocaleString('zh-TW')}
                </text>
              </g>
            )
          })}

          {/* 建議範圍色帶 */}
          {rangeRuns.map((run, runIndex) => {
            const top = run
              .map(day => `${x(day.index)},${y(day.maxKcal)}`)
              .join(' ')

            const bottom = [...run]
              .reverse()
              .map(day => `${x(day.index)},${y(day.minKcal)}`)
              .join(' ')

            return (
              <polygon
                key={`range-${runIndex}`}
                points={`${top} ${bottom}`}
                fill="#dde8dc"
                opacity="0.8"
              />
            )
          })}

          {/* 只有一天有範圍時，色帶太窄，補一條短線 */}
          {rangeRuns.map((run, runIndex) =>
            run.length === 1 ? (
              <line
                key={`range-single-${runIndex}`}
                x1={x(run[0].index) - 7}
                y1={y(run[0].maxKcal)}
                x2={x(run[0].index) + 7}
                y2={y(run[0].maxKcal)}
                stroke="#b8d0bb"
                strokeWidth="2"
              />
            ) : null
          )}

          {/* 選取日期 */}
          {selectedIndex >= 0 && (
            <line
              x1={x(selectedIndex)}
              y1={PAD.top}
              x2={x(selectedIndex)}
              y2={HEIGHT - PAD.bottom}
              stroke="#2c5a43"
              strokeDasharray="4 4"
              strokeWidth="1"
              opacity="0.45"
            />
          )}

          {/* 實際攝取折線 */}
          {actualRuns.map((run, runIndex) => {
            if (run.length === 1) return null

            const points = run
              .map(day => `${x(day.index)},${y(day.actualKcal)}`)
              .join(' ')

            return (
              <polyline
                key={`line-${runIndex}`}
                points={points}
                fill="none"
                stroke="#2c5a43"
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )
          })}

          {/* 實際攝取點 */}
          {days.map((day, index) => {
            if (!day.hasData || day.actualKcal === null) return null

            return (
              <g
                key={day.date}
                onClick={() => onSelectDate?.(day.date)}
                className="cursor-pointer"
              >
                <circle
                  cx={x(index)}
                  cy={y(day.actualKcal)}
                  r="5"
                  fill="#fffdf6"
                  stroke={STATUS_COLOR[day.status] || '#2c5a43'}
                  strokeWidth="2.5"
                >
                  <title>
                    {day.date}：{Math.round(day.actualKcal)} kcal
                    {day.minKcal !== null
                      ? `（建議 ${day.minKcal}–${day.maxKcal}）`
                      : ''}
                  </title>
                </circle>
                <text
                  x={x(index)}
                  y={y(day.actualKcal) - 10}
                  textAnchor="middle"
                  fontSize="9.5"
                  fontWeight="600"
                  fill="#1e241f"
                >
                  {Math.round(day.actualKcal)}
                </text>
              </g>
            )
          })}

          {/* 沒有紀錄的日期：標示缺漏，不畫成 0 */}
          {days.map((day, index) =>
            !day.hasData ? (
              <text
                key={`empty-${day.date}`}
                x={x(index)}
                y={HEIGHT - PAD.bottom - 6}
                textAnchor="middle"
                fontSize="9"
                fill="#ddd8c8"
              >
                無紀錄
              </text>
            ) : null
          )}

          {/* X 軸日期 */}
          {days.map((day, index) => (
            <text
              key={`x-${day.date}`}
              x={x(index)}
              y={HEIGHT - 12}
              textAnchor="middle"
              fontSize="9.5"
              fontWeight={day.date === selectedDate ? '700' : '400'}
              fill={day.date === selectedDate ? '#2c5a43' : '#8e978d'}
              onClick={() => onSelectDate?.(day.date)}
              className="cursor-pointer"
            >
              {shortDate(day.date)}
            </text>
          ))}

        </svg>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-[11px] text-ink-soft mt-2 px-1">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-4 h-0.5 bg-[#2c5a43] rounded-full" />
          實際攝取
        </span>

        <span className="inline-flex items-center gap-1.5">
          <span className="w-4 h-2.5 bg-green-100 border border-green-200 rounded-sm" />
          建議範圍（最低～最高）
        </span>

        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-line" />
          沒有紀錄（不視為 0）
        </span>
      </div>

    </div>
  )
}
