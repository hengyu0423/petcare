import { useEffect, useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  PawPrint,
  Utensils,
  HeartPulse,
  ClipboardCheck,
  Video,
  Wallet,
  LogOut,
  User as UserIcon,
  Menu as MenuIcon,
  X as XIcon,
  Sun,
  Moon,
  ChevronRight
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import NotificationBell from '../notifications/NotificationBell'
import AssistantWidget from '../assistant/AssistantWidget'

const THEME_KEY = 'pawcare-home-theme'

const NAV_ITEMS = [
  { to: '/dashboard',      icon: LayoutDashboard, label: '主頁總覽', code: '01', latin: 'OVERVIEW' },
  { to: '/pets',           icon: PawPrint,        label: '我的寵物', code: '02', latin: 'ROSTER' },
  { to: '/diet',           icon: Utensils,        label: '飲食管理', code: '03', latin: 'DIET' },
  { to: '/health-consult', icon: HeartPulse,      label: '健康諮詢', code: '04', latin: 'HEALTH' },
  { to: '/weekly-report',  icon: ClipboardCheck,  label: '健康週報', code: '05', latin: 'REPORT' },
  { to: '/pet-cam',        icon: Video,           label: '即時監控', code: '06', latin: 'CAMERA' },
  { to: '/expenses',       icon: Wallet,          label: '財務管理', code: '07', latin: 'SPEND' },
]

function BrandLogo({ onClick }) {
  return (
    <NavLink
      to="/dashboard"
      onClick={onClick}
      className="flex items-center gap-3 group focus:outline-none"
    >
      {/* Endfield 墨底方塊 + 唯一螢光亮角 */}
      <div
        className="w-8 h-8 bg-[var(--ef-ink)] border border-[var(--ef-ink)] flex items-center justify-center text-[var(--ef-panel)] relative shrink-0 transition-transform duration-100 group-hover:scale-105"
        style={{
          clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%)'
        }}
      >
        <span className="font-mono font-black text-sm tracking-tighter text-[var(--ef-signal)]">P</span>
        <div className="absolute top-0 right-0 w-1.5 h-1.5 bg-[var(--ef-signal)]" />
      </div>
      <div className="flex flex-col">
        <div className="flex items-center gap-1.5 leading-none">
          <span className="font-mono font-black text-sm tracking-wider text-[var(--ef-ink)] uppercase">
            PAWCARE
          </span>
          <span className="text-[9px] font-mono font-bold px-1 py-0.2 bg-[var(--ef-chip)] text-[var(--ef-ink-2)]">
            v2.4
          </span>
        </div>
        <span className="text-[9px] text-[var(--ef-ink-2)] font-mono tracking-widest mt-1 leading-none uppercase">
          // SMART PET SYSTEM
        </span>
      </div>
    </NavLink>
  )
}

export default function Layout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)

  // 全域主題狀態同步
  const [dark, setDark] = useState(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY)
      if (saved) return saved === 'dark'
    } catch { /* 忽略 */ }
    return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-theme', dark ? 'dark' : 'light')
  }, [dark])

  const toggleTheme = () => {
    setDark(d => {
      const next = !d
      try { localStorage.setItem(THEME_KEY, next ? 'dark' : 'light') } catch { /* 忽略 */ }
      return next
    })
  }

  const close = () => setOpen(false)

  const handleLogout = () => {
    close()
    logout()
    navigate('/login')
  }

  // 按 Esc 關閉抽屜
  useEffect(() => {
    if (!open) return
    const onKey = e => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open])

  // 當路徑改變時關閉手機抽屜
  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  return (
    <div className="ef flex flex-col h-dvh overflow-hidden bg-[var(--ef-paper)] text-[var(--ef-ink)]">
      {/* 終末地標誌性三色條：品紅 / 螢光黃 / 薄荷綠 */}
      <div className="ef-tri shrink-0" aria-hidden="true"><i></i><i></i><i></i></div>

      <div className="flex-1 flex overflow-hidden relative">

        {/* 手機遮罩 */}
        <div
          onClick={close}
          aria-hidden="true"
          className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-xs transition-opacity duration-200 md:hidden ${
            open ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        />

        {/* 側邊導航欄 (Endfield UI 工業操作台樣式) */}
        <aside
          id="app-sidebar"
          className={`
            fixed inset-y-0 left-0 z-50 w-64 bg-[var(--ef-panel)] border-r border-[var(--ef-rule)] flex flex-col
            transition-transform duration-200 ease-out select-none
            pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]
            ${open ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
            md:relative md:z-30 md:w-60 md:translate-none md:shadow-none md:pt-0 md:pb-0 md:shrink-0
          `}
        >
          {/* Logo 頂欄 */}
          <div className="px-4 py-3.5 border-b border-[var(--ef-rule)] flex items-center justify-between bg-[var(--ef-panel)] shrink-0">
            <BrandLogo onClick={close} />
            <div className="flex items-center gap-1.5 md:hidden">
              <button
                type="button"
                onClick={close}
                aria-label="關閉選單"
                className="w-7 h-7 flex items-center justify-center border border-[var(--ef-rule)] hover:border-[var(--ef-ink)] text-[var(--ef-ink-2)] hover:text-[var(--ef-ink)] transition-colors"
                style={{
                  clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0 100%)'
                }}
              >
                <XIcon size={14} strokeWidth={2.5} />
              </button>
            </div>
          </div>

          {/* 照護者身分識別牌 (Industrial Operator Badge) */}
          <div className="p-3 border-b border-[var(--ef-rule)] bg-[var(--ef-paper)]/50 shrink-0">
            <div className="flex items-center justify-between text-[9px] font-mono text-[var(--ef-ink-2)] uppercase tracking-wider mb-1.5">
              <span>// OPERATOR</span>
              <span className="flex items-center gap-1 text-[10px] text-[var(--ef-ink)] font-bold">
                <span className="w-1.5 h-1.5 bg-[var(--ef-signal)] border border-[var(--ef-ink)] inline-block" />
                ACTIVE
              </span>
            </div>
            <div className="flex items-center gap-2.5 p-2 bg-[var(--ef-panel)] border border-[var(--ef-rule)] relative overflow-hidden">
              <div
                className="w-8 h-8 bg-[var(--ef-ink)] text-[var(--ef-panel)] font-mono font-bold text-xs flex items-center justify-center shrink-0"
                style={{
                  clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%)'
                }}
              >
                {user?.name ? user.name.slice(0, 1).toUpperCase() : <UserIcon size={14} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-[var(--ef-ink)] truncate font-sans">
                  {user?.name || '毛孩家長'}
                </p>
                <p className="text-[10px] text-[var(--ef-ink-2)] font-mono truncate">
                  {user?.email || 'pawcare.user'}
                </p>
              </div>
            </div>
          </div>

          {/* 主導航項目列表 */}
          <nav className="flex-1 px-2.5 py-3 space-y-1.5 overflow-y-auto" aria-label="系統導航選單">
            <div className="px-2 pb-1.5 flex items-center justify-between text-[10px] font-mono text-[var(--ef-ink-2)] uppercase tracking-widest border-b border-[var(--ef-rule)]/60 mb-2">
              <span>// NAVIGATION</span>
              <span>INDEX</span>
            </div>

            {NAV_ITEMS.map(item => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={close}
                  className={({ isActive }) =>
                    `group relative flex items-center justify-between px-3 py-2 text-xs transition-all duration-100 ${
                      isActive
                        ? 'bg-[var(--ef-signal)] text-[var(--ef-on-signal)] font-bold shadow-xs'
                        : 'text-[var(--ef-ink-2)] hover:bg-[var(--ef-chip)] hover:text-[var(--ef-ink)]'
                    }`
                  }
                  style={({ isActive }) => ({
                    clipPath: isActive
                      ? 'polygon(0 0, 100% 0, 100% calc(100% - 7px), calc(100% - 7px) 100%, 0 100%)'
                      : 'none'
                  })}
                >
                  {({ isActive }) => (
                    <>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon
                          size={16}
                          strokeWidth={isActive ? 2.4 : 1.8}
                          className={`shrink-0 transition-colors ${
                            isActive ? 'text-[var(--ef-on-signal)]' : 'text-[var(--ef-ink-2)] group-hover:text-[var(--ef-ink)]'
                          }`}
                        />
                        <div className="flex flex-col leading-tight min-w-0">
                          <span className={`text-[9px] font-mono uppercase tracking-widest leading-none ${
                            isActive ? 'text-[var(--ef-on-signal)]/80' : 'text-[var(--ef-ink-2)]/70'
                          }`}>
                            // {item.latin}
                          </span>
                          <span className="font-bold text-xs truncate mt-0.5">
                            {item.label}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 font-mono text-[10px]">
                        <span
                          className={`px-1 py-0.2 ${
                            isActive
                              ? 'bg-[var(--ef-on-signal)] text-[var(--ef-signal)] font-bold'
                              : 'text-[var(--ef-ink-2)] group-hover:text-[var(--ef-ink)] opacity-70 group-hover:opacity-100'
                          }`}
                        >
                          {item.code}
                        </span>
                        {isActive && <ChevronRight size={12} strokeWidth={2.5} className="text-[var(--ef-on-signal)]" />}
                      </div>
                    </>
                  )}
                </NavLink>
              )
            })}
          </nav>

          {/* 側邊欄底部控制區 */}
          <div className="p-3 border-t border-[var(--ef-rule)] bg-[var(--ef-panel)] space-y-2 shrink-0">
            {/* 深淺主題切換與系統通知 */}
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={toggleTheme}
                className="flex-1 ef-btn small flex items-center justify-center gap-1.5 text-xs font-mono"
                aria-label="切換主題"
              >
                {dark ? <Sun size={13} strokeWidth={2} /> : <Moon size={13} strokeWidth={2} />}
                <span>{dark ? 'LIGHT // 淺色' : 'DARK // 深色'}</span>
              </button>

              <div className="shrink-0">
                <NotificationBell />
              </div>
            </div>

            {/* 登出系統（紅色危險操作） */}
            <button
              type="button"
              onClick={handleLogout}
              className="w-full ef-btn small danger flex items-center justify-between text-xs font-mono group"
            >
              <div className="flex items-center gap-2">
                <LogOut size={13} strokeWidth={2} className="text-[var(--ef-danger)]" />
                <span>EXIT // 登出系統</span>
              </div>
              <span className="text-[9px] opacity-70 group-hover:opacity-100 font-mono">SYS.QUIT</span>
            </button>

            <div className="pt-1 text-center">
              <span className="text-[9px] font-mono text-[var(--ef-ink-2)]/60 uppercase tracking-widest">
                PAWCARE PROTOCOL · 2026
              </span>
            </div>
          </div>
        </aside>

        {/* 主內容區塊 */}
        <div className="flex-1 min-w-0 flex flex-col bg-[var(--ef-paper)] overflow-hidden">
          
          {/* 手機頂部列 (Mobile Command Bar) */}
          <header className="md:hidden shrink-0 flex items-center justify-between h-13 px-3 bg-[var(--ef-panel)] border-b border-[var(--ef-rule)]">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setOpen(true)}
                aria-label="開啟功能選單"
                aria-expanded={open}
                className="w-8 h-8 flex items-center justify-center border border-[var(--ef-rule)] hover:border-[var(--ef-ink)] bg-[var(--ef-paper)] text-[var(--ef-ink)] transition-colors"
                style={{
                  clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%)'
                }}
              >
                <MenuIcon size={18} strokeWidth={2} />
              </button>
              <BrandLogo />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleTheme}
                aria-label="切換主題"
                className="w-8 h-8 flex items-center justify-center border border-[var(--ef-rule)] hover:border-[var(--ef-ink)] bg-[var(--ef-paper)] text-[var(--ef-ink)] transition-colors"
                style={{
                  clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%)'
                }}
              >
                {dark ? <Sun size={15} strokeWidth={2} /> : <Moon size={15} strokeWidth={2} />}
              </button>
              <NotificationBell />
            </div>
          </header>

          {/* 視窗主內容滾動區 */}
          <main className="flex-1 overflow-y-auto">
            <Outlet />
          </main>
        </div>

      </div>

      {/* AI 智慧小助理懸浮組件 */}
      <AssistantWidget />
    </div>
  )
}