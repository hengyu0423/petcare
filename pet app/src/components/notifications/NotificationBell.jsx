import { useEffect, useRef, useState } from 'react'
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
// ======================================================

const ICON = {
  camera_missing: '📷',
  camera_reappeared: '🐱',
  health_alert: '🩺',
  weekly_report_ready: '📋',
  feeding_reminder: '🍽️'
}

const SEVERITY_DOT = {
  emergency: 'bg-red-500',
  urgent: 'bg-amber-500',
  warning: 'bg-amber-500',
  info: 'bg-gray-300'
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
  const boxRef = useRef(null)

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications').then(r => r.data.notifications),
    refetchInterval: 60000
  })

  const unreadCount = notifications.filter(n => !n.isRead).length

  // 點外面關閉下拉選單
  useEffect(() => {
    const handleClick = e => {
      if (boxRef.current && !boxRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
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

  return (
    <div className="relative" ref={boxRef}>

      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="relative w-9 h-9 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
        aria-label="通知"
      >
        🔔
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[min(20rem,calc(100vw-2rem))] md:left-full md:right-auto md:top-0 md:ml-2 md:mt-0 md:w-80 bg-white rounded-xl shadow-lg border border-gray-100 z-50 max-h-[70vh] flex flex-col">

          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-bold text-gray-800">通知</p>

            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="text-xs text-green-600 font-semibold hover:underline"
                >
                  全部已讀
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowPrefs(true)}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                ⚙️
              </button>
            </div>
          </div>

          <div className="overflow-y-auto flex-1">

            {notifications.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-10">
                目前沒有通知
              </p>
            )}

            {notifications.map(n => (
              <button
                key={n.id}
                type="button"
                onClick={() => !n.isRead && markRead(n.id)}
                className={`w-full text-left px-4 py-3 border-b border-gray-50 last:border-0 flex gap-2.5 transition-colors ${
                  n.isRead ? 'bg-white' : 'bg-green-50/40 hover:bg-green-50'
                }`}
              >
                <span className="text-lg shrink-0">
                  {ICON[n.type] || '🔔'}
                </span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        SEVERITY_DOT[n.severity] || 'bg-gray-300'
                      }`}
                    />
                    <p className="text-sm font-semibold text-gray-800 truncate">
                      {n.title}
                    </p>
                  </div>

                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                    {n.message}
                  </p>

                  <p className="text-xs text-gray-400 mt-1">
                    {n.petName ? `${n.petName}・` : ''}
                    {timeAgo(n.createdAt)}
                  </p>
                </div>
              </button>
            ))}

          </div>
        </div>
      )}

      {showPrefs && (
        <NotificationPreferencesModal onClose={() => setShowPrefs(false)} />
      )}

    </div>
  )
}