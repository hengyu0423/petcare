// Kizupi 式 FAQ：左邊粗體大標題，右邊等寬編號 + 細分隔線 + 加號展開
export default function FaqSection({ id, title, intro, items }) {
  return (
    <section className="grid gap-8 rounded-3xl border border-hair bg-plate p-6 shadow-card md:p-10 lg:grid-cols-[5fr_7fr] lg:gap-14" aria-labelledby={id}>
      <div>
        <p className="kicker">FAQ</p>
        <h2 id={id} className="mt-2 font-brand text-[34px] font-extrabold leading-[1.02] tracking-tight text-pine-900 md:text-5xl">
          {title}
        </h2>
        <div className="mt-4 max-w-xs text-sm leading-relaxed text-ink-soft">{intro}</div>
      </div>

      <div className="divide-y divide-hair border-y border-hair">
        {items.map((it, i) => (
          <details key={it.q} className="faq-item group">
            <summary>
              <span className="w-6 shrink-0 font-mono text-[11px] font-bold tabular-nums text-ink-faint">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="flex-1 font-brand text-[15px] font-extrabold text-pine-900">{it.q}</span>
              <span className="faq-plus" aria-hidden="true" />
            </summary>
            <div className="faq-body">{it.a}</div>
          </details>
        ))}
      </div>
    </section>
  )
}
