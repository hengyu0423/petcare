import PixelAssistant from '../brand/PixelAssistant'

// 骨架塊：<Skeletons count={3} className="h-20" />
export function Skeletons({ count = 3, className = 'h-20', wrapperClassName = 'space-y-3' }) {
  return (
    <div className={wrapperClassName} aria-busy="true" aria-label="載入中">
      {Array.from({ length: count }, (_, i) => <div key={i} className={`skeleton ${className}`} />)}
    </div>
  )
}

// 整塊載入中：像素小助理跳著等你（compact 為放在卡片裡的小尺寸）
export default function LoadingState({ label = '載入中…', compact = false, className = '' }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center text-center ${compact ? 'py-8' : 'py-24'} ${className}`}
    >
      <PixelAssistant size={compact ? 40 : 56} mood="typing" />
      <p className="mt-2 text-xs font-bold tracking-[0.12em] text-ink-mute">{label}</p>
    </div>
  )
}
