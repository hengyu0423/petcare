import { useEffect, useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

const NAV_ITEMS = [
  { to: '/dashboard',      icon: '🏠', label: '主頁總覽' },
  { to: '/pets',           icon: '🐶', label: '我的寵物' },
  { to: '/expenses',       icon: '💰', label: '財務管理' },
  { to: '/health-consult', icon: '🏥', label: '健康諮詢' },
  { to: '/diet',           icon: '🍽️', label: '飲食管理' },
  { to: '/weekly-report',  icon: '📋', label: '健康週報' },
  { to: '/pet-cam',        icon: '📹', label: '即時監控' },
]

function Logo({ onClick }) {
  return (
    <NavLink
      to="/dashboard"
      onClick={onClick}
      className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
    >
      <div className="w-8 h-8 rounded-lg bg-green-500 flex items-center justify-center shadow-sm">
        <span className="text-white text-base">🐾</span>
      </div>
      <span className="font-bold text-base text-gray-800">PawCare</span>
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
    `flex items-center gap-2.5 px-3 py-2.5 md:py-2 rounded-lg text-sm font-medium transition-all ${
      isActive
        ? 'bg-green-50 text-green-600'
        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
    }`

  return (
    <div className="flex h-dvh overflow-hidden bg-gray-50">

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
          fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 flex flex-col
          transition-transform duration-200 ease-out
          pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]
          ${open ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
          md:static md:z-auto md:w-56 md:translate-x-0 md:shadow-none md:pt-0 md:pb-0 md:shrink-0
        `}
      >
        {/* Logo 列（手機上另有關閉鈕） */}
        <div className="px-4 py-4 md:py-5 border-b border-gray-100 flex items-center justify-between">
          <Logo onClick={close} />
          <button
            onClick={close}
            aria-label="關閉選單"
            className="md:hidden p-2 -mr-2 rounded-lg text-gray-500 hover:bg-gray-100"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {/* User card */}
        <div className="mx-3 mt-3 bg-gray-50 border border-gray-100 rounded-xl p-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-green-100 to-green-500 flex items-center justify-center text-lg shrink-0">
              👤
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate">{user?.name}</p>
              <p className="text-xs text-gray-400 truncate">{user?.email}</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 mt-4 space-y-0.5 overflow-y-auto">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 mb-2">
            主要功能
          </p>
          {NAV_ITEMS.map(item => (
            <NavLink key={item.to} to={item.to} onClick={close} className={linkCls}>
              <span className="text-base">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-gray-100 p-3">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 md:py-2 rounded-lg text-sm font-medium text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <span className="text-base">🚪</span>
            登出
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">

        {/* 手機頂部列：漢堡鈕 + Logo（電腦版隱藏） */}
        <header className="md:hidden shrink-0 flex items-center gap-2 h-14 px-3 bg-white border-b border-gray-200 pt-[env(safe-area-inset-top)] box-content">
          <button
            onClick={() => setOpen(true)}
            aria-label="開啟選單"
            aria-expanded={open}
            aria-controls="app-sidebar"
            className="p-2 rounded-lg text-gray-700 hover:bg-gray-100 active:bg-gray-200"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <Logo />
        </header>

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>

    </div>
  )
}