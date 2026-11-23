import { Link } from 'react-router-dom'
import PixelGarden from './PixelGarden'
import PixelBullet from './PixelBullet'

// 登入／註冊共用的左側品牌面板（Kizupi 式）：
// 深森林綠底 → 白字＋螢光綠第二行 → 半透明小卡片 → 像素抖色邊 → 像素小草地

function PawMark({ size = 20, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="currentColor" className={className} aria-hidden="true">
      <ellipse cx="24" cy="31" rx="10.5" ry="8" />
      <circle cx="12.5" cy="20" r="4" />
      <circle cx="20" cy="13" r="4" />
      <circle cx="28" cy="13" r="4" />
      <circle cx="35.5" cy="20" r="4" />
    </svg>
  )
}

export default function BrandPanel({ lines, sub, features, catSays, dogSays }) {
  return (
    <div className="relative flex flex-col overflow-hidden bg-pine-800 text-paper">
      <div className="relative px-6 pt-7 lg:px-9 lg:pt-10">
        {/* Logo 列 */}
        <Link to="/login" className="relative flex items-center gap-2.5 self-start">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-honey">
            <PawMark size={20} className="text-pine-900" />
          </span>
          <span className="font-brand text-xl font-bold tracking-tight text-paper">PawCare</span>
        </Link>

        {/* 主標：第一行白、第二行螢光綠 */}
        <h1 className="mt-7 font-brand text-[28px] font-extrabold leading-[1.12] tracking-tight sm:text-3xl xl:text-4xl">
          <span className="block text-paper">{lines[0]}</span>
          <span className="block text-lime">{lines[1]}</span>
        </h1>
        <p className="mt-3 text-xs text-paper/70 sm:text-sm">{sub}</p>

        {/* 三張半透明小卡片 */}
        <ul className="mt-6 grid gap-2.5">
          {features.map(f => (
            <li key={f.t} className="rounded-2xl border border-white/15 bg-white/[0.07] px-4 py-3">
              <div className="flex items-center gap-2.5">
                <PixelBullet />
                <p className="font-brand text-sm font-extrabold text-paper">{f.t}</p>
              </div>
              <p className="mt-1 pl-[24px] text-[11px] leading-relaxed text-paper/65 lg:text-xs">{f.d}</p>
            </li>
          ))}
        </ul>
      </div>

      {/* 像素抖色邊 + 像素小草地 */}
      <div className="relative mt-7">
        <div aria-hidden="true" className="pixel-dither" />
        <PixelGarden catSays={catSays} dogSays={dogSays} />
      </div>
    </div>
  )
}
