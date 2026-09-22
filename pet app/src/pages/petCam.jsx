import React, { useEffect, useRef, useState } from 'react'

const CAMERA_API = 'http://localhost:8000'
const API = 'http://localhost:4000/api'

const ranges = {
  '20m': { label: '20 分鐘', minutes: 20, bucket: 5 },
  '1h': { label: '1 小時', minutes: 60, bucket: 10 },
  '6h': { label: '6 小時', minutes: 360, bucket: 30 },
  today: { label: '今天', minutes: 1440, bucket: 60 }
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
        console.error('取得攝影機狀態失敗：', err)
      }
    }

    fetchStatus()
    const timer = setInterval(fetchStatus, 1000)
    return () => clearInterval(timer)
  }, [])

  // ==============================
  // PostgreSQL 歷史紀錄
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
        console.error('取得行為紀錄失敗：', err)
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
      const res = await fetch(`${API}/notifications?petId=${petId}`)
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
      console.error('取得通知失敗：', err)
    }
  }

  const markAsRead = async notification => {
    const id = notification.id
    const alreadyRead = notification.isRead ?? notification.is_read

    if (!id || alreadyRead) return

    try {
      const res = await fetch(`${API}/notifications/${id}/read`, {
        method: 'PATCH'
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

  // ==============================
  // 顯示格式
  // ==============================
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

  const moodEmoji = mood => {
    if (!mood) return '🐾'
    if (mood.includes('活躍') || mood.includes('興奮')) return '⚡'
    if (mood.includes('好奇') || mood.includes('探索')) return '👀'
    if (mood.includes('休息') || mood.includes('放鬆') || mood.includes('慵懶')) return '💤'
    if (mood.includes('平靜') || mood.includes('舒適')) return '😌'
    if (mood.includes('觀察') || mood.includes('警戒')) return '🐱'
    if (mood.includes('未偵測')) return '📷'
    return '🐾'
  }

  const moodColor = mood => {
    if (!mood) return 'bg-gray-100 text-gray-600'
    if (mood.includes('活躍') || mood.includes('興奮')) return 'bg-orange-100 text-orange-700'
    if (mood.includes('好奇') || mood.includes('探索')) return 'bg-purple-100 text-purple-700'
    if (mood.includes('休息') || mood.includes('放鬆')) return 'bg-blue-100 text-blue-700'
    if (mood.includes('平靜')) return 'bg-green-100 text-green-700'
    if (mood.includes('觀察') || mood.includes('警戒')) return 'bg-yellow-100 text-yellow-700'
    return 'bg-gray-100 text-gray-600'
  }

  const notificationIcon = type => {
    if (type === 'camera_missing') return '📷'
    if (type === 'camera_reappeared') return '🐱'
    if (type === 'health_alert') return '🩺'
    if (type === 'feeding_reminder') return '🍽️'
    return '🔔'
  }

  return (
    <div className="w-full min-h-full bg-gray-50 px-4 py-6">
      <div className="w-full max-w-[900px] mx-auto flex flex-col gap-5">

        {/* 標題 + 通知 */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-800">寵物即時監控</h2>
            <p className="text-xs text-gray-400 mt-1">
              依攝影機偵測到的姿態與活動量推測寵物行為狀態
            </p>
          </div>

          <div className="relative" ref={notificationRef}>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative w-10 h-10 bg-white border border-gray-200 rounded-xl shadow-sm flex items-center justify-center hover:bg-gray-50"
            >
              <span className="text-lg">🔔</span>

              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-[330px] max-h-[420px] overflow-y-auto bg-white border border-gray-200 rounded-2xl shadow-lg z-50">
                <div className="flex items-center justify-between px-4 py-3 border-b">
                  <p className="font-bold text-sm text-gray-800">通知中心</p>
                  <span className="text-xs text-gray-400">
                    {unreadCount} 則未讀
                  </span>
                </div>

                {notifications.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-10">
                    目前沒有通知
                  </p>
                ) : (
                  notifications.map(item => {
                    const isRead = item.isRead ?? item.is_read

                    return (
                      <button
                        key={item.id}
                        onClick={() => markAsRead(item)}
                        className={`w-full text-left px-4 py-3 border-b last:border-b-0 hover:bg-gray-50 ${
                          !isRead ? 'bg-orange-50/50' : ''
                        }`}
                      >
                        <div className="flex gap-3">
                          <span className="text-lg">
                            {notificationIcon(item.type)}
                          </span>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-semibold text-gray-800">
                                {item.title}
                              </p>

                              {!isRead && (
                                <span className="w-2 h-2 bg-red-500 rounded-full mt-1.5 flex-shrink-0" />
                              )}
                            </div>

                            <p className="text-xs text-gray-500 mt-1">
                              {item.message}
                            </p>

                            <p className="text-[10px] text-gray-300 mt-2">
                              {formatDateTime(
                                item.eventAt ||
                                item.event_at ||
                                item.createdAt ||
                                item.created_at
                              )}
                            </p>
                          </div>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            )}
          </div>
        </div>

        {/* 攝影機 */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-200">
          <div className="w-full bg-black min-h-[350px] flex items-center justify-center">
            {!cameraError ? (
              <img
                src={`${CAMERA_API}/video_feed`}
                alt="寵物即時監控"
                className="w-full max-h-[600px] object-contain"
                onLoad={() => setCameraError(false)}
                onError={() => setCameraError(true)}
              />
            ) : (
              <div className="text-center py-16">
                <p className="text-white text-sm">📷 無法載入攝影機畫面</p>
                <p className="text-gray-400 text-xs mt-2">
                  請確認 Python 攝影機服務是否正在運作
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 是否在鏡頭內 */}
        <div
          className={`rounded-2xl border p-5 ${
            status.detected
              ? 'bg-green-50 border-green-100'
              : 'bg-orange-50 border-orange-100'
          }`}
        >
          {status.detected ? (
            <>
              <p className="font-bold text-green-700">
                🐱 寵物目前在鏡頭中
              </p>

              <p className="text-xs text-green-600 mt-2">
                最後偵測：{formatTime(status.lastSeenAt)}
              </p>
            </>
          ) : (
            <>
              <p className="font-bold text-orange-700">
                📷 寵物目前未出現在鏡頭中
              </p>

              <div className="flex flex-wrap gap-x-6 gap-y-2 mt-2">
                <p className="text-xs text-orange-600">
                  最後偵測：{formatTime(status.lastSeenAt)}
                </p>

                <p className="text-xs text-orange-600">
                  已離開鏡頭：{formatMissing()}
                </p>
              </div>

              {status.missingMinutes >= 20 && (
                <div className="bg-white/70 border border-orange-200 rounded-xl p-3 mt-3">
                  <p className="text-xs font-semibold text-orange-700">
                    ⚠️ 已有一段時間未偵測到寵物
                  </p>

                  <p className="text-xs text-orange-600 mt-1">
                    寵物可能位於攝影機範圍外，可查看即時畫面確認狀況。
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* 當前行為 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-sky-50 border border-sky-100 rounded-2xl p-5">
            <p className="text-xs font-semibold text-sky-600">當前行為</p>
            <p className="text-lg font-bold text-gray-800 mt-2">
              {status.behavior}
            </p>
          </div>

          <div className="bg-pink-50 border border-pink-100 rounded-2xl p-5">
            <p className="text-xs font-semibold text-pink-600">
              推測活動狀態
            </p>

            <p className="text-lg font-bold text-gray-800 mt-2">
              {moodEmoji(status.mood)} {status.mood}
            </p>

            <p className="text-[11px] text-gray-400 mt-2">
              此結果依攝影機偵測到的姿態與活動量推測，不代表寵物實際心理或醫療狀態。
            </p>
          </div>
        </div>

        {/* 數值 */}
        {status.detected && (
          <div className="bg-white rounded-2xl border border-gray-100 px-4 py-3">
            <p className="text-xs text-gray-400 text-center">
              辨識信心度：{status.confidence}%　|　
              身體長寬比：{status.aspectRatio}　|　
              移動量：{status.movement}
            </p>
          </div>
        )}

        {/* 行為時間軸 */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
            <div>
              <h3 className="font-bold text-gray-800">行為變化</h3>

              <p className="text-xs text-gray-400 mt-1">
                查看不同時間內攝影機推測的行為狀態
              </p>
            </div>

            <div className="flex gap-2 flex-wrap">
              {Object.entries(ranges).map(([key, item]) => (
                <button
                  key={key}
                  onClick={() => setRange(key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    range === key
                      ? 'bg-gray-800 text-white'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {timelineLoading ? (
            <p className="text-center text-xs text-gray-400 py-10">
              載入行為紀錄中...
            </p>
          ) : timeline.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-sm text-gray-400">
                目前沒有這段時間的行為資料
              </p>

              <p className="text-xs text-gray-300 mt-1">
                攝影機持續運作後會自動累積紀錄
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto pb-2">
              <div className="flex min-w-max">
                {timeline.map((item, index) => (
                  <div
                    key={`${item.time}-${index}`}
                    className="relative w-[130px] text-center"
                  >
                    <p className="text-[11px] text-gray-400">
                      {formatTime(item.time)}
                    </p>

                    <div
                      className={`w-11 h-11 rounded-full flex items-center justify-center text-lg mx-auto my-2 ${moodColor(item.mood)}`}
                    >
                      {moodEmoji(item.mood)}
                    </div>

                    <p className="text-xs font-semibold text-gray-700">
                      {item.mood}
                    </p>

                    <p className="text-[10px] text-gray-400 mt-1">
                      {item.behavior}
                    </p>

                    <p className="text-[10px] text-gray-300 mt-1">
                      活動量 {item.movement}
                    </p>

                    {index < timeline.length - 1 && (
                      <div className="absolute top-[39px] left-[87px] w-[86px] h-[2px] bg-gray-200 -z-0" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 攝影機連線 */}
        <div className="flex items-center justify-center gap-2 pb-3">
          <span
            className={`w-2 h-2 rounded-full ${
              status.cameraConnected
                ? 'bg-green-500'
                : 'bg-red-500'
            }`}
          />

          <span className="text-xs text-gray-400">
            {status.cameraConnected
              ? '攝影機連線正常'
              : '攝影機未連線'}
          </span>
        </div>
      </div>
    </div>
  )
}