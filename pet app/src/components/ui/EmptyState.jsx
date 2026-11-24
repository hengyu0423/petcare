import { Link } from 'react-router-dom'
import PixelIcon from '../brand/PixelIcon'

// 全站共用的空狀態：像素插圖 + 標題 + 說明 + 選用的行動按鈕。
//   <EmptyState icon="coin" title="還沒有支出記錄" desc="…" action={{ label: '新增', to: '/x' }} />
//   - icon：PixelIcon 的名稱（dry / wet / snack / other / coin / chart / note / chat / camera / bell / heart / paw）
//   - action：{ label, to } 或 { label, onClick }
//   - compact：放在卡片裡的小尺寸版本（沒有虛線框）
const btn =
  'inline-flex items-center gap-1.5 rounded-xl bg-honey px-5 py-2.5 text-sm font-extrabold text-pine-900 shadow-press transition-all hover:bg-honey-hover active:translate-y-[3px] active:shadow-none'

export default function EmptyState({ icon = 'paw', title, desc, action, compact = false, className = '' }) {
  return (
    <div
      className={`text-center ${
        compact
          ? 'rounded-2xl bg-cream px-4 py-6'
          : 'rounded-3xl border-2 border-dashed border-hair-strong bg-cream px-6 py-14'
      } ${className}`}
    >
      <span
        className={`mx-auto flex items-center justify-center border border-hair bg-plate shadow-card ${
          compact ? 'h-12 w-12 rounded-2xl' : 'h-16 w-16 rounded-3xl'
        }`}
      >
        <PixelIcon name={icon} size={compact ? 30 : 44} />
      </span>
      {title && (
        <p className={`mt-3 font-brand font-extrabold text-pine-900 ${compact ? 'text-sm' : 'text-base'}`}>{title}</p>
      )}
      {desc && <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-ink-soft">{desc}</p>}
      {action &&
        (action.to ? (
          <Link to={action.to} className={`${btn} mt-5`}>{action.label}</Link>
        ) : (
          <button type="button" onClick={action.onClick} className={`${btn} mt-5`}>{action.label}</button>
        ))}
    </div>
  )
}
