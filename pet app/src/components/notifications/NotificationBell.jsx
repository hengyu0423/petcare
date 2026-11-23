import PixelIcon from '../brand/PixelIcon'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import NotificationPreferencesModal from './NotificationPreferencesModal'

// ======================================================
// 全站通知鈴鐺
//
// 放在側邊欄，顯示登入使用者「所有寵物」的通知，
// 不管目前在哪一頁都看得到。
//
// 更新方式：
//   - 有新通知時，後端透過 SSE 主動推播（即時）
//   - 額外每 60 秒 polling 一次，當作 SSE 斷線時的備援
//
// 下拉選單透過 React Portal 掛在 document.body，
// 並使用 position:fixed + getBoundingClientRect 計算位置，
// 完全不受父容器 transform / overflow 影響。
// ======================================================

/* 通知類型圖示：與側邊欄同一套線條語言 */
const TYPE_ICON = {
  camera_missing: (
    <>
      <rect x="3" y="8" width="13" height="10" rx="2" />
      <path d="M16 11l5-2.5v9L16 15" />
    </>
  ),
  camera_reappeared: (
    <>
      <ellipse cx="7.6" cy="10" rx="1.9" ry="2.4" />
      <ellipse cx="12" cy="7.6" rx="1.9" ry="2.4" />
      <ellipse cx="16.4" cy="10" rx="1.9" ry="2.4" />
      <ellipse cx="19.4" cy="14" rx="1.8" ry="2.2" />
      <path d="M12.2 12.4c2.6 0 4.8 2 4.8 4.2 0 1.9-1.7 2.9-4.8 2.9s-4.8-1-4.8-2.9c0-2.2 2.2-4.2 4.8-4.2Z" />
    </>
  ),
  health_alert: (
    <>
      <path d="M6 4v6a5 5 0 0 0 10 0V4" />
      <path d="M6 4H4M18 4h-2" />
      <path d="M11 15v2a4 4 0 0 0 8 0v-1" />
      <circle cx="19" cy="13" r="1.6" />
    </>
  ),
  weekly_report_ready: (
    <>
      <rect x="5.5" y="5" width="13" height="16" rx="2" />
      <path d="M9 5V3.8A.8.8 0 0 1 9.8 3h4.4a.8.8 0 0 1 .8.8V5" />
      <path d="M9.5 11h5M9.5 15h3.5" />
    </>
  ),
  feeding_reminder: (
    <>
      <path d="M4 12h16" />
      <path d="M5.5 12a6.5 6.5 0 0 0 13 0" />
      <path d="M10 18.5h4" />
    </>
  ),
  default: (
    <>
      <path d="M18 15.5V11a6 6 0 1 0-12 0v4.5L4.5 18h15L18 15.5Z" />
      <path d="M10 21h4" />
    </>
  )
}

const SEVERITY_DOT = {
  emergency: 'bg-alert',
  urgent: 'bg-amber',
  warning: 'bg-amber',
  info: 'bg-line'
}

function TypeIcon({ type, size = 16 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {TYPE_ICON[type] || TYPE_ICON.default}
    </svg>
  )
}

function BellIcon({ size = 19 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 15.5V11a6 6 0 1 0-12 0v4.5L4.5 18h15L18 15.5Z" />
      <path d="M10 21h4" />
    </svg>
  )
}

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diffMs / 60000)

  if (min < 1) return '剛剛'
  if (min < 60) return `${min} 分鐘前`

  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} 小時前`

  return `${Math.floor(hr / 24)} 天前`
}

export default function NotificationBell() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [showPrefs, setShowPrefs] = useState(false)
  const btnRef = useRef(null)
  const dropRef = useRef(null)

  // 下拉選單的 fixed 座標（對齊鈴鐺按鈕）
  const [dropPos, setDropPos] = useState({ top: 0, left: 0 })

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications').then(r => r.data.notifications),
    refetchInterval: 60000
  })

  const unreadCount = notifications.filter(n => !n.isRead).length

  // 每次展開時重算位置
  const calcPos = () => {
    if (!btnRef.current) return
    const rect = btnRef.current.getBoundingClientRect()
    setDropPos({ top: rect.bottom + 8, left: rect.right })
  }

  useEffect(() => {
    if (open) calcPos()
  }, [open])

  useEffect(() => {
    if (!open) return
    window.addEventListener('resize', calcPos)
    return () => window.removeEventListener('resize', calcPos)
  }, [open])

  // 點外面關閉下拉選單
  useEffect(() => {
    const handleClick = e => {
      if (
        btnRef.current && !btnRef.current.contains(e.target) &&
        dropRef.current && !dropRef.current.contains(e.target)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // 小助理回覆裡的「通知」連結：直接打開通知偏好設定
  useEffect(() => {
    const openPrefs = () => {
      setOpen(false)
      setShowPrefs(true)
    }
    window.addEventListener('paw:open-notification-settings', openPrefs)
    return () => window.removeEventListener('paw:open-notification-settings', openPrefs)
  }, [])

  // SSE：有新通知就即時更新，不用等下一次 polling
  useEffect(() => {
    const token = localStorage.getItem('paw-token')
    if (!token) return

    const source = new EventSource(
      `/api/notifications/stream?token=${encodeURIComponent(token)}`
    )

    source.addEventListener('notification', () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
    })

    // 連線失敗（例如伺服器重啟）時，讓瀏覽器自動重連，
    // 不特別處理，之後的 60 秒 polling 仍會保底同步狀態
    source.onerror = () => {}

    return () => source.close()
  }, [qc])

  const markRead = async id => {
    await api.patch(`/notifications/${id}/read`)
    qc.invalidateQueries({ queryKey: ['notifications'] })
  }

  const markAllRead = async () => {
    await api.patch('/notifications/read-all')
    qc.invalidateQueries({ queryKey: ['notifications'] })
  }

  // 下拉寬 320px，右邊對齊按鈕右邊，向左展開；確保不超出視窗左緣
  const DROP_W = 320
  const safeLeft = Math.max(8, dropPos.left - DROP_W)

  const dropdown = open && createPortal(
    <div
      ref={dropRef}
      style={{
        position: 'fixed',
        top: dropPos.top,
        left: safeLeft,
        width: DROP_W,
        zIndex: 9999
      }}
      className="flex max-h-[70vh] flex-col rounded-3xl border border-hair bg-plate shadow-[0_24px_48px_-24px_rgba(87,54,17,0.45)]"
    >
      <div className="flex items-center justify-between border-b border-hair px-4 py-3">
        <p className="text-sm font-bold text-pine-900">通知</p>

        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="text-xs font-semibold text-pine-700 hover:underline"
            >
              全部已讀
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setOpen(false)
              setShowPrefs(true)
            }}
            className="rounded-lg p-1 text-ink-soft transition-colors hover:bg-warm hover:text-pine-900"
            title="通知設定"
            aria-label="通知設定"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3.2" />
              <path d="M19.4 14a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 14a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.55-1.1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9v.1a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">

        {notifications.length === 0 && (
          <div className="py-10 text-center">
            <PixelIcon name="bell" size={40} className="mx-auto" />
            <p className="mt-2 text-sm text-ink-soft">目前沒有通知</p>
          </div>
        )}

        {notifications.map(n => (
          <button
            key={n.id}
            type="button"
            onClick={() => !n.isRead && markRead(n.id)}
            className={`flex w-full gap-2.5 border-b border-paper px-4 py-3 text-left transition-colors last:border-0 ${
              n.isRead ? 'bg-plate' : 'bg-warm hover:bg-honey-100'
            }`}
          >
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-warm text-honey-deep">
              <TypeIcon type={n.type} />
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    SEVERITY_DOT[n.severity] || 'bg-line'
                  }`}
                />
                <p className="truncate text-sm font-semibold text-pine-900">
                  {n.title}
                </p>
              </div>

              <p className="mt-0.5 line-clamp-2 text-xs text-ink-soft">
                {n.message}
              </p>

              <p className="mt-1 text-[11px] text-ink-soft/75">
                {n.petName ? `${n.petName}・` : ''}
                {timeAgo(n.createdAt)}
              </p>
            </div>
          </button>
        ))}

      </div>
    </div>,
    document.body
  )

  return (
    <div className="relative" ref={btnRef}>

      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl text-ink-soft transition-colors hover:bg-warm hover:text-pine-900"
        aria-label="通知"
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber px-1 text-[10px] font-extrabold text-amber-ink">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {dropdown}

      {showPrefs && (
        <NotificationPreferencesModal onClose={() => setShowPrefs(false)} />
      )}

    </div>
  )
}
