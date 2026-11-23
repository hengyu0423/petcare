import EmptyState from '../ui/EmptyState'

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

// 圖表色（SVG 屬性不能用 Tailwind 類別，這裡對應全站色票）
const C = {
  grid: '#f1e6d3',      // hair
  axis: '#6f786e',      // ink-mute
  ink: '#18301f',       // pine-900
  line: '#2c5a43',      // pine-700
  band: '#d3f26a',      // lime
  bandEdge: '#b6d84a',
  dot: '#fffdf6',       // plate
  missing: '#b2b8ae'    // ink-ghost
}

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
    return <EmptyState compact icon="chart" title="目前沒有可顯示的趨勢資料" />
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
          style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
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
                  stroke={C.grid}
                  strokeWidth="1"
                />
                <text
                  x={PAD.left - 8}
                  y={yy + 3}
                  textAnchor="end"
                  fontSize="9"
                  fill={C.axis}
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
                fill={C.band}
                opacity="0.5"
              />
            )
          })}

          {/* 色帶上下緣 */}
          {rangeRuns.map((run, runIndex) =>
            run.length > 1 ? (
              <g key={`edge-${runIndex}`} fill="none" stroke={C.bandEdge} strokeWidth="1.5" strokeLinejoin="round">
                <polyline points={run.map(day => `${x(day.index)},${y(day.maxKcal)}`).join(' ')} />
                <polyline points={run.map(day => `${x(day.index)},${y(day.minKcal)}`).join(' ')} />
              </g>
            ) : null
          )}

          {/* 只有一天有範圍時，色帶太窄，補一條短線 */}
          {rangeRuns.map((run, runIndex) =>
            run.length === 1 ? (
              <line
                key={`range-single-${runIndex}`}
                x1={x(run[0].index) - 7}
                y1={y(run[0].maxKcal)}
                x2={x(run[0].index) + 7}
                y2={y(run[0].maxKcal)}
                stroke={C.bandEdge}
                strokeWidth="3"
              />
            ) : null
          )}

          {/* 選取日期：荧光綠欄 */}
          {selectedIndex >= 0 && (
            <rect
              x={x(selectedIndex) - 16}
              y={PAD.top}
              width="32"
              height={HEIGHT - PAD.top - PAD.bottom}
              rx="8"
              fill={C.band}
              opacity="0.3"
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
                stroke={C.line}
                strokeWidth="3"
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
                <rect
                  x={x(index) - 5}
                  y={y(day.actualKcal) - 5}
                  width="10"
                  height="10"
                  fill={C.dot}
                  stroke={STATUS_COLOR[day.status] || C.line}
                  strokeWidth="2.5"
                  shapeRendering="crispEdges"
                >
                  <title>
                    {`${day.date}：${Math.round(day.actualKcal)} kcal${
                      day.minKcal !== null ? `（建議 ${day.minKcal}–${day.maxKcal}）` : ''
                    }`}
                  </title>
                </rect>
                <text
                  x={x(index)}
                  y={y(day.actualKcal) - 10}
                  textAnchor="middle"
                  fontSize="9.5"
                  fontWeight="700"
                  fill={C.ink}
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
                fill={C.missing}
              >
                無紀錄
              </text>
            ) : null
          )}

          {/* X 軸日期：選取的那天有荧光綠底 */}
          {days.map((day, index) => {
            const selected = day.date === selectedDate
            return (
              <g key={`x-${day.date}`} onClick={() => onSelectDate?.(day.date)} className="cursor-pointer">
                {selected && (
                  <rect x={x(index) - 21} y={HEIGHT - 25} width="42" height="17" rx="5" fill={C.band} />
                )}
                <text
                  x={x(index)}
                  y={HEIGHT - 12}
                  textAnchor="middle"
                  fontSize="9.5"
                  fontWeight={selected ? '700' : '400'}
                  fill={selected ? C.ink : C.axis}
                >
                  {shortDate(day.date)}
                </text>
              </g>
            )
          })}

        </svg>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-[11px] text-ink-soft mt-2 px-1">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full bg-pine-700" />
          實際攝取
        </span>

        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm border border-lime bg-lime/50" />
          建議範圍（最低～最高）
        </span>

        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 bg-hair-strong" />
          沒有紀錄（不視為 0）
        </span>
      </div>

    </div>
  )
}
