import { Link } from 'react-router-dom'
import PixelBullet from './PixelBullet'

// Kizupi 式深綠功能區：白字標題 + 螢光綠第二行 + 螢光綠按鈕 + 半透明小卡片，
// 上下緣有像素抖色邊。
export default function ForestBand({ id, lines, sub, cta, cards }) {
  return (
    <section className="forest-band rounded-3xl bg-pine-800 text-paper shadow-card" aria-labelledby={id}>
      <div className="relative grid gap-8 px-6 py-11 md:px-10 md:py-14 lg:grid-cols-[5fr_7fr] lg:items-center lg:gap-12">
        <div>
          <h2 id={id} className="font-brand text-[32px] font-extrabold leading-[1.06] tracking-tight md:text-[44px]">
            <span className="block">{lines[0]}</span>
            <span className="block text-lime">{lines[1]}</span>
          </h2>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-paper/70">{sub}</p>
          <Link
            to={cta.to}
            className="btn-lime mt-6 inline-flex items-center gap-2 rounded-xl bg-lime px-5 py-3 font-brand text-sm font-extrabold text-pine-900"
          >
            {cta.label}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
        </div>

        <ul className="grid gap-3 sm:grid-cols-2">
          {cards.map(c => (
            <li key={c.t}>
              <Link
                to={c.to}
                className="block h-full rounded-2xl border border-white/15 bg-white/[0.07] p-4 transition-colors hover:border-white/30 hover:bg-white/[0.12]"
              >
                <PixelBullet />
                <p className="mt-3 font-brand text-[15px] font-extrabold text-paper">{c.t}</p>
                <p className="mt-1 text-xs leading-relaxed text-paper/65">{c.d}</p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
