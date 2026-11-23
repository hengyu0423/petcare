import { useMemo } from 'react'
import { ICON_ROWS, ICON_PAL } from './pixelIcons'

// 通用像素圖示：name = dry / wet / snack / other / coin / chart / note / chat / camera / bell / heart / paw
export default function PixelIcon({ name = 'paw', size = 34, className = '' }) {
  const key = ICON_ROWS[name] ? name : 'paw'
  const rects = useMemo(() => {
    const out = []
    ICON_ROWS[key].forEach((row, y) => {
      let x = 0
      while (x < row.length) {
        const ch = row[x]
        if (ch === '.') { x++; continue }
        let n = 1
        while (row[x + n] === ch) n++
        out.push({ x, y, w: n, fill: ICON_PAL[key][ch] })
        x += n
      }
    })
    return out
  }, [key])
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden="true" className={className}>
      {rects.map((r, i) => <rect key={i} x={r.x} y={r.y} width={r.w} height="1" fill={r.fill} />)}
    </svg>
  )
}
