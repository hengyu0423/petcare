import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import LoadingState from '../components/ui/LoadingState'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  buildTimelineWithGaps,
  deriveMonitorState,
  noDataText
} from '../lib/cameraTimeline'

const CAMERA_API = import.meta.env.VITE_CAMERA_API_URL || 'http://localhost:8000'
const API = '/api'
const authHeaders = () => {
  const token = localStorage.getItem('paw-token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

const ranges = {
  '20m': { label: '20 分鐘', minutes: 20, bucket: 5 },
  '1h': { label: '1 小時', minutes: 60, bucket: 10 },
  '6h': { label: '6 小時', minutes: 360, bucket: 30 },
  today: { label: '今天', minutes: 1440, bucket: 60 }
}

// SQL 紀錄分組（放在模組層，effect 才能安全使用）
function groupRecords(records, bucketMinutes) {
  const groups = {}

  records.forEach(item => {
    const rawTime = item.recordedAt || item.recorded_at
    if (!rawTime) return

    const date = new Date(rawTime)
    if (isNaN(date.getTime())) return

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

const MOOD_ICON = {
  active: <><path d="M13 3 5 13h5l-1 8 9-11h-5l1-7Z" /></>,
  curious: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="2.5" /></>,
  rest: <><path d="M19 15.5A7.5 7.5 0 0 1 8.5 5a7.5 7.5 0 1 0 10.5 10.5Z" /></>,
  calm: <><circle cx="12" cy="12" r="8" /><path d="M8.5 13.5c1.8 2 5.2 2 7 0" /><path d="M9 9.5h.01M15 9.5h.01" /></>,
  alert: <><path d="M12 4.5 20.5 19.5h-17L12 4.5Z" /><path d="M12 10v4M12 17h.01" /></>,
  none: <><rect x="3.5" y="6" width="17" height="12" rx="2" /><path d="M4 18l16-12" /></>,
  paw: <><ellipse cx="7" cy="8" rx="2" ry="2.4" /><ellipse cx="12" cy="5.8" rx="2" ry="2.4" /><ellipse cx="17" cy="8" rx="2" ry="2.4" /><path d="M12 11c-3 0-5.5 2.2-5.5 4.8 0 1.7 1.4 2.9 3 2.9 1 0 1.6-.5 2.5-.5s1.5.5 2.5.5c1.6 0 3-1.2 3-2.9C17.5 13.2 15 11 12 11Z" /></>
}

function moodKey(mood) {
  if (!mood) return 'paw'
  if (mood.includes('活躍') || mood.includes('興奮')) return 'active'
  if (mood.includes('好奇') || mood.includes('探索')) return 'curious'
  if (mood.includes('休息') || mood.includes('放鬆') || mood.includes('慵懶')) return 'rest'
  if (mood.includes('平靜') || mood.includes('舒適')) return 'calm'
  if (mood.includes('觀察') || mood.includes('警戒')) return 'alert'
  if (mood.includes('未偵測')) return 'none'
  return 'paw'
}

function MoodIcon({ mood, size = 20 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      {MOOD_ICON[moodKey(mood)]}
    </svg>
  )
}

const moodColor = mood => {
  const key = moodKey(mood)
  if (key === 'active') return 'bg-honey-100 text-honey-deep'
  if (key === 'curious') return 'bg-plum-50 text-plum-700'
  if (key === 'rest') return 'bg-water-50 text-ink-mute'
  if (key === 'calm') return 'bg-pine-50 text-pine-700'
  if (key === 'alert') return 'bg-amber/20 text-honey-text'
  return 'bg-cream text-ink-soft'
}

const cardCls = 'rounded-3xl border border-hair bg-plate shadow-card'

// 貓砂盆：如廁時間顯示（中位數）
const formatVisitSeconds = seconds => {
  if (seconds == null) return '—'

  const value = Math.round(seconds)

  if (value < 60) return `${value} 秒`
  return `${(value / 60).toFixed(1)} 分`
}

export default function PetCam({ cameraId: cameraIdProp } = {}) {
  // 通知鈴鐺跳過來時可能帶 ?camera=xxx，用來看對應那台相機的畫面；
  // 沒帶（正常的菜單進入）就一樣是 Camera 1。
  const [searchParams] = useSearchParams()
  const cameraId = cameraIdProp || searchParams.get('camera') || 'cam_1'

  const [status, setStatus] = useState({
    cameraId: 'cam_1',
    cameraName: 'Camera 1',
    detected: false,
    detectedType: 'pet',
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

  // 前端連不連得到 Python 攝影機服務（連不到時，畫面上的狀態可能是舊的）
  const [serviceReachable, setServiceReachable] = useState(true)
  const [statusLoaded, setStatusLoaded] = useState(false)
  const [range, setRange] = useState('20m')
  const [timeline, setTimeline] = useState([])
  const [timelineLoading, setTimelineLoading] = useState(false)

  // ==============================
  // 即時攝影機狀態
  // ==============================
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch(`${CAMERA_API}/status`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        setStatus(await res.json())
        setServiceReachable(true)
        setStatusLoaded(true)
      } catch (err) {
        console.error('取得攝影機狀態失敗：', err)
        setServiceReachable(false)
      }
    }

    fetchStatus()
    const timer = setInterval(fetchStatus, 1000)
    return () => clearInterval(timer)
  }, [])
  // ==========================================
  // 今日寵物進出貓砂次數
  // ==========================================
  const [catStats, setCatStats] = useState({
    catCount: 0,
    isPresent: false,
    lastSeen: null,
    urineCount: 0,
    poopCount: 0,
    avgUrineSeconds: null,
    avgPoopSeconds: null,
    visitDurations: [],
    baselineMedianSeconds: null,
  })

  useEffect(() => {
    const fetchCatCount = async () => {
      try {
        const res = await fetch(`${API}/cat-count`)
        if (!res.ok) return
        const data = await res.json()
        setCatStats({
          catCount: data.catCount ?? 0,
          isPresent: data.isPresent ?? false,
          lastSeen: data.lastSeen || null,
          urineCount: data.urineCount ?? 0,
          poopCount: data.poopCount ?? 0,
          avgUrineSeconds: data.avgUrineSeconds ?? null,
          avgPoopSeconds: data.avgPoopSeconds ?? null,
          visitDurations: Array.isArray(data.visitDurations)
            ? data.visitDurations
            : [],
          baselineMedianSeconds: data.baselineMedianSeconds ?? null,
        })
      } catch {
        // 後端尚未連線時維持原數值
      }
    }

    fetchCatCount()
    const timer = setInterval(fetchCatCount, 2000)
    return () => clearInterval(timer)
  }, [])

  // ==============================
  // 攝影機歷史紀錄（以 cameraId 運作，不依賴 petId）
  // ==============================
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setTimelineLoading(true)
        const config = ranges[range]

        const url =
          range === 'today'
            ? `${API}/camera-records/today?cameraId=${cameraId}`
            : `${API}/camera-records?cameraId=${cameraId}&minutes=${config.minutes}`

        const res = await fetch(url, { headers: authHeaders() })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)

        const data = await res.json()
        setTimeline(groupRecords(data.records || [], config.bucket))
      } catch (err) {
        console.error('取得攝影機歷史紀錄失敗：', err)
        setTimeline([])
      } finally {
        setTimelineLoading(false)
      }
    }

    fetchHistory()
    const timer = setInterval(fetchHistory, 60000)

    return () => clearInterval(timer)
  }, [range, cameraId])

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

  const formatMissing = () => {
    const seconds = Number(status.missingSeconds || 0)

    if (seconds < 60) return `${seconds} 秒`

    const minutes = Math.floor(seconds / 60)

    if (minutes < 60) return `${minutes} 分鐘`

    const hours = Math.floor(minutes / 60)
    const remain = minutes % 60

    return remain ? `${hours} 小時 ${remain} 分鐘` : `${hours} 小時`
  }

  // ==============================
  // 監控狀態（攝影機是否運作 ≠ 寵物是否在鏡頭中）
  // ==============================
  const monitor = deriveMonitorState({
    serviceReachable,
    loaded: statusLoaded,
    status
  })

  // 只有「攝影機運作中且偵測到寵物」時，即時的行為與數值才有意義
  const liveAvailable = monitor.key === 'present'

  const formatGapDuration = minutes => {
    if (minutes < 60) return `${minutes} 分鐘`

    const hours = Math.floor(minutes / 60)
    const remain = minutes % 60

    return remain ? `${hours} 小時 ${remain} 分鐘` : `${hours} 小時`
  }

  // 把沒有紀錄的時段補成「無資料」，時間軸才不會直接跳過那段時間
  const displayTimeline = useMemo(() => {
    const config = ranges[range]
    const now = new Date()

    const rangeStart =
      range === 'today'
        ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
        : new Date(now.getTime() - config.minutes * 60000)

    return buildTimelineWithGaps({
      groups: timeline,
      rangeStart,
      rangeEnd: now,
      bucketMinutes: config.bucket,
      currentBucketIsGap: monitor.key === 'absent'
    })
  }, [timeline, range, monitor.key])

  const hasGap = displayTimeline.some(item => item.type === 'gap')

  // 尿尿與大便合併為「如廁次數」；如廁時間改用中位數（不被偶爾蹲很久的一次拉高）
  const totalVisitCount = catStats.urineCount + catStats.poopCount

  const visitDurations = catStats.visitDurations
  const medianVisitSeconds = (() => {
    if (visitDurations.length === 0) return null
    const sorted = [...visitDurations].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2
  })()

  // 比平常（近 7 天中位數）久 50% 以上就提醒，可能是排尿不順
  const baseline = catStats.baselineMedianSeconds
  const visitRatio =
    medianVisitSeconds != null && baseline ? medianVisitSeconds / baseline : null
  const visitTimeAbnormal = visitRatio != null && visitRatio >= 1.5

  const sparkMax = Math.max(1, ...visitDurations)
  const sparkBars = visitDurations.slice(-12)

  const connLabel =
    monitor.key === 'present' || monitor.key === 'absent'
      ? 'LIVE'
      : monitor.key === 'camera_down'
        ? 'OFFLINE'
        : monitor.key === 'service_down'
          ? 'NO SERVICE'
          : 'CONNECTING'
  const frameLabel = cameraError ? 'OFFLINE' : connLabel
  const frameLive = frameLabel === 'LIVE'

  return (
    <div className="w-full min-h-full px-4 py-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">

        {/* 標題列 */}
        <PageHeader
          title="即時"
          accent="監控"
          className="mb-0"
          badge={
            <span className="rounded-full border border-honey-200 bg-honey-50 px-2.5 py-0.5 text-xs font-bold text-honey-text">
              {status.cameraName || 'Camera 1'}
            </span>
          }
        />

        {/* 上半：左 = 監控畫面，右 = 目前狀態（桌機並排，一個畫面就看完） */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-start">
          <div className="lg:col-span-7">
            {/* 攝影機 */}
            <div className="forest-band rounded-3xl bg-pine-800 px-3 pb-8 pt-8 text-paper shadow-card md:px-4">
              <div className="mb-2.5 flex items-center justify-between px-1.5">
                <span className="font-mono text-[11px] font-bold tracking-[0.2em] text-paper/70">
                  {(status.cameraName || 'Camera 1').toUpperCase()}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] font-bold tracking-widest ${
                    frameLive ? 'bg-lime/15 text-lime' : 'bg-white/10 text-paper/60'
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${frameLive ? 'animate-pulse bg-lime' : 'bg-paper/40'}`} />
                  {frameLabel}
                </span>
              </div>
              <div className="flex aspect-video w-full items-center justify-center overflow-hidden rounded-2xl bg-pine-900">
                {!cameraError ? (
                  <img
                    src={`${CAMERA_API}/video_feed`}
                    alt="寵物即時監控"
                    className="h-full w-full object-contain"
                    onLoad={() => setCameraError(false)}
                    onError={() => setCameraError(true)}
                  />
                ) : (
                  <div className="py-6 text-center text-warm">
                    <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
                      <MoodIcon mood="未偵測" size={24} />
                    </span>
                    <p className="mt-3 text-sm font-semibold">無法載入攝影機畫面</p>
                    <p className="mt-2 text-xs text-warm/70">
                      請確認 Python 攝影機服務是否正在運作
                    </p>
                  </div>
                )}
              </div>
              <div className="mt-3 space-y-1 px-1.5">
                {liveAvailable && (
                  <p className="text-[11px] tabular-nums text-paper/75">
                    辨識信心度 {status.confidence}% · 身體長寬比 {status.aspectRatio} · 移動量 {status.movement}
                  </p>
                )}
                <p className="text-[11px] leading-relaxed text-paper/55">
                  以攝影機為單位獨立運作，依 YOLO 偵測之姿態與活動量推估行為狀態
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-4 lg:col-span-5">
            {/* 是否在鏡頭內 */}
            <div
              className={`rounded-3xl border p-4 ${
                monitor.key === 'present'
                  ? 'border-pine-100 bg-pine-50'
                  : monitor.key === 'absent'
                    ? 'border-honey-200 bg-honey-50'
                    : monitor.key === 'camera_down'
                      ? 'border-clay-200 bg-clay-50'
                      : 'border-sand bg-cream'
              }`}
            >
              {monitor.key === 'present' ? (
                <>
                  <p className="flex items-center gap-2 font-bold text-pine-800">
                    <MoodIcon mood={status.detectedType === 'cat' ? '觀察' : status.detectedType === 'dog' ? '活躍' : status.mood} size={18} />
                    {status.detectedType === 'cat' ? '偵測到貓咪在鏡頭中' : status.detectedType === 'dog' ? '偵測到狗狗在鏡頭中' : '目前畫面中有偵測到目標'}
                  </p>
                  <p className="mt-2 text-xs text-pine-700/80">
                    最後偵測：{formatTime(status.lastSeenAt)}
                  </p>
                </>
              ) : monitor.key === 'absent' ? (
                <>
                  <p className="flex items-center gap-2 font-bold text-honey-ink">
                    <MoodIcon mood="未偵測" size={18} />
                    目前鏡頭範圍內未偵測到寵物
                  </p>
                  <p className="mt-2 text-xs text-honey-text">
                    攝影機運作中，只是畫面中沒有偵測到寵物或動態
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
                    <p className="text-xs text-honey-text">最後偵測：{formatTime(status.lastSeenAt)}</p>
                    <p className="text-xs text-honey-text">離開鏡頭時間：{formatMissing()}</p>
                  </div>
                  {status.missingMinutes >= 20 && (
                    <div className="mt-3 rounded-xl border border-honey-200 bg-plate/80 p-3">
                      <p className="text-xs font-bold text-honey-ink">已有一段時間未偵測到寵物</p>
                      <p className="mt-1 text-xs text-honey-text">
                        寵物可能位於攝影機範圍外，可查看即時畫面確認狀況。
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <p className={`flex items-center gap-2 font-bold ${monitor.key === 'camera_down' ? 'text-clay' : 'text-ink'}`}>
                    <MoodIcon mood="未偵測" size={18} />
                    {monitor.label}
                  </p>
                  {monitor.detail && <p className="mt-2 text-xs text-ink-soft">{monitor.detail}</p>}
                </>
              )}
            </div>

            {/* 當前行為 */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-3xl border border-hair bg-plate p-4 shadow-card">
                <p className="flex items-center gap-2 text-xs font-bold text-ink-soft"><span className="font-mono text-[11px] text-honey-deep">01</span>當前行為</p>
                <p className={`mt-2 text-lg font-extrabold ${liveAvailable ? 'text-pine-900' : 'text-ink-soft/70'}`}>
                  {liveAvailable ? status.behavior : noDataText(monitor.key)}
                </p>
              </div>
              <div className="rounded-3xl border border-honey-200 bg-honey-50 p-4">
                <p className="flex items-center gap-2 text-xs font-bold text-honey-text"><span className="font-mono text-[11px] text-honey-deep">02</span>推測活動狀態</p>
                <p className={`mt-2 flex items-center gap-1.5 text-lg font-extrabold ${liveAvailable ? 'text-honey-ink' : 'text-ink-soft/70'}`}>
                  {liveAvailable ? <><MoodIcon mood={status.mood} size={19} /> {status.mood}</> : noDataText(monitor.key)}
                </p>
                <p className="mt-2 text-[11px] text-honey-text/90">
                  此結果依攝影機偵測到的姿態與活動量推測，不代表寵物實際心理或醫療狀態。
                </p>
              </div>
            </div>

            {/* 今日貓砂盆使用：如廁次數與如廁時間分開展示 */}
            <div className={`${cardCls} px-5 py-4`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-honey-100 text-honey-deep">
                    <MoodIcon mood="paw" size={17} />
                  </span>
                  <span className="text-sm font-bold text-pine-800">
                    <span className="mr-2 font-mono text-[11px] text-honey-deep">03</span>今日貓砂盆使用
                  </span>
                  {catStats.isPresent && (
                    <span className="rounded-full bg-pine-50 px-2 py-0.5 text-[10px] font-bold text-pine-700">
                      目前在內
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-hair bg-cream px-3 py-2.5">
                  <p className="flex items-center gap-1.5 text-xs font-bold text-ink-mute">
                    <MoodIcon mood="paw" size={14} />
                    如廁次數
                  </p>
                  <p className="mt-0.5">
                    <span className="text-xl font-extrabold text-pine-900">
                      {totalVisitCount}
                    </span>
                    <span className="ml-1 text-xs text-ink-soft">次</span>
                  </p>
                </div>

                <div className="rounded-2xl border border-honey-200 bg-honey-50 px-3 py-2.5">
                  <p className="flex items-center gap-1.5 text-xs font-bold text-honey-text">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
                      <circle cx="12" cy="12" r="8.5" />
                      <path d="M12 7.5V12l3 2" />
                    </svg>
                    如廁時間
                  </p>
                  <div className="mt-0.5 flex items-end gap-2">
                    <span
                      className={`text-xl font-extrabold ${
                        visitTimeAbnormal ? 'text-clay' : 'text-honey-ink'
                      }`}
                    >
                      {formatVisitSeconds(medianVisitSeconds)}
                    </span>
                    <span className="text-xs text-honey-text">中位</span>

                    {sparkBars.length > 0 && (
                      <div
                        className="ml-auto flex h-5 items-end gap-0.5"
                        title="今日每次如廁時間"
                      >
                        {sparkBars.map((sec, i) => (
                          <span
                            key={i}
                            className={`w-1 rounded-sm ${
                              baseline && sec >= baseline * 1.5
                                ? 'bg-clay'
                                : 'bg-pine-700/45'
                            }`}
                            style={{
                              height: `${Math.max(15, (sec / sparkMax) * 100)}%`
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {totalVisitCount === 0 && (
                    <p className="mt-0.5 text-[10px] text-honey-text/80">今天還沒有紀錄</p>
                  )}
                  {visitTimeAbnormal && (
                    <p className="mt-0.5 text-[10px] font-bold text-clay">
                      比平常久 {Math.round((visitRatio - 1) * 100)}%
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 行為時間軸 */}
        <div className={`${cardCls} p-5`}>
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-brand text-base font-extrabold text-pine-900"><span className="mr-2 font-mono text-[11px] text-honey-deep">04</span>行為變化</h3>
              <p className="mt-1 text-xs text-ink-soft">查看不同時間內攝影機推測的行為狀態</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(ranges).map(([key, item]) => (
                <button
                  key={key}
                  onClick={() => setRange(key)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${
                    range === key
                      ? 'bg-pine-800 text-warm'
                      : 'bg-cream text-ink-soft hover:bg-hair'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {timelineLoading ? (
            <LoadingState compact label="載入行為紀錄中…" />
          ) : displayTimeline.length === 0 ? (
            <EmptyState compact icon="camera" title="目前沒有這段時間的行為資料" desc="攝影機持續運作後會自動累積紀錄" />
          ) : (
            <div className="overflow-x-auto pb-2">
              <div className="flex min-w-max">
                {displayTimeline.map((item, index) => (
                  <div key={`${item.time}-${index}`} className="relative w-[130px] text-center">
                    {item.type === 'gap' ? (
                      <>
                        <p className="text-[11px] tabular-nums text-ink-soft/80">
                          {formatTime(item.time)}–{formatTime(item.endTime)}
                        </p>
                        <div className="mx-auto my-2 flex h-11 w-11 items-center justify-center rounded-full border-2 border-dashed border-line bg-cream text-ink-soft/60">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                            <path d="M6 12h12" />
                          </svg>
                        </div>
                        <p className="text-xs font-semibold text-ink-soft">無資料</p>
                        <p className="mt-1 text-[10px] tabular-nums text-ink-soft/80">{formatGapDuration(item.minutes)}</p>
                        <p className="mt-1 text-[10px] text-ink-soft/60">未偵測到寵物</p>
                      </>
                    ) : (
                      <>
                        <p className="text-[11px] tabular-nums text-ink-soft/80">{formatTime(item.time)}</p>
                        <div className={`mx-auto my-2 flex h-11 w-11 items-center justify-center rounded-full ${moodColor(item.mood)}`}>
                          <MoodIcon mood={item.mood} size={20} />
                        </div>
                        <p className="text-xs font-bold text-pine-900">{item.mood}</p>
                        <p className="mt-1 text-[10px] text-ink-soft/80">{item.behavior}</p>
                        <p className="mt-1 text-[10px] text-ink-soft/60">活動量 {item.movement}</p>
                      </>
                    )}
                    {index < displayTimeline.length - 1 && (
                      <div className="absolute left-[87px] top-[39px] -z-0 h-[2px] w-[86px] bg-sand" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {hasGap && (
            <p className="mt-3 text-[11px] leading-relaxed text-ink-soft">
              「無資料」表示該時段沒有偵測到寵物（例如不在鏡頭範圍內）。
              攝影機目前是否運作，請看鏡頭下方的狀態卡片；
              若攝影機或服務中斷，該時段同樣會顯示無資料。
            </p>
          )}
        </div>

      </div>
    </div>
  )
}
