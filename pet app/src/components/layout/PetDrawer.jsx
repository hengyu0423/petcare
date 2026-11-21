import { useEffect } from 'react'

/**
 * 寵物選擇欄
 * - 手機／平板（< lg）：從左側滑出的抽屜，預設收起
 * - 電腦（>= lg）：維持原本固定在左邊的欄位
 */
export function PetDrawer({ open, onClose, widthClass = 'md:w-56', children }) {
  useEffect(() => {
    if (!open) return
    const onKey = e => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <>
      {/* 半透明遮罩，點一下關閉 */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-pine-900/35 transition-opacity duration-200 md:hidden ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />

      <aside
        className={`
          fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-[#eae6d8] bg-plate
          transition-transform duration-200 ease-out
          pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]
          ${open ? 'translate-x-0 shadow-[0_30px_60px_-30px_rgba(87,54,17,0.55)]' : '-translate-x-full'}
          md:static md:z-auto ${widthClass} md:translate-x-0 md:shadow-none md:pt-0 md:pb-0 md:shrink-0
        `}
      >
        {/* 手機上的關閉鈕 */}
        <button
          onClick={onClose}
          aria-label="關閉寵物選單"
          className="absolute right-3 top-3 z-10 rounded-lg p-2 text-ink-soft transition-colors hover:bg-[#fdf6ea] md:hidden"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        {children}
      </aside>
    </>
  )
}

/**
 * 手機上的細條：顯示目前選的寵物，點一下展開寵物清單（電腦版隱藏）
 * icon 可传 React 节点（例如 <PetIcon />）；沒傳時退回 emoji。
 */
export function PetPickerBar({ emoji, icon, name, sub, onOpen }) {
  return (
    <div className="sticky top-0 z-20 border-b border-[#eae6d8] bg-plate/95 px-3 py-2 backdrop-blur md:hidden">
      <button
        onClick={onOpen}
        aria-label="開啟寵物選單"
        className="flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-[#fdf6ea] active:bg-[#f8efdd]"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-pine-700" aria-hidden="true">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
        {name ? (
          <>
            {icon || <span className="text-xl leading-none">{emoji}</span>}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-pine-900">{name}</span>
              {sub && <span className="block truncate text-xs text-ink-soft">{sub}</span>}
            </span>
            <span className="shrink-0 text-xs font-semibold text-pine-700">切換寵物</span>
          </>
        ) : (
          <span className="text-sm font-semibold text-ink-soft">選擇寵物</span>
        )}
      </button>
    </div>
  )
}
