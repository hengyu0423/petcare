import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

export default function Layout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const handleLogout = () => { logout(); navigate('/login') }

  const linkCls = ({ isActive }) =>
    `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
      isActive
        ? 'bg-green-50 text-green-600'
        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
    }`

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col shrink-0">
        {/* Logo */}
        <div className="px-4 py-5 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-green-500 flex items-center justify-center shadow-sm">
              <span className="text-white text-base">🐾</span>
            </div>
            <span className="font-bold text-base text-gray-800">PawCare</span>
          </div>
        </div>

        {/* User pet card */}
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
        <nav className="flex-1 px-3 mt-4 space-y-0.5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 mb-2">主要功能</p>
          <NavLink to="/dashboard" className={linkCls}>
            <span className="text-base">🏠</span> 主頁總覽
          </NavLink>
          <NavLink to="/pets" className={linkCls}>
            <span className="text-base">🐶</span> 我的寵物
          </NavLink>
          <NavLink to="/expenses" className={linkCls}>
            <span className="text-base">💰</span> 財務管理
          </NavLink>
          <NavLink to="/health-consult" className={linkCls}>
            <span className="text-base">🏥</span> 健康諮詢
          </NavLink>
          <NavLink to="/diet" className={linkCls}>
            <span className="text-base">🍽️</span> 飲食管理
          </NavLink>
        </nav>

        {/* Footer */}
        <div className="border-t border-gray-100 p-3">
          <button onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors">
            <span className="text-base">🚪</span> 登出
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}