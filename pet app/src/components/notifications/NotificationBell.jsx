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
      className={`flex items-start gap-1 px-4 py-3 border-b border-gray-50 last:border-0 ${
        n.isRead ? 'bg-white' : 'bg-green-50/40'
      }`}
    >
      <button
        type="button"
        onClick={() => onOpen(n)}
        className="flex-1 min-w-0 text-left flex gap-2.5"
        title="打開對應頁面"
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

          <div className="flex items-center gap-2 mt-1">
            <p className="text-xs text-gray-400">
              {n.petName ? `${n.petName}・` : ''}
              {timeAgo(n.createdAt)}
            </p>

            <span className="ml-auto text-[11px] font-semibold text-green-600/70 shrink-0">
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
        className="shrink-0 px-1 text-gray-300 hover:text-gray-500 text-sm leading-6"
        title="刪除這則通知"
        aria-label="刪除這則通知"
      >
        ✕
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
      className="bg-white rounded-xl shadow-lg border border-gray-100 max-h-[70vh] flex flex-col"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <p className="text-sm font-bold text-gray-800">
          通知
          {unreadCount > 0 && (
            <span className="ml-2 text-xs font-semibold text-red-500">
              {unreadCount} 則未讀
            </span>
          )}
        </p>

        <div className="flex items-center gap-3">
          {hasUnread && (
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
            onClick={() => {
              setOpen(false)
              setShowPrefs(true)
            }}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            title="通知設定"
          >
            ⚙️
          </button>
        </div>
      </div>

      <div className="overflow-y-auto flex-1">

        {important.length === 0 && camera.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-10">
            目前沒有通知
          </p>
        )}

        {/* 1. 重要提醒：健康/週報/餵食，永遠不會被自動刪除 */}
        {important.length > 0 && (
          <p className="px-4 pt-3 pb-1 text-[11px] font-bold text-gray-400 tracking-wide">
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
          <div className="border-t border-gray-100 bg-gray-50/70">
            <button
              type="button"
              onClick={() => setShowCamera(v => !v)}
              className="w-full flex items-center justify-between gap-2 px-4 py-2.5 text-left hover:bg-gray-100/60 transition-colors"
            >
              <span className="text-xs font-semibold text-gray-500">
                📷 相機動態（{camera.length} 則
                {cameraUnread > 0 ? `・${cameraUnread} 則未讀` : ''}）
              </span>

              <span className="text-xs text-gray-400 shrink-0">
                {showCamera ? '收起 ▲' : '展開 ▼'}
              </span>
            </button>

            {showCamera && (
              <>
                <div className="flex items-start justify-between gap-2 px-4 py-2 bg-gray-100/50">
                  <p className="text-[11px] text-gray-400 leading-snug">
                    只是鏡頭有沒有看到寵物的記錄，
                    超過 {CAMERA_RETENTION_DAYS} 天會自動清掉。
                    {camera.length >= CAMERA_LIST_LIMIT &&
                      ` 這裡只顯示最新 ${CAMERA_LIST_LIMIT} 則。`}
                    不想收可以在 ⚙️ 通知設定關掉。
                  </p>

                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`清除這 ${camera.length} 則相機動態？健康提醒與週報不會被刪掉。`)) {
                        clearCamera()
                      }
                    }}
                    className="shrink-0 text-[11px] font-semibold text-gray-500 hover:text-gray-700"
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

      {dropdown}

      {showPrefs && (
        <NotificationPreferencesModal onClose={() => setShowPrefs(false)} />
      )}

    </div>
  )
}
