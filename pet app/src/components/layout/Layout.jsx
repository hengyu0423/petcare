import { useRef } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import '@fontsource-variable/saira/standard.css'
import '@fontsource-variable/noto-sans-sc/wght.css'
import '../../styles/endfield/endfield.css'
import './layout.css'
import { useAuthStore } from '../../store/authStore'
import { useEfVariant } from '../../lib/useEfVariant'
import NotificationBell from '../notifications/NotificationBell'
import AssistantWidget from '../assistant/AssistantWidget'

// zh/en：桌面指令列與手機底部標籤用的短名稱；full：「更多」面板裡的完整名稱；code：編號標籤
const NAV_ITEMS = [
  { to: '/dashboard', zh: '總覽', en: 'Overview', full: '主頁總覽', code: '01' },
  { to: '/pets', zh: '寵物', en: 'Pets', full: '我的寵物', code: '02' },
  { to: '/diet', zh: '飲食', en: 'Diet', full: '飲食管理', code: '03' },
  { to: '/health-consult', zh: '健康', en: 'Health', full: '健康諮詢', code: '04' },
  { to: '/weekly-report', zh: '週報', en: 'Report', full: '健康週報', code: '05' },
  { to: '/pet-cam', zh: '監控', en: 'Camera', full: '即時監控', code: '06' },
  { to: '/expenses', zh: '財務', en: 'Spend', full: '財務管理', code: '07' }
]

// 手機底部標籤放前四個，其餘收進「更多」
const TAB_ITEMS = NAV_ITEMS.slice(0, 4)
const MORE_ITEMS = NAV_ITEMS.slice(4)

export default function Layout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const moreRef = useRef(null)

  useEfVariant()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const moreActive = MORE_ITEMS.some(i => pathname === i.to || pathname.startsWith(`${i.to}/`))
  const openMore = () => moreRef.current?.showModal()
  const closeMore = () => moreRef.current?.close()
  const initial = (user?.name || 'P').trim().charAt(0).toUpperCase()

  return (
    <div className="ef ef-contours pc-shell">
      <a className="pc-skip" href="#main">跳到主要內容</a>

      <div className="ef-tri" aria-hidden="true"><i></i><i></i><i></i></div>

      <header className="ef-cmdbar">
        <NavLink className="brand" to="/dashboard">
          <span className="seal" aria-hidden="true">P</span>PAWCARE
        </NavLink>

        {/* 桌面：七個分區都在指令列上 */}
        <nav className="pc-nav" aria-label="主要導覽">
          {NAV_ITEMS.map(item => (
            <NavLink key={item.to} to={item.to}>
              {item.zh}<small>{item.en}</small>
            </NavLink>
          ))}
        </nav>

        <div className="util">
          <NotificationBell placement="bar" />
          <span className="pc-user" title={user?.email || undefined}>
            <span className="pc-avatar" aria-hidden="true">{initial}</span>
            <span className="pc-uname">{user?.name || '使用者'}</span>
          </span>
          <button className="ef-btn small pc-logout" type="button" onClick={handleLogout}>登出</button>
        </div>
      </header>

      <main className="pc-area" id="main" tabIndex={-1}>
        <Outlet />
      </main>

      {/* 手機與平板：底部標籤列（前四個分區 + 更多） */}
      <nav className="ef-tabbar pc-tabbar" aria-label="主要導覽">
        {TAB_ITEMS.map(item => (
          <NavLink key={item.to} to={item.to}>
            <small>{item.en}</small>{item.zh}
          </NavLink>
        ))}
        <button
          type="button"
          onClick={openMore}
          aria-haspopup="dialog"
          aria-current={moreActive ? 'page' : undefined}
        >
          <small>More</small>更多
        </button>
      </nav>

      <dialog
        className="ef-drawer"
        ref={moreRef}
        aria-labelledby="more-title"
        onClick={e => { if (e.target === e.currentTarget) closeMore() }}
      >
        <div className="body">
          <div className="grab" aria-hidden="true"></div>
          <header className="ef-pair" id="more-title">
            <span className="ef-eyebrow slash">More</span><span>更多功能</span>
          </header>

          {MORE_ITEMS.map(item => (
            <NavLink key={item.to} to={item.to} className="ef-act" onClick={closeMore}>
              <span>{item.full}</span><span className="ef-field">No.{item.code}</span>
            </NavLink>
          ))}

          <div className="ef-act pc-account">
            <span>{user?.name || '使用者'}</span>
            <span className="ef-field">{user?.email || ''}</span>
          </div>
          <button className="ef-act" type="button" onClick={() => { closeMore(); handleLogout() }}>
            <span>登出</span>
          </button>
        </div>
      </dialog>

      <AssistantWidget />
    </div>
  )
}