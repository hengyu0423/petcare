import { CAT, PAL, spriteRects } from './pixelArt'

// PawCare 的像素小助理（阿橘）：會眨眼、會輕輕跳。
// - mood="idle"   慢慢晃（預設）
// - mood="typing" 回覆中：跳得比較快
// - tile          放在圓形底色裡；此時 size = 整顆圓的直徑

const OPEN = spriteRects(CAT, PAL)
// 閉眼：把上排眼睛（含高光）換成毛色，只留下排的深色像素當成閉著的眼睛
const CLOSED = spriteRects(CAT.map((r, i) => (i === 5 ? r.replace(/kw/g, 'oo') : r)), PAL)

function Sprite({ px, mood }) {
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      aria-hidden="true"
      className={`pa pa--${mood}`}
    >
      <g className="pa-open">
        {OPEN.map((r, i) => <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill={r.fill} />)}
      </g>
      <g className="pa-closed">
        {CLOSED.map((r, i) => <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill={r.fill} />)}
      </g>
    </svg>
  )
}

export default function PixelAssistant({ size = 32, mood = 'idle', tile = false, className = '' }) {
  if (!tile) return <span className={`inline-flex shrink-0 ${className}`}><Sprite px={size} mood={mood} /></span>
  return (
    <span
      className={`pa-tile inline-flex shrink-0 items-center justify-center rounded-full ${className}`}
      style={{ width: size, height: size }}
    >
      <Sprite px={Math.round(size * 0.8)} mood={mood} />
    </span>
  )
}
