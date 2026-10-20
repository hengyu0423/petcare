import { useEffect, useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
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
  X as XIcon
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import NotificationBell from '../notifications/NotificationBell'
import AssistantWidget from '../assistant/AssistantWidget'

const NAV_ITEMS = [
  { to: '/dashboard',      icon: LayoutDashboard, label: '主頁總覽', code: '01' },
  { to: '/pets',           icon: PawPrint,        label: '我的寵物', code: '02' },
  { to: '/diet',           icon: Utensils,        label: '飲食管理', code: '03' },
  { to: '/health-consult', icon: HeartPulse,      label: '健康諮詢', code: '04' },
  { to: '/weekly-report',  icon: ClipboardCheck,  label: '健康週報', code: '05' },
  { to: '/pet-cam',        icon: Video,           label: '即時監控', code: '06' },
  { to: '/expenses',       icon: Wallet,          label: '財務管理', code: '07' },
]

function Logo({ onClick }) {
  return (
    <NavLink
      to="/dashboard"
      onClick={onClick}
      className="flex items-center gap-2.5 group"
    >
      {/* Endfield 工業風識別圖示 */}
      <div className="w-8 h-8 bg-[#191919] border border-[#191919] flex items-center justify-center text-[#fffa00] relative overflow-hidden shrink-0 shadow-xs">
        <PawPrint size={18} strokeWidth={2.2} />
        <div className="absolute top-0 right-0 w-2 h-2 bg-[#fffa00]" />
      </div>
      <div className="flex flex-col">
        <span className="font-extrabold text-base tracking-wider text-[#191919] leading-none font-sans">
          PAWCARE
        </span>
        <span className="text-[10px] text-[#8a8a8a] font-mono tracking-widest mt-0.5 leading-none">
          // SMART CARE
        </span>
      </div>
    </NavLink>
  )
}

export default function Layout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false) // 手機側邊欄開關（電腦版無作用）

  const close = () => setOpen(false)

  const handleLogout = () => {
    close()
    logout()
    navigate('/login')
  }

  // 按 Esc 關閉、開啟時鎖住背景捲動
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

  const linkCls = ({ isActive }) =>
    `group relative flex items-center justify-between px-3.5 py-2.5 text-xs font-mono transition-all duration-150 ${
      isActive
        ? 'bg-[#f0f0f0] text-[#191919] font-bold before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-[#fffa00]'
        : 'text-[#626262] hover:bg-[#f8f9fa] hover:text-[#191919]'
    }`

  return (
    <div className="flex h-dvh overflow-hidden bg-[#fafafa]">

      {/* 手機：半透明遮罩，點一下關閉 */}
      <div
        onClick={close}
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 md:hidden ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Sidebar：手機為抽屜（預設收起），電腦為固定側邊欄 */}
      <aside
        id="app-sidebar"
        className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-[#e5e5e5] flex flex-col
          transition-transform duration-200 ease-out
          pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]
          ${open ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
          md:relative md:z-40 md:w-60 md:translate-none md:transform-none md:shadow-none md:pt-0 md:pb-0 md:shrink-0
        `}
      >
        {/* Logo 列：通知鈴鐺 + 手機上另有關閉鈕 */}
        <div className="px-4 py-4 md:py-4.5 border-b border-[#e5e5e5] flex items-center justify-between">
          <Logo onClick={close} />
          <div className="flex items-center gap-1">
            <div className="hidden md:block">
              <NotificationBell />
            </div>
            <button
              onClick={close}
              aria-label="關閉選單"
              className="md:hidden p-1.5 rounded text-[#626262] hover:bg-[#f0f0f0] transition-colors"
            >
              <XIcon size={18} strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* User card (工業風身分識別卡) */}
        <div className="mx-3 mt-3 bg-[#f8f9fa] border border-[#e5e5e5] p-2.5 relative">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-white border border-[#d9d9d9] flex items-center justify-center text-[#191919] font-mono font-bold text-xs shrink-0 shadow-2xs">
              {user?.name ? user.name.slice(0, 1).toUpperCase() : <UserIcon size={14} />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-bold text-[#191919] truncate">{user?.name || '毛孩家長'}</p>
                <span className="w-1.5 h-1.5 bg-[#007f43] rounded-full inline-block shrink-0" title="在線中" />
              </div>
              <p className="text-[10px] text-[#8a8a8a] font-mono truncate">{user?.email || 'pawcare.user'}</p>
            </div>
          </div>
        </div>

        {/* 導航功能列表 */}
        <nav className="flex-1 px-2.5 mt-4 space-y-1 overflow-y-auto">
          <div className="px-2 mb-2 flex items-center justify-between text-[10px] font-mono text-[#8a8a8a] uppercase tracking-wider">
            <span>// NAVIGATION</span>
            <span>MENU</span>
          </div>

          {NAV_ITEMS.map(item => (
            <NavLink key={item.to} to={item.to} onClick={close} className={linkCls}>
              {({ isActive }) => {
                const Icon = item.icon
                return (
                  <>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon
                        size={16}
                        strokeWidth={isActive ? 2.2 : 1.8}
                        className={`shrink-0 transition-colors ${
                          isActive ? 'text-[#191919]' : 'text-[#8a8a8a] group-hover:text-[#191919]'
                        }`}
                      />
                      <span className="font-sans text-xs truncate">{item.label}</span>
                    </div>
                    <span
                      className={`text-[10px] font-mono shrink-0 transition-opacity ${
                        isActive
                          ? 'text-[#191919] opacity-100 font-bold'
                          : 'text-[#b3b3b3] opacity-60 group-hover:opacity-100'
                      }`}
                    >
                      {item.code}
                    </span>
                  </>
                )
              }}
            </NavLink>
          ))}
        </nav>

        {/* Footer 登出區域 */}
        <div className="border-t border-[#e5e5e5] p-3">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-mono text-[#626262] hover:bg-[#fee2e2]/60 hover:text-[#de0909] transition-colors group"
          >
            <div className="flex items-center gap-2">
              <LogOut size={15} strokeWidth={1.8} className="text-[#8a8a8a] group-hover:text-[#de0909] transition-colors" />
              <span>登出系統</span>
            </div>
            <span className="text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">EXIT →</span>
          </button>
        </div>
      </aside>

      {/* Main 主視窗 */}
      <div className="flex-1 min-w-0 flex flex-col bg-[#fafafa]">

        {/* 手機頂部列：漢堡鈕 + Logo + 通知鈴鐺（電腦版隱藏） */}
        <header className="md:hidden relative z-40 shrink-0 flex items-center gap-2 h-14 px-3 bg-white border-b border-[#e5e5e5] pt-[env(safe-area-inset-top)] box-content">
          <button
            onClick={() => setOpen(true)}
            aria-label="開啟選單"
            aria-expanded={open}
            aria-controls="app-sidebar"
            className="p-2 rounded text-[#191919] hover:bg-[#f0f0f0] active:bg-[#e5e5e5] transition-colors"
          >
            <MenuIcon size={20} strokeWidth={2} />
          </button>
          <div className="flex-1">
            <Logo />
          </div>
          <NotificationBell />
        </header>

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>

      {/* 右下角 AI 小助理（健康諮詢頁除外） */}
      <AssistantWidget />

    </div>
  )
}