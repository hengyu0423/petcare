import { useEffect, useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import NotificationBell from '../notifications/NotificationBell'
import AssistantWidget from '../assistant/AssistantWidget'
import MascotCat from '../brand/MascotCat'

/* 自繪單色描邊圖示（stroke = currentColor），與首頁同一套線條語言 */
const Icon = {
  home: (
    <>
      <path d="M4.5 10.5 12 4l7.5 6.5" />
      <path d="M6.5 9.5V19a1 1 0 0 0 1 1H10v-4.5h4V20h2.5a1 1 0 0 0 1-1V9.5" />
    </>
  ),
  paw: (
    <>
      <ellipse cx="7.6" cy="10" rx="1.9" ry="2.4" />
      <ellipse cx="12" cy="7.6" rx="1.9" ry="2.4" />
      <ellipse cx="16.4" cy="10" rx="1.9" ry="2.4" />
      <ellipse cx="19.4" cy="14" rx="1.8" ry="2.2" />
      <path d="M12.2 12.4c2.6 0 4.8 2 4.8 4.2 0 1.9-1.7 2.9-4.8 2.9s-4.8-1-4.8-2.9c0-2.2 2.2-4.2 4.8-4.2Z" />
    </>
  ),
  bowl: (
    <>
      <path d="M4 12h16" />
      <path d="M5.5 12a6.5 6.5 0 0 0 13 0" />
      <path d="M10 18.5h4" />
    </>
  ),
  stethoscope: (
    <>
      <path d="M6 4v6a5 5 0 0 0 10 0V4" />
      <path d="M6 4H4M18 4h-2" />
      <path d="M11 15v2a4 4 0 0 0 8 0v-1" />
      <circle cx="19" cy="13" r="1.6" />
    </>
  ),
  clipboard: (
    <>
      <rect x="5.5" y="5" width="13" height="16" rx="2" />
      <path d="M9 5V3.8A.8.8 0 0 1 9.8 3h4.4a.8.8 0 0 1 .8.8V5" />
      <path d="M9.5 11h5M9.5 15h3.5" />
    </>
  ),
  camera: (
    <>
      <rect x="3" y="8" width="13" height="10" rx="2" />
      <path d="M16 11l5-2.5v9L16 15" />
    </>
  ),
  wallet: (
    <>
      <rect x="3.5" y="7" width="17" height="11.5" rx="2" />
      <path d="M15.5 12.75h.01" />
      <path d="M3.5 10h17" />
    </>
  ),
  logout: (
    <>
      <path d="M15 5.5H6.5A1.5 1.5 0 0 0 5 7v10a1.5 1.5 0 0 0 1.5 1.5H15" />
      <path d="M13 12h7M17 8.5 20.5 12 17 15.5" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6L6 18" />,
  menu: <path d="M4 6.5h16M4 12h16M4 17.5h16" />
}

function SvgIcon({ children, size = 19, strokeWidth = 1.7 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      {children}
    </svg>
  )
}

const NAV_ITEMS = [
  { to: '/dashboard',      icon: Icon.home,        label: '主頁總覽' },
  { to: '/pets',           icon: Icon.paw,         label: '我的寵物' },
  { to: '/diet',           icon: Icon.bowl,        label: '飲食管理' },
  { to: '/health-consult', icon: Icon.stethoscope, label: '健康諮詢' },
  { to: '/weekly-report',  icon: Icon.clipboard,   label: '健康週報' },
  { to: '/pet-cam',        icon: Icon.camera,      label: '即時監控' },
  { to: '/expenses',       icon: Icon.wallet,      label: '財務管理' }
]

function Logo({ onClick }) {
  return (
    <NavLink
      to="/dashboard"
      onClick={onClick}
      className="flex items-center gap-2.5 rounded-2xl transition-opacity hover:opacity-85"
    >
      <MascotCat size={38} className="h-9 w-9 shrink-0" />
      <span className="min-w-0">
        <span className="font-brand block text-[17px] font-extrabold leading-none text-pine-900">
          PawCare
        </span>
        <span className="mt-1 block text-[10px] font-medium leading-none text-ink-soft">
          毛孩的日常照護
        </span>
      </span>
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
    `group flex items-center gap-2.5 rounded-2xl px-3 py-2.5 text-sm font-semibold transition-colors ${
      isActive
        ? 'bg-pine-800 text-warm shadow-[0_10px_20px_-14px_rgba(24,48,31,0.9)]'
        : 'text-ink-soft hover:bg-warm hover:text-pine-900'
    }`

  const initial = (user?.name || user?.email || '?').trim().charAt(0).toUpperCase()

  return (
    <div className="flex h-dvh overflow-hidden bg-paper">

      {/* 手機：半透明遮罩，點一下關閉 */}
      <div
        onClick={close}
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-pine-900/35 transition-opacity duration-200 md:hidden ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Sidebar：手機為抽屜（預設收起），電腦為固定側邊欄 */}
      <aside
        id="app-sidebar"
        className={`
          fixed inset-y-0 left-0 z-50 flex w-[16.5rem] flex-col border-r border-sand bg-plate
          transition-transform duration-200 ease-out
          pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]
          ${open ? 'translate-x-0 shadow-[0_30px_60px_-30px_rgba(87,54,17,0.55)]' : '-translate-x-full'}
          md:static md:z-auto md:w-56 md:translate-x-0 md:shadow-none md:pt-0 md:pb-0 md:shrink-0
        `}
      >
        {/* Logo 列：通知鈴鐺 + 手機上另有關閉鈕 */}
        <div className="flex items-center justify-between gap-2 px-4 py-4 md:py-5">
          <Logo onClick={close} />
          <div className="flex items-center gap-1">
            <div className="hidden md:block">
              <NotificationBell />
            </div>
            <button
              onClick={close}
              aria-label="關閉選單"
              className="rounded-xl p-2 -mr-2 text-ink-soft transition-colors hover:bg-warm hover:text-pine-900 md:hidden"
            >
              <SvgIcon size={18} strokeWidth={2}>{Icon.close}</SvgIcon>
            </button>
          </div>
        </div>

        {/* 使用者卡片 */}
        <div className="mx-3 rounded-2xl border border-hair bg-warm p-3 shadow-card">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-pine-800 text-[13px] font-extrabold text-warm">
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold text-pine-900">{user?.name}</p>
              <p className="truncate text-[11px] text-ink-soft">{user?.email}</p>
            </div>
          </div>
        </div>

        {/* 導覽 */}
        <nav className="mt-4 flex-1 space-y-0.5 overflow-y-auto px-3 pb-2">
          <p className="kicker mb-2 px-2 text-[10px]! text-ink-soft/70!">主要功能</p>
          {NAV_ITEMS.map(item => (
            <NavLink key={item.to} to={item.to} onClick={close} className={linkCls}>
              {({ isActive }) => (
                <>
                  <SvgIcon>{item.icon}</SvgIcon>
                  <span className="flex-1">{item.label}</span>
                  {isActive && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-honey shadow-[0_0_0_3px_rgba(245,192,74,0.28)]" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* 登出 */}
        <div className="border-t border-hair p-3">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2.5 rounded-2xl px-3 py-2.5 text-sm font-semibold text-clay transition-colors hover:bg-clay-50 hover:text-clay-700"
          >
            <SvgIcon>{Icon.logout}</SvgIcon>
            登出
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">

        {/* 手機頂部列：漢堡鈕 + Logo + 通知鈴鐺（電腦版隱藏） */}
        <header className="box-content flex h-14 shrink-0 items-center gap-2 border-b border-sand bg-plate px-3 pt-[env(safe-area-inset-top)] md:hidden">
          <button
            onClick={() => setOpen(true)}
            aria-label="開啟選單"
            aria-expanded={open}
            aria-controls="app-sidebar"
            className="rounded-xl p-2 text-pine-900 transition-colors hover:bg-warm active:bg-warm-deep"
          >
            <SvgIcon size={22} strokeWidth={2}>{Icon.menu}</SvgIcon>
          </button>
          <div className="flex-1">
            <Logo />
          </div>
          <NotificationBell />
        </header>

        <main className="legacy-skin paw-soft-dots flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>

      {/* 右下角 AI 小助理（健康諮詢頁除外） */}
      <AssistantWidget />

    </div>
  )
}
