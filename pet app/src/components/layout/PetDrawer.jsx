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
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 md:hidden ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />

      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 flex flex-col
          transition-transform duration-200 ease-out
          pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]
          ${open ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
          md:static md:z-auto ${widthClass} md:translate-x-0 md:shadow-none md:pt-0 md:pb-0 md:shrink-0
        `}
      >
        {/* 手機上的關閉鈕 */}
        <button
          onClick={onClose}
          aria-label="關閉寵物選單"
          className="md:hidden absolute top-3 right-3 z-10 p-2 rounded-lg text-gray-500 hover:bg-gray-100"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
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
 */
export function PetPickerBar({ emoji, name, sub, onOpen }) {
  return (
    <div className="md:hidden sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-gray-200 px-3 py-2">
      <button
        onClick={onOpen}
        aria-label="開啟寵物選單"
        className="w-full flex items-center gap-3 px-2 py-1.5 rounded-xl hover:bg-gray-50 active:bg-gray-100 text-left"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-gray-600 shrink-0">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
        {name ? (
          <>
            <span className="text-xl leading-none">{emoji}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-gray-800 truncate">{name}</span>
              {sub && <span className="block text-xs text-gray-400 truncate">{sub}</span>}
            </span>
            <span className="text-xs text-green-600 font-medium shrink-0">切換寵物</span>
          </>
        ) : (
          <span className="text-sm font-medium text-gray-600">選擇寵物</span>
        )}
      </button>
    </div>
  )
}