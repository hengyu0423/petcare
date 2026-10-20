import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Bell,
  Settings,
  Video,
  VideoOff,
  AlertTriangle,
  ClipboardCheck,
  Utensils,
  CheckCheck
} from 'lucide-react'
import { api } from '../../lib/api'
import NotificationPreferencesModal from './NotificationPreferencesModal'

// ======================================================
// 全站通知鈴鐺 (Endfield UI 工業風格)
// ======================================================

function NotificationTypeIcon({ type }) {
  switch (type) {
    case 'camera_missing':
      return <VideoOff size={15} className="text-[#fc6c00]" />
    case 'camera_reappeared':
      return <Video size={15} className="text-[#007f43]" />
    case 'health_alert':
      return <AlertTriangle size={15} className="text-[#de0909]" />
    case 'weekly_report_ready':
      return <ClipboardCheck size={15} className="text-[#25759f]" />
    case 'feeding_reminder':
      return <Utensils size={15} className="text-[#191919]" />
    default:
      return <Bell size={15} className="text-[#626262]" />
  }
}

const SEVERITY_DOT = {
  emergency: 'bg-[#de0909]',
  urgent: 'bg-[#fc6c00]',
  warning: 'bg-[#fc6c00]',
  info: 'bg-[#25759f]'
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

  // 點擊外面關閉下拉選單
  useEffect(() => {
    const handleClick = e => {
      if (boxRef.current && !boxRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // 監聽來自小助理的設定開啟事件
  useEffect(() => {
    const openPrefs = () => {
      setOpen(false)
      setShowPrefs(true)
    }
    window.addEventListener('paw:open-notification-settings', openPrefs)
    return () => window.removeEventListener('paw:open-notification-settings', openPrefs)
  }, [])

  // SSE 即時推播
  useEffect(() => {
    const token = localStorage.getItem('paw-token')
    if (!token) return

    const source = new EventSource(
      `/api/notifications/stream?token=${encodeURIComponent(token)}`
    )

    source.addEventListener('notification', () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
    })

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

      {/* 鈴鐺觸發按鈕 */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`relative w-8 h-8 border flex items-center justify-center transition-all ${
          open
            ? 'border-[#191919] bg-[#f0f0f0] text-[#191919]'
            : 'border-[#e5e5e5] bg-white text-[#626262] hover:border-[#191919] hover:bg-[#f8f9fa] hover:text-[#191919]'
        }`}
        aria-label="通知中心"
      >
        <Bell size={16} strokeWidth={2} />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 bg-[#de0909] text-white text-[9px] font-mono font-bold flex items-center justify-center border border-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* 下拉面板 (Endfield UI 工業彈窗樣式) */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-[min(22rem,calc(100vw-2rem))] md:left-full md:right-auto md:top-0 md:ml-3 md:w-84 bg-white border border-[#191919] shadow-2xl z-50 max-h-[75vh] flex flex-col font-sans animate-fade-in">

          {/* 頂部標題列 */}
          <div className="flex items-center justify-between px-3.5 py-2.5 bg-[#f8f9fa] border-b border-[#e5e5e5]">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-[#fffa00] border border-[#191919]" />
              <span className="text-xs font-bold font-mono tracking-wider text-[#191919]">
                // NOTIFICATIONS
              </span>
              <span className="text-xs font-bold text-[#191919]">通知中心</span>
            </div>

            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-[11px] font-mono font-semibold text-[#191919] hover:text-[#fffa00] bg-[#191919] hover:bg-black text-white px-2 py-0.5 transition-colors"
                >
                  <CheckCheck size={12} />
                  全部已讀
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  setShowPrefs(true)
                }}
                className="p-1 text-[#626262] hover:text-[#191919] hover:bg-[#e5e5e5] transition-colors"
                title="通知偏好設定"
              >
                <Settings size={14} strokeWidth={2} />
              </button>
            </div>
          </div>

          {/* 內容清單 */}
          <div className="overflow-y-auto flex-1 divide-y divide-[#f0f0f0]">

            {notifications.length === 0 ? (
              <div className="py-12 text-center font-mono space-y-2">
                <Bell size={24} className="mx-auto text-[#b3b3b3]" strokeWidth={1.5} />
                <p className="text-xs text-[#8a8a8a]">
                  // 目前尚無待讀通知 //
                </p>
              </div>
            ) : (
              notifications.map(n => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => !n.isRead && markRead(n.id)}
                  className={`w-full text-left px-3.5 py-3 flex items-start gap-3 transition-colors ${
                    n.isRead
                      ? 'bg-white text-[#626262] hover:bg-[#f8f9fa]'
                      : 'bg-[#fafafa] border-l-3 border-[#fffa00] text-[#191919] hover:bg-[#f0f0f0]'
                  }`}
                >
                  {/* 圖示方塊 */}
                  <div className="w-8 h-8 bg-white border border-[#d9d9d9] flex items-center justify-center shrink-0 mt-0.5">
                    <NotificationTypeIcon type={n.type} />
                  </div>

                  {/* 內文 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            SEVERITY_DOT[n.severity] || 'bg-[#25759f]'
                          }`}
                        />
                        <p className={`text-xs truncate ${n.isRead ? 'font-medium text-[#191919]' : 'font-bold text-[#191919]'}`}>
                          {n.title}
                        </p>
                      </div>

                      <span className="text-[10px] font-mono text-[#8a8a8a] shrink-0">
                        {timeAgo(n.createdAt)}
                      </span>
                    </div>

                    <p className="text-xs text-[#626262] line-clamp-2 leading-relaxed">
                      {n.message}
                    </p>

                    {n.petName && (
                      <p className="text-[10px] font-mono text-[#8a8a8a] mt-1">
                        對象：<span className="text-[#191919] font-medium">{n.petName}</span>
                      </p>
                    )}
                  </div>
                </button>
              ))
            )}

          </div>

          {/* 底部狀態帶 */}
          <div className="bg-[#f8f9fa] border-t border-[#e5e5e5] px-3.5 py-1.5 flex items-center justify-between text-[10px] font-mono text-[#8a8a8a]">
            <span>PAWCARE // NOTIFICATION SERVICE</span>
            <span>AUTO-SYNC</span>
          </div>

        </div>
      )}

      {showPrefs && (
        <NotificationPreferencesModal onClose={() => setShowPrefs(false)} />
      )}

    </div>
  )
}