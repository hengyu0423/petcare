import { useEffect } from 'react'
import { X, Menu } from 'lucide-react'

/**
 * 寵物選擇欄（Endfield 工業風格）
 * - 手機／平板（< md）：從左側滑出的抽屜，預設收起
 * - 電腦（>= md）：維持固定在左邊的專屬邊欄
 */
export function PetDrawer({ open, onClose, widthClass = 'md:w-60', children }) {
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
        className={`fixed inset-0 z-40 bg-[#000000]/40 transition-opacity duration-200 md:hidden ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />

      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-[#d9d9d9] flex flex-col
          transition-transform duration-200 ease-out
          pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]
          ${open ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
          md:static md:z-auto ${widthClass} md:translate-x-0 md:shadow-none md:pt-0 md:pb-0 md:shrink-0
        `}
        data-theme="light"
      >
        {/* 手機上的關閉鈕 */}
        <button
          onClick={onClose}
          aria-label="關閉寵物選單"
          className="md:hidden absolute top-3 right-3 z-10 w-7 h-7 border border-[#e5e5e5] flex items-center justify-center text-[#8a8a8a] hover:text-[#191919] hover:border-[#191919] transition-colors"
        >
          <X size={14} />
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
    <div className="md:hidden sticky top-0 z-20 bg-white/95 backdrop-blur-xs border-b border-[#d9d9d9] px-3 py-2" data-theme="light">
      <button
        onClick={onOpen}
        aria-label="開啟寵物選單"
        className="w-full flex items-center gap-2.5 px-2 py-1.5 border border-[#e5e5e5] hover:border-[#191919] bg-[#fafafa] text-left transition-colors"
      >
        <Menu size={18} className="text-[#191919] shrink-0" />
        {name ? (
          <>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-bold text-[#191919] truncate">{name}</span>
              {sub && <span className="block text-[10px] font-mono text-[#8a8a8a] truncate">{sub}</span>}
            </span>
            <span className="text-[11px] font-mono text-[#191919] bg-[#fffa00] px-2 py-0.5 border border-[#191919] shrink-0 font-bold">
              切換寵物
            </span>
          </>
        ) : (
          <span className="text-xs font-mono text-[#8a8a8a]">選擇寵物 / SELECT PET</span>
        )}
      </button>
    </div>
  )
}