import PixelIcon from '../brand/PixelIcon'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import NotificationPreferencesModal from './NotificationPreferencesModal'

// ======================================================
// 全站通知鈴鐺
//
// 放在側邊欄，顯示登入使用者「所有寵物」的通知，
// 不管目前在哪一頁都看得到。
//
// 列表分成兩區，避免相機動態把真正要看的事淹沒：
//   1. 重要提醒：健康提醒、週報、餵食提醒
//      → 不會自己消失（不会被後端自動刪除），要刪就按單筆的 ✕
//   2. 相機動態：「好久沒看到寵物」「又出現了」這種偵測記錄
//      → 預設摺疊成一行；後端只保留 30 天，也可以按「清除全部」立刻清掉
//
// 鈴鐺上的紅點數字只算「重要提醒」的未讀，
// 相機動態再多也不會把紅點數字灌大。
//
// 點一則通知會順帶跳到對應的頁面（目標見 TARGET_PATH）：
//   相機動態 → /pet-cam 即時監控
//   健康提醒、餵食提醒 → /diet 飲食管理
//   週報 → /weekly-report
// 同時會把通知標成已讀；右邊的 ✕ 才是刪除該則通知。
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

// 後端的保留策略：只有相機動態會到期（30 天），健康/週報/餵食提醒永久保留。
// 這裡只用來決定「歸哪一區」與鈴鐺紅點要不要算它。
const CAMERA_RETENTION_DAYS = 30

// 後端列表只回傳最新 30 則相機動態（更舊的仍在資料庫，到期會自動清）
const CAMERA_LIST_LIMIT = 30

// 點一則通知要去哪里：看到提醒就能直接到那件事的畫面處理，
// 不用再自己從選單去找頁面。
const TARGET_PATH = {
  camera_missing: '/pet-cam',        // 即時監控
  camera_reappeared: '/pet-cam',
  health_alert: '/diet',            // 飲食管理（頁面上有健康事件與飲食注意事項）
  feeding_reminder: '/diet',
  weekly_report_ready: '/weekly-report'
}

function targetPath(n) {
  const base = TARGET_PATH[n.type] || '/dashboard'
  const params = new URLSearchParams()

  // 帶上 petId：多隻寵物時打開的是通知那隻寵物的畫面，不是預設的第一隻
  if (n.petId) params.set('petId', n.petId)

  // 相機類帶上 cameraId：以後有第二台相機也能對到正確的畫面
  if (isCameraNotification(n) && n.metadata?.cameraId) {
    params.set('camera', n.metadata.cameraId)
  }

  const query = params.toString()
  return query ? `${base}?${query}` : base
}

function isCameraNotification(n) {
  return String(n?.type || '').startsWith('camera_')
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

// 單筆通知。外層用 div、內容才是 button，✕ 才能当成同排的兄弟節點
// （button 裡面包 button 不是合法的 HTML，點擊也會互相干擾）。
// 點內容 = 標已讀並跳到對應頁面；點 ✕ = 刪除。
function NotificationRow({ notification, onOpen, onDelete }) {
  const n = notification

  return (
    <div
      className={`flex items-start gap-1 border-b border-paper px-4 py-3 last:border-0 ${
        n.isRead ? 'bg-plate' : 'bg-warm'
      }`}
    >
      <button
        type="button"
        onClick={() => onOpen(n)}
        className="flex min-w-0 flex-1 gap-2.5 text-left"
        title="打開對應頁面"
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

          <div className="mt-1 flex items-center gap-2">
            <p className="text-[11px] text-ink-soft/75">
              {n.petName ? `${n.petName}・` : ''}
              {timeAgo(n.createdAt)}
            </p>

            <span className="ml-auto shrink-0 text-[11px] font-semibold text-pine-700/80">
              查看 ›
            </span>
          </div>
        </div>
      </button>

      <button
        type="button"
        onClick={() => {
          if (confirm('刪除這則通知？')) onDelete(n.id)
        }}
        className="shrink-0 rounded-lg p-1 text-ink-ghost transition-colors hover:bg-warm hover:text-ink-soft"
        title="刪除這則通知"
        aria-label="刪除這則通知"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  )
}

export default function NotificationBell() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [showPrefs, setShowPrefs] = useState(false)

  // 相機動態預設收起：它數量最多，但不代表要處理的事
  const [showCamera, setShowCamera] = useState(false)

  const btnRef = useRef(null)
  const dropRef = useRef(null)

  // 下拉選單的 fixed 座標（對齊鈴鐺按鈕）
  const [dropPos, setDropPos] = useState({ top: 0, left: 0 })

  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications').then(r => r.data),
    refetchInterval: 60000
  })

  // 後端會回傳 important / camera 兩組；
  // 為了兼容只回傳 notifications 的舊版本，兩邊都做同樣的分類兜底。
  const all = data?.notifications || []
  const important = (data?.important || all).filter(n => !isCameraNotification(n))
  const camera = (data?.camera || all).filter(isCameraNotification)

  const unreadCount = important.filter(n => !n.isRead).length
  const cameraUnread = camera.filter(n => !n.isRead).length
  const hasUnread = unreadCount > 0 || cameraUnread > 0

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

  const refresh = () => qc.invalidateQueries({ queryKey: ['notifications'] })

  const markRead = async id => {
    await api.patch(`/notifications/${id}/read`)
    refresh()
  }

  // 點通知：先標成已讀（不等回應，避免卡住跳頁），再打開那件事的畫面
  const openNotification = n => {
    if (!n.isRead) markRead(n.id).catch(() => {})

    setOpen(false)
    navigate(targetPath(n))
  }

  const markAllRead = async () => {
    await api.patch('/notifications/read-all')
    refresh()
  }

  const removeOne = async id => {
    await api.delete(`/notifications/${id}`)
    refresh()
  }

  const clearCamera = async () => {
    await api.delete('/notifications/camera')
    refresh()
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
        <p className="text-sm font-bold text-pine-900">
          通知
          {unreadCount > 0 && (
            <span className="ml-2 text-xs font-semibold text-alert">
              {unreadCount} 則未讀
            </span>
          )}
        </p>

        <div className="flex items-center gap-3">
          {hasUnread && (
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

        {important.length === 0 && camera.length === 0 && (
          <div className="py-10 text-center">
            <PixelIcon name="bell" size={40} className="mx-auto" />
            <p className="mt-2 text-sm text-ink-soft">目前沒有通知</p>
          </div>
        )}

        {/* 1. 重要提醒：健康/週報/餵食，永遠不會被自動刪除 */}
        {important.length > 0 && (
          <p className="px-4 pb-1 pt-3 font-mono text-[11px] font-bold tracking-[0.14em] text-honey-deep">
            重要提醒
          </p>
        )}

        {important.map(n => (
          <NotificationRow
            key={n.id}
            notification={n}
            onOpen={openNotification}
            onDelete={removeOne}
          />
        ))}

        {/* 2. 相機動態：預設摺疊，只當記錄用 */}
        {camera.length > 0 && (
          <div className="border-t border-hair bg-cream">
            <button
              type="button"
              onClick={() => setShowCamera(v => !v)}
              className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left transition-colors hover:bg-warm"
            >
              <span className="flex items-center gap-1.5 text-xs font-bold text-ink-soft">
                <PixelIcon name="camera" size={16} />
                相機動態（{camera.length} 則
                {cameraUnread > 0 ? `・${cameraUnread} 則未讀` : ''}）
              </span>

              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className={`shrink-0 text-ink-faint transition-transform ${showCamera ? 'rotate-180' : ''}`}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>

            {showCamera && (
              <>
                <div className="flex items-start justify-between gap-2 bg-paper px-4 py-2">
                  <p className="text-[11px] leading-snug text-ink-soft">
                    只是鏡頭有沒有看到寵物的記錄，
                    超過 {CAMERA_RETENTION_DAYS} 天會自動清掉。
                    {camera.length >= CAMERA_LIST_LIMIT &&
                      ` 這裡只顯示最新 ${CAMERA_LIST_LIMIT} 則。`}
                    不想收可以在「通知設定」關掉。
                  </p>

                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`清除這 ${camera.length} 則相機動態？健康提醒與週報不會被刪掉。`)) {
                        clearCamera()
                      }
                    }}
                    className="shrink-0 text-[11px] font-bold text-clay hover:underline"
                  >
                    清除全部
                  </button>
                </div>

                {camera.map(n => (
                  <NotificationRow
                    key={n.id}
                    notification={n}
                    onOpen={openNotification}
                    onDelete={removeOne}
                  />
                ))}
              </>
            )}
          </div>
        )}

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
