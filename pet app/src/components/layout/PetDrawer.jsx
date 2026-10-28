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
          fixed inset-y-0 left-0 z-50 w-64 bg-[var(--ef-panel)] border-r border-[var(--ef-rule)] flex flex-col
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
          className="md:hidden absolute top-3 right-3 z-10 w-7 h-7 border border-[var(--ef-rule)] flex items-center justify-center text-[var(--ef-ink-2)] hover:text-[var(--ef-ink)] hover:border-[var(--ef-ink)] transition-colors"
          style={{
            clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0 100%)'
          }}
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
    <div className="md:hidden sticky top-0 z-20 bg-[var(--ef-panel)]/95 backdrop-blur-xs border-b border-[var(--ef-rule)] px-3 py-2">
      <button
        onClick={onOpen}
        aria-label="開啟寵物選單"
        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 border border-[var(--ef-rule)] hover:border-[var(--ef-ink)] bg-[var(--ef-paper)] text-left transition-colors"
        style={{
          clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%)'
        }}
      >
        <Menu size={16} className="text-[var(--ef-ink)] shrink-0" />
        {name ? (
          <>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-bold text-[var(--ef-ink)] truncate">{name}</span>
              {sub && <span className="block text-[10px] font-mono text-[var(--ef-ink-2)] truncate">{sub}</span>}
            </span>
            <span className="text-[10px] font-mono text-[var(--ef-on-signal)] bg-[var(--ef-signal)] px-2 py-0.5 border border-[var(--ef-ink)] shrink-0 font-bold">
              切換寵物
            </span>
          </>
        ) : (
          <span className="text-xs font-mono text-[var(--ef-ink-2)]">選擇寵物 / SELECT PET</span>
        )}
      </button>
    </div>
  )
}