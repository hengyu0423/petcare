import { Link } from 'react-router-dom'

// Kizupi 式編號列表：等寬數字 01、02…、細分隔線、右側箭頭
export default function NumberedLinks({ title, items }) {
  return (
    <nav className="rounded-3xl border border-hair bg-plate p-5 shadow-card md:p-6" aria-label={title}>
      <p className="kicker">{title}</p>
      <ol className="mt-3 divide-y divide-hair border-y border-hair">
        {items.map((it, i) => (
          <li key={it.to}>
            <Link to={it.to} className="group flex items-center gap-4 py-3.5">
              <span className="w-6 shrink-0 font-mono text-[11px] font-bold tabular-nums text-ink-faint transition-colors group-hover:text-honey-deep">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-brand text-[15px] font-extrabold text-pine-900">{it.title}</span>
                <span className="mt-0.5 block truncate text-xs text-ink-soft">{it.desc}</span>
              </span>
              <svg
                width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
                className="shrink-0 text-ink-faint transition-all group-hover:translate-x-1 group-hover:text-pine-900"
              >
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  )
}
