import { Link } from 'react-router-dom'

// 全站共用的頁面標題：大標題（可指定荧光綠重點字）、副標題、返回鈕、右側動作區。
//   <PageHeader title="財務" accent="管理" subtitle="記錄每隻寵物的花費" actions={<button/>} />
//   - title / accent / suffix：依序接在一起，accent 會套上荧光綠方塊
//   - back：{ to, label }，顯示成方形返回鈕
//   - leading：標題前面的內容（例如寵物頭像）
//   - badge：標題旁的小標籤
//   - className：傳入 mb-* 時會取代預設下邊距
export default function PageHeader({ title, accent, suffix, subtitle, back, leading, badge, actions, className = '' }) {
  const hasMargin = /\bmb-/.test(className)
  return (
    <header className={`flex flex-wrap items-end justify-between gap-4 ${hasMargin ? '' : 'mb-6'} ${className}`}>
      <div className="flex min-w-0 items-center gap-3">
        {back && (
          <Link
            to={back.to}
            aria-label={back.label}
            title={back.label}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-hair-strong bg-plate text-pine-700 shadow-card transition-colors hover:bg-warm"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </Link>
        )}
        {leading}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-brand text-2xl font-extrabold leading-tight tracking-tight text-pine-900 md:text-3xl">
              {title}
              {accent && <span className="hl">{accent}</span>}
              {suffix}
            </h1>
            {badge}
          </div>
          {subtitle && <p className="mt-1 text-sm text-ink-soft">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </header>
  )
}
