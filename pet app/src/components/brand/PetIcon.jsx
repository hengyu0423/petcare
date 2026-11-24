import { useId, useMemo } from 'react'
import { petSprite, spriteRects } from './pixelArt'

// PawCare 宠物头像（像素风，Kizupi 式）
// - 16×16 像素角色放在圆形底色里，和首页「像素小草地」同一套画风
// - 猫、狗依 breed 文字挑毛色（狗還分垂耳／立耳）；只需要 species，breed 選填

export default function PetIcon({ species, breed, size = 44, className = '' }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const sprite = petSprite(species, breed)
  const rects = useMemo(() => spriteRects(sprite.rows, sprite.pal, 2, 2), [sprite])
  const [bg1, bg2] = sprite.bg

  return (
    <svg width={size} height={size} viewBox="0 0 20 20" role="img" aria-hidden="true" className={className}>
      <defs>
        <radialGradient id={`pi-${uid}`} cx="32%" cy="24%" r="88%">
          <stop offset="0" stopColor={bg1} />
          <stop offset="1" stopColor={bg2} />
        </radialGradient>
      </defs>
      <circle cx="10" cy="10" r="9.7" fill={`url(#pi-${uid})`} />
      <circle cx="10" cy="10" r="9.7" fill="none" stroke="#5B3A11" strokeOpacity="0.1" strokeWidth="0.3" />
      <g shapeRendering="crispEdges">
        {/* 腳下的像素影子 */}
        <rect x="5" y="18" width="10" height="1" fill="#5B3A11" opacity="0.1" />
        {rects.map((r, i) => (
          <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill={r.fill} />
        ))}
      </g>
    </svg>
  )
}
