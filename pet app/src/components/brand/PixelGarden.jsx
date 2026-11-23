import { Link } from 'react-router-dom'
import { CAT, DOG, PAL, DOG_PAL, spriteRects, sceneSvg, sunRects, petSprite } from './pixelArt'

// Kizupi 式像素小草地：藤蔓、雲、太陽、草丘。
// - 傳入 pets：站在草地上的是「使用者自己的毛孩」（依物種與品種換毛色），點擊進入該寵物頁
// - 沒傳 pets：用預設的像素貓與像素狗（登入／註冊頁用）
// - children：疊在場景上方的內容（首頁放問候與日期）

// 場景圖只生成一次，所有草地共用同一個網址（避免把整張 SVG 內聯進每個元素）
let sceneUrlCache
function sceneUrl() {
  if (sceneUrlCache) return sceneUrlCache
  const svg = sceneSvg()
  sceneUrlCache =
    typeof Blob !== 'undefined' && typeof URL !== 'undefined' && URL.createObjectURL
      ? `url("${URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))}")`
      : `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
  return sceneUrlCache
}
const SUN_RECTS = sunRects()
const MAX_PETS = 6
const SOUND = { cat: '喵～', dog: '汪！', bird: '啾啾！', rabbit: '蹦蹦～', fish: '咕嚕～' }

// 毛孩在草地上的台詞：名字後面接一句像在聊天的話
const CHATTER = {
  cat: ['喵～吃飽了！', '喵～陪我玩？', '喵～想被摸摸'],
  dog: ['汪！去散步？', '汪！最喜歡你', '汪！有零食嗎？'],
  bird: ['啾！唱歌給你聽', '啾啾！一起玩？'],
  rabbit: ['蹦～跳得高高的', '蹦蹦～有紅蘿蔔？'],
  fish: ['咕嚕～水好舒服', '咕嚕～游得開心']
}

function petChatter(pet, index) {
  const lines = CHATTER[pet.species]
  if (lines?.length) return lines[index % lines.length]
  return `${SOUND[pet.species] || ''}今天也要好好的喔！`
}

const DEFAULT_CAT = spriteRects(CAT, PAL, 2, 0)
const DEFAULT_DOG = spriteRects(DOG, DOG_PAL, 22, 0)

function Sun() {
  return (
    <svg className="pixel-garden__sun" viewBox="0 0 13 13" aria-hidden="true">
      {SUN_RECTS.map((r, i) => <rect key={i} x={r.x} y={r.y} width="1" height="1" fill={r.fill} />)}
    </svg>
  )
}

function PetSprite({ species, breed, delay = 0 }) {
  const sprite = petSprite(species, breed)
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="pixel-hop" style={{ animationDelay: `${delay}s` }}>
      {spriteRects(sprite.rows, sprite.pal).map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill={r.fill} />
      ))}
    </svg>
  )
}

export default function PixelGarden({
  pets,
  loading = false,
  tall = false,
  compact = false,
  children,
  catSays = '喵～今天吃飽了！',
  dogSays = '汪！一起散步？',
  className = ''
}) {
  const cls = `pixel-garden ${tall ? 'pixel-garden--tall' : ''} ${compact ? 'pixel-garden--compact' : ''} ${className}`

  // ===== 使用者自己的寵物 =====
  if (pets) {
    const shown = pets.slice(0, MAX_PETS)
    const extra = pets.length - shown.length
    return (
      <div className={cls}>
        <div className="pixel-garden__scene" style={{ backgroundImage: sceneUrl() }} />
        <Sun />
        {children && <div className="pixel-garden__hero">{children}</div>}

        {!loading && (
          <div className="pixel-garden__cast pixel-garden__cast--pets">
            {shown.length === 0 ? (
              <Link to="/pets" className="pixel-pet" aria-label="新增你的第一隻毛孩">
                <span className="pixel-bubble pixel-bubble--pet is-high">還沒有毛孩，新增第一隻吧！</span>
                <PetSprite species="other" />
              </Link>
            ) : (
              shown.map((pet, i) => {
                const href = pet.to === undefined ? `/pets/${pet.id}` : pet.to
                const line = petChatter(pet, i)
                const name = pet.name || '毛孩'
                const says = pet.says ?? `${name}：${line}`
                const inner = (
                  <>
                    <span className={`pixel-bubble pixel-bubble--pet ${i % 3 === 1 ? 'is-high' : i % 3 === 2 ? 'is-higher' : ''}`}>{says}</span>
                    <PetSprite species={pet.species} breed={pet.breed} delay={(i % 3) * 0.4} />
                  </>
                )
                const cn = `pixel-pet ${pet.dim ? 'is-dim' : ''}`
                return href ? (
                  <Link key={pet.id} to={href} className={cn} aria-label={`${pet.name || says}，查看詳細資料`}>{inner}</Link>
                ) : (
                  <div key={pet.id} className={`${cn} pixel-pet--static`} role="img" aria-label={says}>{inner}</div>
                )
              })
            )}
            {extra > 0 && (
              <Link to="/pets" className="pixel-more" aria-label={`還有 ${extra} 隻，查看全部`}>
                +{extra}
              </Link>
            )}
          </div>
        )}
      </div>
    )
  }

  // ===== 預設的像素貓與像素狗（沒有登入資料時）=====
  return (
    <div className={cls} role="img" aria-label="像素風的小草地：一隻貓和一隻狗在打招呼">
      <div className="pixel-garden__scene" style={{ backgroundImage: sceneUrl() }} />
      <Sun />
      {children && <div className="pixel-garden__hero">{children}</div>}
      <div className="pixel-garden__cast">
        <svg viewBox="0 0 40 16" aria-hidden="true">
          <g className="pixel-hop">
            {DEFAULT_CAT.map((r, i) => <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill={r.fill} />)}
          </g>
          <g className="pixel-hop pixel-hop--late">
            {DEFAULT_DOG.map((r, i) => <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill={r.fill} />)}
          </g>
        </svg>
        <span className="pixel-bubble pixel-bubble--l">{catSays}</span>
        <span className="pixel-bubble pixel-bubble--r">{dogSays}</span>
      </div>
    </div>
  )
}
