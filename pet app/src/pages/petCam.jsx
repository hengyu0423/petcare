import React, { useEffect, useRef, useState } from 'react'
import {
  BracketTitle,
  CornerBrackets,
  Button,
  Tag
} from '@endfield-ui/react'
import {
  Video,
  VideoOff,
  Bell,
  Eye,
  Activity,
  AlertTriangle,
  Clock,
  Sparkles,
  CheckCircle2,
  Moon,
  Smile,
  Compass,
  Radio,
  Calendar,
  X
} from 'lucide-react'

const CAMERA_API = import.meta.env.VITE_CAMERA_API_URL || 'http://localhost:8000'
const API = '/api'
const authHeaders = () => {
  const token = localStorage.getItem('paw-token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

const ranges = {
  '20m': { label: '20 分鐘', minutes: 20, bucket: 5 },
  '1h':  { label: '1 小時',  minutes: 60, bucket: 10 },
  '6h':  { label: '6 小時',  minutes: 360, bucket: 30 },
  today: { label: '今天',    minutes: 1440, bucket: 60 }
}

export default function PetCam({ petId = 8 }) {
  const [status, setStatus] = useState({
    detected: false,
    behavior: '讀取中...',
    mood: '讀取中...',
    confidence: 0,
    aspectRatio: 0,
    movement: 0,
    lastSeenAt: null,
    missingSeconds: 0,
    missingMinutes: 0,
    cameraConnected: false
  })

  const [cameraError, setCameraError] = useState(false)
  const [range, setRange] = useState('20m')
  const [timeline, setTimeline] = useState([])
  const [timelineLoading, setTimelineLoading] = useState(false)

  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showNotifications, setShowNotifications] = useState(false)

  const notificationRef = useRef(null)

  // ==============================
  // 即時攝影機狀態
  // ==============================
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch(`${CAMERA_API}/status`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        setStatus(await res.json())
      } catch (err) {
        // 静默处理，避免控制台刷屏
      }
    }

    fetchStatus()
    const timer = setInterval(fetchStatus, 1000)
    return () => clearInterval(timer)
  }, [])

  // ==============================
  // 歷史紀錄
  // ==============================
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setTimelineLoading(true)
        const config = ranges[range]

        const url =
          range === 'today'
            ? `${API}/mood-records/pet/${petId}/today`
            : `${API}/mood-records/pet/${petId}?minutes=${config.minutes}`

        const res = await fetch(url)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)

        const data = await res.json()
        setTimeline(groupRecords(data.records || [], config.bucket))
      } catch (err) {
        setTimeline([])
      } finally {
        setTimelineLoading(false)
      }
    }

    fetchHistory()
    const timer = setInterval(fetchHistory, 60000)

    return () => clearInterval(timer)
  }, [range, petId])

  // ==============================
  // 通知
  // ==============================
  useEffect(() => {
    fetchNotifications()
    const timer = setInterval(fetchNotifications, 30000)
    return () => clearInterval(timer)
  }, [petId])

  useEffect(() => {
    const handleClickOutside = e => {
      if (
        notificationRef.current &&
        !notificationRef.current.contains(e.target)
      ) {
        setShowNotifications(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchNotifications = async () => {
    try {
      const res = await fetch(`${API}/notifications?petId=${petId}`, {
        headers: authHeaders()
      })
      if (!res.ok) return

      const data = await res.json()
      const list = data.notifications || data.records || data || []

      if (Array.isArray(list)) {
        setNotifications(list.slice(0, 10))
        setUnreadCount(
          list.filter(item => !(item.isRead ?? item.is_read)).length
        )
      }
    } catch (err) {
      // 容错
    }
  }

  const markAsRead = async notification => {
    const id = notification.id
    const alreadyRead = notification.isRead ?? notification.is_read

    if (!id || alreadyRead) return

    try {
      const res = await fetch(`${API}/notifications/${id}/read`, {
        method: 'PATCH',
        headers: authHeaders()
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      setNotifications(prev =>
        prev.map(item =>
          item.id === id
            ? { ...item, isRead: true, is_read: true }
            : item
        )
      )

      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (err) {
      console.error('標記通知已讀失敗：', err)
    }
  }

  // ==============================
  // SQL 紀錄分組
  // ==============================
  const groupRecords = (records, bucketMinutes) => {
    const groups = {}

    records.forEach(item => {
      if (!item.recordedAt) return
      const date = new Date(item.recordedAt)
      date.setMinutes(
        Math.floor(date.getMinutes() / bucketMinutes) * bucketMinutes,
        0,
        0
      )
      const key = date.toISOString()
      if (!groups[key]) groups[key] = []
      groups[key].push(item)
    })

    const getTop = values => {
      const counts = {}
      values.filter(Boolean).forEach(value => {
        counts[value] = (counts[value] || 0) + 1
      })
      return (
        Object.entries(counts)
          .sort((a, b) => b[1] - a[1])[0]?.[0] || '無資料'
      )
    }

    return Object.entries(groups)
      .map(([time, items]) => ({
        time,
        mood: getTop(items.map(x => x.mood)),
        behavior: getTop(items.map(x => x.behavior)),
        movement: Math.round(
          items.reduce(
            (sum, item) => sum + Number(item.movement || 0),
            0
          ) / items.length
        ),
        samples: items.length
      }))
      .sort((a, b) => new Date(a.time) - new Date(b.time))
  }

  const formatTime = value => {
    if (!value) return '--:--'
    return new Date(value).toLocaleTimeString('zh-TW', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
  }

  const formatDateTime = value => {
    if (!value) return ''
    return new Date(value).toLocaleString('zh-TW', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
  }

  const formatMissing = () => {
    const seconds = Number(status.missingSeconds || 0)
    if (seconds < 60) return `${seconds} 秒`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes} 分鐘`
    const hours = Math.floor(minutes / 60)
    const remain = minutes % 60
    return remain ? `${hours} 小時 ${remain} 分鐘` : `${hours} 小時`
  }

  const getMoodIcon = mood => {
    if (!mood) return Activity
    if (mood.includes('活躍') || mood.includes('興奮')) return Sparkles
    if (mood.includes('好奇') || mood.includes('探索')) return Compass
    if (mood.includes('休息') || mood.includes('放鬆') || mood.includes('慵懶')) return Moon
    if (mood.includes('平靜') || mood.includes('舒適')) return Smile
    if (mood.includes('觀察') || mood.includes('警戒')) return Eye
    return Activity
  }

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-6" data-theme="light">
      {/* 標題與通知列 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#e5e5e5] pb-5">
        <div>
          <BracketTitle prefix="// OPTICAL.SURVEILLANCE">即時監控</BracketTitle>
          <p className="text-xs font-mono text-[#8a8a8a] mt-1 tracking-wider">
            依攝影機姿態與活動量推測即時生活狀態
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* 連線指示燈 */}
          <div className="flex items-center gap-2 border border-[#d9d9d9] bg-white px-3 py-1.5 text-xs font-mono">
            <span
              className={`w-2 h-2 ${
                status.cameraConnected ? 'bg-[#22c55e]' : 'bg-[#dc2626]'
              }`}
            />
            <span className="text-[#191919]">
              {status.cameraConnected ? 'FEED ONLINE' : 'FEED OFFLINE'}
            </span>
          </div>

          {/* 通知中心按鈕 */}
          <div className="relative" ref={notificationRef}>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative w-9 h-9 border border-[#d9d9d9] bg-white hover:border-[#191919] flex items-center justify-center text-[#191919] transition-colors"
            >
              <Bell size={16} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 bg-[#191919] text-[#fffa00] font-mono text-[9px] font-bold flex items-center justify-center">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-white border border-[#191919] shadow-2xl z-50">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#e5e5e5] bg-[#fafafa]">
                  <span className="font-bold text-xs text-[#191919] tracking-wider uppercase font-mono">
                    監控事件通知 // ALERTS
                  </span>
                  <span className="text-[10px] font-mono text-[#8a8a8a]">
                    {unreadCount} 未讀
                  </span>
                </div>

                {notifications.length === 0 ? (
                  <p className="text-xs font-mono text-[#8a8a8a] text-center py-8">
                    暫無偵測事件通知
                  </p>
                ) : (
                  notifications.map(item => {
                    const isRead = item.isRead ?? item.is_read
                    return (
                      <button
                        key={item.id}
                        onClick={() => markAsRead(item)}
                        className={`w-full text-left p-3 border-b border-[#e5e5e5] last:border-b-0 hover:bg-[#fafafa] transition-colors ${
                          !isRead ? 'bg-[#fffa00]/15' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-bold text-[#191919]">
                            {item.title}
                          </p>
                          {!isRead && (
                            <span className="w-1.5 h-1.5 bg-[#191919] shrink-0 mt-1" />
                          )}
                        </div>
                        <p className="text-xs text-[#555] mt-1 leading-relaxed">
                          {item.message}
                        </p>
                        <p className="text-[10px] font-mono text-[#8a8a8a] mt-1.5">
                          {formatDateTime(
                            item.eventAt ||
                            item.event_at ||
                            item.createdAt ||
                            item.created_at
                          )}
                        </p>
                      </button>
                    )
                  })
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 攝影機畫面監視器 */}
      <div className="relative border border-[#191919] bg-[#0c0d0e] overflow-hidden shadow-lg">
        <CornerBrackets size="lg" />

        {/* 頂部 OSD 抬頭顯示條 */}
        <div className="absolute top-0 inset-x-0 z-10 px-4 py-2.5 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between font-mono text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444] animate-pulse" />
            <span className="text-[#fffa00] font-bold tracking-widest text-[11px]">REC</span>
            <span className="text-white/60 text-[11px] ml-2">CAM_CH01 // LIVE</span>
          </div>
          <div className="text-white/70 text-[11px]">
            {status.detected ? (
              <span className="text-[#fffa00] font-bold">TARGET LOCKED</span>
            ) : (
              <span className="text-white/40">STANDBY SEARCH</span>
            )}
          </div>
        </div>

        {/* 影像主畫面 */}
        <div className="w-full min-h-[360px] md:min-h-[460px] flex items-center justify-center">
          {!cameraError ? (
            <img
              src={`${CAMERA_API}/video_feed`}
              alt="寵物即時影像"
              className="w-full max-h-[560px] object-contain"
              onLoad={() => setCameraError(false)}
              onError={() => setCameraError(true)}
            />
          ) : (
            <div className="text-center py-20 px-4">
              <VideoOff size={36} className="text-white/30 mx-auto mb-3" />
              <p className="text-white text-sm font-mono font-bold tracking-wider">
                NO SIGNAL // 暫無法載入影像
              </p>
              <p className="text-white/50 text-xs mt-1.5 font-mono">
                請確認邊緣攝影機伺服器服務是否已連線啟動
              </p>
            </div>
          )}
        </div>

        {/* 底部 OSD 監控數據條 */}
        {status.detected && (
          <div className="absolute bottom-0 inset-x-0 z-10 px-4 py-2 bg-gradient-to-t from-black/90 to-transparent flex flex-wrap items-center justify-between font-mono text-[11px] text-white/80 border-t border-white/10">
            <div>
              CONFIDENCE: <span className="text-[#fffa00] font-bold">{status.confidence}%</span>
            </div>
            <div>
              ASPECT_RATIO: <span className="text-[#fffa00] font-bold">{status.aspectRatio}</span>
            </div>
            <div>
              MOVEMENT_IDX: <span className="text-[#fffa00] font-bold">{status.movement}</span>
            </div>
          </div>
        )}
      </div>

      {/* 鏡頭偵測狀態判定卡 */}
      <div
        className={`relative border p-4 transition-colors ${
          status.detected
            ? 'bg-white border-[#191919]'
            : 'bg-[#fafafa] border-[#d9d9d9]'
        }`}
      >
        <CornerBrackets size="sm" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 flex items-center justify-center shrink-0 border ${
                status.detected
                  ? 'bg-[#191919] text-[#fffa00] border-[#191919]'
                  : 'bg-white text-[#8a8a8a] border-[#d9d9d9]'
              }`}
            >
              {status.detected ? <Eye size={18} /> : <VideoOff size={18} />}
            </div>
            <div>
              <p className="font-bold text-sm text-[#191919]">
                {status.detected ? '毛孩目前正在畫面中' : '目前鏡頭未偵測到寵物'}
              </p>
              <p className="text-xs text-[#8a8a8a] font-mono mt-0.5">
                最後偵測時間：{formatTime(status.lastSeenAt)}
                {!status.detected && ` · 已離開視野約 ${formatMissing()}`}
              </p>
            </div>
          </div>

          <div className="shrink-0">
            {status.detected ? (
              <Tag size="sm" variant="default" className="bg-[#fffa00] text-[#191919] border-[#191919] font-mono font-bold">
                ● DETECTED
              </Tag>
            ) : (
              <Tag size="sm" variant="default" className="bg-[#f0f0f0] text-[#8a8a8a] border-[#d9d9d9] font-mono">
                OUT OF FRAME
              </Tag>
            )}
          </div>
        </div>

        {/* 離線太久提醒 */}
        {!status.detected && status.missingMinutes >= 20 && (
          <div className="mt-3 p-3 bg-white border border-[#d9d9d9] flex items-center gap-2.5 text-xs text-[#555]">
            <AlertTriangle size={15} className="text-[#f59e0b] shrink-0" />
            <span>已超過 20 分鐘未在鏡頭偵測到寵物，可透過即時畫面或呼喚確認狀況。</span>
          </div>
        )}
      </div>

      {/* 姿態與活動狀態分析 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* 當前行為姿態 */}
        <div className="relative bg-white border border-[#d9d9d9] p-5">
          <CornerBrackets size="sm" />
          <div className="text-[10px] font-mono text-[#8a8a8a] uppercase tracking-wider mb-2">
            當前姿態行為 / POSE_BEHAVIOR
          </div>
          <div className="text-xl font-bold text-[#191919] flex items-center gap-2">
            <Activity size={20} className="text-[#191919]" />
            <span>{status.behavior}</span>
          </div>
          <p className="text-[11px] text-[#8a8a8a] font-mono mt-2">
            根據全身關鍵點骨架與高度比例計算
          </p>
        </div>

        {/* 推測活動狀態 */}
        <div className="relative bg-white border border-[#d9d9d9] p-5">
          <CornerBrackets size="sm" />
          <div className="text-[10px] font-mono text-[#8a8a8a] uppercase tracking-wider mb-2">
            活動狀態推測 / ACTIVITY_STATE
          </div>
          <div className="text-xl font-bold text-[#191919] flex items-center gap-2">
            {React.createElement(getMoodIcon(status.mood), { size: 20, className: 'text-[#191919]' })}
            <span>{status.mood}</span>
          </div>
          <p className="text-[11px] text-[#8a8a8a] font-mono mt-2">
            依連續幀活動量與位移推測，不等同醫療診斷
          </p>
        </div>
      </div>

      {/* 行為歷史時間軸 */}
      <div className="relative bg-white border border-[#d9d9d9] p-6 shadow-xs">
        <CornerBrackets size="sm" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#e5e5e5] pb-4 mb-6">
          <div>
            <h3 className="font-bold text-sm text-[#191919]">行為狀態變化曲線</h3>
            <p className="text-xs font-mono text-[#8a8a8a] mt-0.5">
              回溯各時段由邊緣演算推估之活動紀錄
            </p>
          </div>

          <div className="flex gap-1.5 flex-wrap">
            {Object.entries(ranges).map(([key, item]) => (
              <button
                key={key}
                onClick={() => setRange(key)}
                className={`px-3 py-1 text-xs font-mono transition-colors ${
                  range === key
                    ? 'bg-[#191919] text-[#fffa00] font-bold'
                    : 'bg-[#fafafa] border border-[#d9d9d9] text-[#555] hover:border-[#191919] hover:text-[#191919]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {timelineLoading ? (
          <p className="text-center text-xs font-mono text-[#8a8a8a] py-12">
            載入歷史數據中... // LOADING_TIMELINE
          </p>
        ) : timeline.length === 0 ? (
          <div className="text-center py-12">
            <Clock size={28} className="text-[#d9d9d9] mx-auto mb-2" />
            <p className="text-xs font-mono text-[#8a8a8a]">此區間內暫無活動紀錄</p>
            <p className="text-[11px] font-mono text-[#b0b0b0] mt-1">攝影機持續運作後將自動彙整數據</p>
          </div>
        ) : (
          <div className="overflow-x-auto pb-4">
            <div className="flex min-w-max gap-3">
              {timeline.map((item, index) => {
                const Icon = getMoodIcon(item.mood)
                return (
                  <div
                    key={`${item.time}-${index}`}
                    className="relative w-28 bg-[#fafafa] border border-[#e5e5e5] hover:border-[#191919] p-3 text-center transition-colors"
                  >
                    <p className="text-[11px] font-mono text-[#8a8a8a] mb-2">
                      {formatTime(item.time)}
                    </p>

                    <div className="w-8 h-8 mx-auto bg-white border border-[#d9d9d9] flex items-center justify-center text-[#191919] mb-2">
                      <Icon size={16} />
                    </div>

                    <p className="text-xs font-bold text-[#191919] truncate">
                      {item.mood}
                    </p>

                    <p className="text-[10px] text-[#8a8a8a] mt-1 truncate">
                      {item.behavior}
                    </p>

                    <p className="text-[10px] font-mono text-[#8a8a8a] mt-1">
                      ACT: {item.movement}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}