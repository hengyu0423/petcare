import PixelGarden from '../components/brand/PixelGarden'
import NumberedLinks from '../components/brand/NumberedLinks'
import ForestBand from '../components/brand/ForestBand'
import FaqSection from '../components/brand/FaqSection'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueries } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { api } from '../lib/api'
import { petAgeText } from '../lib/petAge'
import { todayString, daysBetween, formatKg } from '../lib/petInsights'

const CAMERA_API = import.meta.env.VITE_CAMERA_API_URL || 'http://localhost:8000'

import PetIcon from '../components/brand/PetIcon'

/* 自繪的單色描邊圖示（stroke = currentColor） */
const Icon = {
  bowl: (
    <>
      <path d="M4 12h16" />
      <path d="M5.5 12a6.5 6.5 0 0 0 13 0" />
      <path d="M10 18.5h4" />
    </>
  ),
  stethoscope: (
    <>
      <path d="M6 4v6a5 5 0 0 0 10 0V4" />
      <path d="M6 4H4M18 4h-2" />
      <path d="M11 15v2a4 4 0 0 0 8 0v-1" />
      <circle cx="19" cy="13" r="1.6" />
    </>
  ),
  clipboard: (
    <>
      <rect x="5.5" y="5" width="13" height="16" rx="2" />
      <path d="M9 5V3.8A.8.8 0 0 1 9.8 3h4.4a.8.8 0 0 1 .8.8V5" />
      <path d="M9.5 11h5M9.5 15h3.5" />
    </>
  ),
  wallet: (
    <>
      <rect x="3.5" y="7" width="17" height="11.5" rx="2" />
      <path d="M15.5 12.75h.01" />
      <path d="M3.5 10h17" />
    </>
  ),
  camera: (
    <>
      <rect x="3" y="8" width="13" height="10" rx="2" />
      <path d="M16 11l5-2.5v9L16 15" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  chevron: <polyline points="9 6 15 12 9 18" />,
  arrowRight: (
    <>
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </>
  )
}

function SvgIcon({ children, size = 18, strokeWidth = 1.8 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

function PawMark({ size = 44, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="currentColor" className={className} aria-hidden="true">
      <ellipse cx="24" cy="31" rx="10.5" ry="8" />
      <circle cx="12.5" cy="20" r="4" />
      <circle cx="20" cy="13" r="4" />
      <circle cx="28" cy="13" r="4" />
      <circle cx="35.5" cy="20" r="4" />
    </svg>
  )
}

// snap 容器吃掉 smooth；自己用 rAF 做一次 280ms 的翻頁動畫（任何瀏覽器都吃 scrollLeft）
function animateFeedScroll(el, to) {
  const from = el.scrollLeft
  if (from === to) return
  const prevSnap = el.style.scrollSnapType
  el.style.scrollSnapType = 'none'
  const start = performance.now()
  const duration = 280
  const ease = p => 1 - Math.pow(1 - p, 3) // easeOutCubic
  const tick = now => {
    const p = Math.min((now - start) / duration, 1)
    el.scrollLeft = Math.round(from + (to - from) * ease(p))
    if (p < 1) {
      requestAnimationFrame(tick)
    } else {
      el.scrollLeft = to
      el.style.scrollSnapType = prevSnap // 動畫結束時正好停在吸附點
    }
  }
  requestAnimationFrame(tick)
}

const QUICK_LINKS = [
  { to: '/diet',           icon: Icon.bowl,        title: '飲食管理', desc: '記錄每日餵食與份量', bg: 'bg-warm', fg: 'text-honey-deep' },
  { to: '/health-consult', icon: Icon.stethoscope, title: '健康諮詢', desc: 'AI 問診，給毛孩初步建議', bg: 'bg-pine-50', fg: 'text-pine-700' },
  { to: '/weekly-report',  icon: Icon.clipboard,   title: '健康週報', desc: '查看近七天的健康摘要', bg: 'bg-plum-50', fg: 'text-plum-700' },
  { to: '/expenses',       icon: Icon.wallet,      title: '財務管理', desc: '記帳與追蹤寵物開銷', bg: 'bg-blush-50', fg: 'text-blush-700' }
]

const BAND_CARDS = [
  { to: '/diet',     t: '餵食紀錄', d: '記下今天餵了多少' },
  { to: '/pets',     t: '健康紀錄', d: '到寵物頁，替毛孩記下健康狀況' },
  { to: '/expenses', t: '花費',     d: '記一筆寵物開銷' },
  { to: '/pets',     t: '新毛孩',   d: '把新家人加進來' }
]

const FAQ_ITEMS = [
  { q: '怎麼新增第一隻毛孩？', a: <>到左側選單的「<Link to="/pets">我的寵物</Link>」新增，填入名字、物種和品種就能開始。品種還會決定首頁像素毛孩的毛色喔。</> },
  { q: '餵食紀錄要去哪裡記？', a: <>到「<Link to="/diet">飲食管理</Link>」，可以記錄每日餵食與份量，並選擇要記錄的毛孩。</> },
  { q: 'AI 健康諮詢可以取代獸醫嗎？', a: '不行。它只提供初步建議，幫你先判斷狀況；有疑慮或情況緊急時，請盡快帶毛孩就醫。' },
  { q: '健康週報會看到什麼？', a: <>「<Link to="/weekly-report">健康週報</Link>」會整理近七天的健康摘要。平常記得多記一筆，內容才會完整。</> },
  { q: '即時監控怎麼開始？', a: <>從左側選單打開「<Link to="/pet-cam">即時監控</Link>」，就能看到攝影機畫面；首頁上方的監控卡片也可以直接點進去。</> },
  { q: '花費要怎麼記？', a: <>到「<Link to="/expenses">財務管理</Link>」記帳並追蹤寵物開銷，也可以查看「<Link to="/expense-report">支出報表</Link>」。</> }
]

/* ---------- 小工具 ---------- */

const dayOf = v => (v ? String(v).slice(0, 10) : null)

// 後端偶爾會把陣列包在物件裡（例如 { days: [...] }），這裡一律轉成陣列，
// 避免 .find / .map 直接爆掉讓整頁白屏
function asRows(value) {
  if (Array.isArray(value)) return value
  if (!value || typeof value !== 'object') return []
  if (Array.isArray(value.rows)) return value.rows
  if (Array.isArray(value.records)) return value.records
  if (Array.isArray(value.data)) return value.data
  return Object.values(value).filter(v => v && typeof v === 'object' && !Array.isArray(v))
}

function deriveReminders(records, today) {
  const items = (records || [])
    .map(r => {
      const date = dayOf(r.next_date)
      if (!date) return null
      return { id: r.id, title: r.title || '提醒', type: r.type, date, daysLeft: daysBetween(today, date) }
    })
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date))

  const overdue = items.filter(i => i.daysLeft < 0)
  const soon = items.filter(i => i.daysLeft >= 0 && i.daysLeft <= 7)
  const upcoming = items.filter(i => i.daysLeft >= 0 && i.daysLeft <= 30)
  return { overdue, soon, upcoming, all: items }
}

function petHealthBadge(reminder, isLoading) {
  if (isLoading) return { label: '讀取中', cls: 'bg-sand text-ink-soft' }
  if (reminder.overdue.length > 0) return { label: '已逾期', cls: 'bg-amber text-amber-ink' }
  if (reminder.soon.length > 0) return { label: '該回診', cls: 'bg-warm text-honey-deep border border-honey-200' }
  if (reminder.upcoming.length > 0) return { label: '有提醒', cls: 'bg-pine-50 text-pine-700 border border-pine-100' }
  return { label: '狀態良好', cls: 'bg-pine-50 text-pine-700' }
}

const FEEDING_STATUS = {
  in_range: { label: '份量剛好', cls: 'bg-pine-50 text-pine-700 border border-pine-100' },
  under:    { label: '還不夠',   cls: 'bg-warm text-honey-deep border border-honey-200' },
  over:     { label: '吃太多了', cls: 'bg-amber text-amber-ink border border-honey-500' },
  no_data:  { label: '還沒餵食', cls: 'bg-sand text-ink-soft border border-line' },
  no_target:{ label: '無法估算', cls: 'bg-sand text-ink-soft border border-line' }
}

function formatKcal(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '∅'
  return number.toLocaleString('zh-TW')
}

export default function DashboardPage() {
  const { user } = useAuthStore()
  const today = todayString()

  const {
    data: pets = [],
    isLoading: petsLoading,
    isError: petsError,
    refetch: refetchPets
  } = useQuery({
    queryKey: ['pets'],
    queryFn: () => api.get('/pets').then(r => asRows(r.data?.data))
  })

  // 攝影機本機服務狀態（決定「連線中 vs 離線」）
  const {
    data: camLive,
    isLoading: camStatusLoading,
    isError: camServiceDown,
    refetch: refetchCamStatus
  } = useQuery({
    queryKey: ['camera-service-status'],
    queryFn: async () => {
      const res = await fetch(`${CAMERA_API}/status`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    },
    refetchInterval: 5000,
    retry: 1
  })

  // 攝影機 Camera 1 最近 10 分鐘辨識摘要
  const {
    data: moodSummary,
    isLoading: moodLoading,
    refetch: refetchMood
  } = useQuery({
    queryKey: ['camera-summary', 'cam_1'],
    queryFn: async () => {
      const camRes = await api.get('/camera-records/summary?cameraId=cam_1&minutes=10')
      return camRes.data
    },
    refetchInterval: 60000,
    retry: 1
  })

  const feedingQueries = useQueries({
    queries: pets.map(pet => ({
      queryKey: ['feeding-trends', pet.id],
      queryFn: async () => {
        const res = await api.get(`/feeding/pet/${pet.id}/trends?days=7`)
        const payload = res.data?.data
        const days = Array.isArray(payload) ? payload : payload?.days
        return asRows(days)
      },
      enabled: !!pet.id,
      staleTime: 60_000
    }))
  })

  const healthQueries = useQueries({
    queries: pets.map(pet => ({
      queryKey: ['pet-health', pet.id],
      queryFn: async () => {
        const res = await api.get(`/health-records/pet/${pet.id}`)
        return asRows(res.data?.data)
      },
      enabled: !!pet.id,
      staleTime: 60_000
    }))
  })

  // 每隻寵物：今天的 { 實際熱量, 餐數, 建議目標熱量, 範圍狀態 }
  // 注意：重試間隔（例如 API 剛重啟、資料庫連線還在暖身）時 isPending 仍是 true、
  // 但 isLoading 會變 false。若用 isLoading 判斷，這一段會被當成「今天還沒餵」「補上體重」，
  // 明明有資料卻顯示空卡片。所以這裡用 isPending 顯示骨架，並把拿不到資料當成錯誤。
  const feedingToday = useMemo(
    () =>
      pets.map((pet, i) => {
        const q = feedingQueries[i]
        const days = asRows(q?.data)
        const row = days.find(d => d.date === today) || null
        const loading = pet.id ? Boolean(q?.isPending) : false
        const error = Boolean(q?.isError) || (!loading && days.length === 0)
        return { pet, row, loading, error }
      }),
    [pets, feedingQueries, today]
  )

  const healthSummary = useMemo(() => {
    const perPet = pets.map((pet, i) => {
      const records = asRows(healthQueries[i]?.data)
      return { pet, reminder: deriveReminders(records, today), done: healthQueries[i]?.isSuccess }
    })
    const combined = perPet
      .flatMap(({ pet, reminder }) =>
        reminder.upcoming.map(item => ({ ...item, petName: pet.name, overdue: false }))
      )
      .concat(
        perPet.flatMap(({ pet, reminder }) =>
          reminder.overdue.map(item => ({ ...item, petName: pet.name, overdue: true }))
        )
      )
      .sort((a, b) => a.date.localeCompare(b.date))

    const overdueCount = perPet.reduce((n, p) => n + p.reminder.overdue.length, 0)
    const upcomingCount = perPet.reduce((n, p) => n + p.reminder.upcoming.length, 0)

    return {
      perPet,
      combined: combined.slice(0, 2),
      overdueCount,
      upcomingCount,
      total: overdueCount + upcomingCount,
      loading: pets.length > 0 && healthQueries.some(q => q.isLoading),
      error: healthQueries.some(q => q.isError)
    }
  }, [pets, healthQueries, today])

  // 今日餵食卡：內部分頁滑動
  const feedScrollRef = useRef(null)
  const [feedIndex, setFeedIndex] = useState(0)
  const onFeedScroll = () => {
    const el = feedScrollRef.current
    if (!el || el.clientWidth === 0) return
    const i = Math.round(el.scrollLeft / el.clientWidth)
    if (i !== feedIndex) setFeedIndex(i)
  }
  const scrollToFeed = index => {
    const el = feedScrollRef.current
    if (!el) return
    animateFeedScroll(el, index * el.clientWidth)
  }

  // 滑鼠滾輪：在右區塊上，垂直滾輪切換上一隻/下一隻（與 snap 相容）
  const wheelLockRef = useRef(0)
  useEffect(() => {
    const el = feedScrollRef.current
    if (!el) return
    const onWheel = e => {
      if (Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return
      if (el.scrollWidth <= el.clientWidth) return

      // 動作剛跳過去，冷卻中（避免一次手勢跳多隻）
      if (Date.now() - wheelLockRef.current < 350) {
        e.preventDefault()
        return
      }

      const current = Math.round(el.scrollLeft / el.clientWidth)
      const maxIndex = Math.round(el.scrollWidth / el.clientWidth) - 1
      const target = current + (e.deltaY > 0 ? 1 : -1)

      // 到底/頂了：放行，讓頁面正常捲動
      if (target < 0 || target > maxIndex) return

      e.preventDefault()
      wheelLockRef.current = Date.now()
      animateFeedScroll(el, target * el.clientWidth)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // 攝影機狀態機：loading / detected / idle / offline
  const cameraLoading = moodLoading || camStatusLoading
  const serviceReachable = !camServiceDown && Boolean(camLive)
  const serviceConnected = serviceReachable && camLive?.cameraConnected !== false
  const hasRecentRecognition = Boolean(moodSummary?.success)

  let cameraMode
  if (cameraLoading) cameraMode = 'loading'
  else if (serviceConnected && hasRecentRecognition) cameraMode = 'detected'
  else if (serviceConnected) cameraMode = 'idle'
  else if (hasRecentRecognition) cameraMode = 'detected'
  else cameraMode = 'offline'

  const formatTime = value => {
    if (!value) return '--:--'
    return new Date(value).toLocaleTimeString('zh-TW', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
  }

  const hour = new Date().getHours()
  const greeting =
    hour < 5 ? '夜深了' : hour < 12 ? '早安' : hour < 18 ? '午安' : '晚安'

  const now = new Date()
  const pad = n => String(n).padStart(2, '0')
  const dayNum = now.getDate()
  const dateLine = now.toLocaleDateString('zh-TW', { month: 'long', weekday: 'long' })

  const percentage = Math.min(100, Math.max(0, Number(moodSummary?.percentage) || 0))
  const speciesLabel =
    moodSummary?.detectedType === 'cat'
      ? '貓咪'
      : moodSummary?.detectedType === 'dog'
        ? '狗狗'
        : '目標'

  // 待機狀態：距上次看到的分鐘數
  const missingMinutes = camLive?.missingMinutes ?? null
  const lastSeenLabel = camLive?.lastSeenAt
    ? `最近看到 ${formatTime(camLive.lastSeenAt)}`
    : '今天還沒看到牠'

  const retryCamera = e => {
    e.preventDefault()
    refetchCamStatus()
    refetchMood()
  }

  return (
    <div className="min-h-full text-ink">
      <div className="max-w-6xl px-4 py-6 md:px-8 md:py-8">

        {/* ===== 像素風首屏：問候、日期、還有你的毛孩（Kizupi 式） ===== */}
        <PixelGarden
          pets={pets}
          loading={petsLoading}
          tall
          className="mb-5 rounded-3xl border border-hair shadow-card"
        >
          <div className="min-w-0">
            <h1 className="font-brand text-3xl md:text-4xl font-extrabold tracking-tight text-pine-900 leading-[1.12]">
              {greeting}，<span className="hl">{user?.name}</span><span aria-hidden="true"> 👋</span>
            </h1>
            <p className="mt-1.5 text-xs md:text-sm text-ink-soft">
              今天也要好好照顧毛孩們。
            </p>
          </div>
          <div className="shrink-0 rounded-2xl border border-hair bg-plate/95 px-4 py-2.5 text-center shadow-card">
            <p className="font-brand text-3xl md:text-4xl font-extrabold leading-none text-honey-deep tabular-nums">
              {pad(dayNum)}
            </p>
            <p className="mt-1 text-[9px] md:text-[10px] font-medium text-ink-soft whitespace-nowrap">
              {dateLine}
            </p>
          </div>
        </PixelGarden>

        {/* ===== 攝影機監控 ===== */}
        <Link
          to="/pet-cam"
          aria-label="打開即時監控"
          className="group block rounded-3xl outline-none focus-visible:ring-4 focus-visible:ring-honey/50"
        >
          {cameraLoading ? (
            <div className="forest-band rounded-3xl bg-pine-800 p-5 md:p-6 animate-pulse" aria-busy="true">
              <div className="h-3 w-32 rounded-full bg-white/15" />
              <div className="mt-5 h-10 md:h-14 w-48 rounded-2xl bg-white/15" />
              <div className="mt-4 h-2 w-64 max-w-full rounded-full bg-white/10" />
            </div>
          ) : cameraMode === 'detected' ? (
            <div className="relative overflow-hidden forest-band rounded-3xl bg-pine-800 text-paper p-5 md:p-6 transition-all duration-300 group-hover:-translate-y-0.5 shadow-[0_24px_48px_-24px_rgba(24,48,31,0.55)]">

              {/* 頂行：來源 + 連線狀態 */}
              <div className="relative flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
                <p className="flex items-center gap-2 text-[9px] md:text-[10px] font-bold tracking-[0.2em] text-paper/60">
                  <PawMark size={11} className="text-lime" />
                  CAMERA 1
                </p>
                <p className="flex flex-wrap items-center gap-3 text-[10px] md:text-[11px]">
                  <span className="inline-flex items-center gap-2 rounded-full bg-lime/15 border border-lime/30 px-3 py-1 font-bold text-lime">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-live-ping absolute inline-flex h-full w-full rounded-full bg-lime" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-lime" />
                    </span>
                    連線中
                  </span>
                  <span className="tabular-nums text-paper/55">
                    最近活動 {formatTime(moodSummary.updatedAt)}
                  </span>
                </p>
              </div>

              {/* 主行：目前行為 + 信心度 */}
              <div className="relative mt-4 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
                <div className="min-w-0">
                  <p className="text-[9px] md:text-[10px] font-bold text-paper/50">目前行為</p>
                  <p className="font-brand mt-1.5 text-4xl md:text-6xl font-extrabold leading-none text-paper">
                    {moodSummary.mainMood}
                  </p>
                  <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[9px] md:text-[10px] text-paper/70">
                    {moodSummary.latestBehavior && (
                      <span className="rounded-full border border-white/20 px-2.5 py-0.5">{moodSummary.latestBehavior}</span>
                    )}
                    {moodSummary.detectedType && (
                      <span className="rounded-full border border-white/20 px-2.5 py-0.5">偵測到{speciesLabel}</span>
                    )}
                    <span className="tabular-nums text-paper/45">共 {moodSummary.samples} 筆辨識</span>
                  </p>
                </div>

                <div className="shrink-0 border-l border-white/10 pl-5 md:pl-8">
                  <p className="text-[9px] md:text-[10px] font-bold text-paper/50">信心度</p>
                  <p className="font-brand mt-1 text-4xl md:text-5xl leading-none text-lime tabular-nums">
                    {moodSummary.latestConfidence ?? '∅'}
                    <span className="text-lg md:text-xl align-top text-lime/70">%</span>
                  </p>
                  <p className="mt-1.5 max-w-[9rem] text-[9px] md:text-[10px] leading-snug text-paper/45">
                    YOLO 對最新一次辨識的把握程度
                  </p>
                </div>
              </div>

              {/* 行為一致度 */}
              <div className="relative mt-4 max-w-md">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="text-[9px] md:text-[10px] text-paper/55">
                    行為一致度 — 近 {moodSummary.minutes} 分鐘，{percentage}% 的辨識紀錄為「{moodSummary.mainMood}」
                  </p>
                  <p className="tabular-nums text-[9px] md:text-[10px] text-paper/60">{percentage}%</p>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-lime transition-all duration-700"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>

              {/* 底行：說明 + 入口 */}
              <div className="relative mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
                <p className="text-[9px] md:text-[10px] text-paper/40">
                  辨識僅供參考，不能取代獸醫診斷
                </p>
                <span className="inline-flex items-center gap-2 btn-lime rounded-2xl bg-lime px-4 py-2 text-[10px] md:text-[11px] font-extrabold text-pine-900 group-hover:bg-lime-hover">
                  打開即時監控
                  <SvgIcon size={13} strokeWidth={2.4}>{Icon.arrowRight}</SvgIcon>
                </span>
              </div>
            </div>
          ) : cameraMode === 'idle' ? (
            /* 鏡頭開著、但沒看到寵物 —— 跟離線是不同狀態 */
            <div className="relative overflow-hidden forest-band rounded-3xl bg-pine-800 text-paper p-5 md:p-6 transition-all duration-300 group-hover:-translate-y-0.5">

              <div className="relative flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
                <div className="min-w-0 flex items-start gap-4">
                  <div className="flex h-12 w-12 md:h-14 md:w-14 shrink-0 items-center justify-center rounded-2xl bg-lime/15 text-lime">
                    <SvgIcon size={26} strokeWidth={1.6}>{Icon.camera}</SvgIcon>
                  </div>
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-[9px] md:text-[10px] font-bold tracking-[0.18em] text-paper/60">
                      CAMERA 1
                      <span className="rounded-full bg-lime/15 border border-lime/40 px-2.5 py-0.5 text-[9px] md:text-[10px] font-bold tracking-normal text-lime">
                        連線中 · 待命中
                      </span>
                    </p>
                    <p className="font-brand mt-1.5 text-2xl md:text-3xl font-extrabold leading-tight text-paper">
                      鏡頭開著，還沒看到寵物
                    </p>
                    <p className="mt-1.5 text-[9px] md:text-[10px] text-paper/55">
                      {lastSeenLabel}{missingMinutes != null && missingMinutes > 0 ? ` · 已 ${Math.round(missingMinutes)} 分鐘沒入鏡` : ''}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 flex flex-col items-end gap-2">
                  <p className="text-[9px] md:text-[10px] text-paper/45">
                    一般是牠不在畫面裡而已
                  </p>
                  <span className="inline-flex items-center gap-2 btn-lime rounded-2xl bg-lime px-4 py-2 text-[10px] md:text-[11px] font-extrabold text-pine-900 group-hover:bg-lime-hover">
                    查看即時畫面
                    <SvgIcon size={13} strokeWidth={2.4}>{Icon.arrowRight}</SvgIcon>
                  </span>
                </div>
              </div>

              <p className="relative mt-4 border-t border-white/10 pt-3 text-[9px] md:text-[10px] text-paper/45">
                小提示：把鏡頭對準毛孩常待的位置，牠一入鏡就會開始辨識。
              </p>
            </div>
          ) : (
            /* 離線：本機攝影機服務連不上，或鏡頭回報斷線 */
            <div className="relative rounded-3xl border-2 border-dashed border-hair-strong bg-plate p-5 md:p-6">
              <div className="flex items-start gap-4 md:gap-5">
                <div className="flex h-12 w-12 md:h-14 md:w-14 shrink-0 items-center justify-center rounded-2xl bg-sand text-ink-soft">
                  <SvgIcon size={28} strokeWidth={1.5}>{Icon.camera}</SvgIcon>
                </div>
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-brand text-xl md:text-2xl font-extrabold text-pine-900">
                    攝影機離線
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber px-3 py-0.5 text-[9px] md:text-[10px] font-black text-amber-ink">
                      未連線
                    </span>
                  </p>
                  <p className="mt-1.5 text-[10px] md:text-[11px] text-ink-soft leading-relaxed max-w-md">
                    {camLive?.cameraError
                      ? `鏡頭回報錯誤：${camLive.cameraError}`
                      : '連不上本機攝影機服務（http://localhost:8000）。請確認 pet cam 已啟動，或稍後再試。'}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-4">
                    <span className="inline-flex items-center gap-2 rounded-2xl bg-honey px-4 py-2 text-[10px] md:text-[11px] font-extrabold text-pine-900 shadow-press">
                      查看即時畫面
                      <SvgIcon size={13} strokeWidth={2.4}>{Icon.arrowRight}</SvgIcon>
                    </span>
                    <button
                      type="button"
                      onClick={retryCamera}
                      className="text-[10px] md:text-[11px] font-semibold text-ink-soft hover:text-ink underline underline-offset-4 decoration-line"
                    >
                      重新整理狀態
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Link>

        {/* ===== 今日餵食：左 = 今天餵了多少，右 = 建議熱量 + 範圍條（多隻可左右滑） ===== */}
        {pets.length === 0 ? (
          <Link
            to="/pets"
            className="mt-4 flex items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-hair-strong bg-plate px-6 py-6 text-xs font-bold text-ink-soft md:text-sm"
          >
            還沒有寵物 — 新增後，這裡會顯示每隻的建議熱量
          </Link>
        ) : (
          <div className="mt-4 overflow-hidden rounded-3xl border border-hair shadow-card bg-plate" role="region" aria-label="今日餵食，左右滑動切換寵物">
            <div className="flex">
              {/* 左：固定區，切換時原地換內容（不滑動） */}
              {(() => {
                const active = feedingToday[feedIndex] || feedingToday[0]
                if (!active) return null
                const { pet, row, loading, error } = active
                const hasData = Boolean(row?.hasData)
                const mealCount = hasData ? Number(row.mealCount) : 0
                const actual = hasData ? Number(row.actualKcal) : null
                return (
                  <Link
                    key={pet.id}
                    to="/diet"
                    aria-label={`${pet.name} 今日餵食，點此記一筆`}
                    className="flex w-[34%] shrink-0 items-center gap-3 p-4 transition-colors hover:bg-warm md:p-5"
                  >
                    <PetIcon species={pet.species} breed={pet.breed} size={56} className="h-14 w-14 shrink-0 md:h-16 md:w-16" />
                    <span className="min-w-0">
                      <span className="block text-[9px] font-bold text-ink-soft md:text-[10px]">
                        {pet.name} · 今日餵食
                      </span>
                      {loading ? (
                        <span className="mt-1 block h-7 w-16 animate-pulse rounded-lg bg-sand" />
                      ) : error ? (
                        <>
                          <span className="font-brand mt-0.5 block text-2xl font-extrabold text-ink-mute md:text-3xl">—</span>
                          <span className="mt-0.5 block text-[9px] text-ink-soft md:text-[10px]">暫時讀不到資料</span>
                        </>
                      ) : (
                        <>
                          <span className="font-brand mt-0.5 block text-2xl font-extrabold tabular-nums text-pine-900 md:text-3xl">
                            {mealCount} 餐
                          </span>
                          <span className="mt-0.5 block text-[9px] text-ink-soft md:text-[10px]">
                            {hasData ? `今天吃了 ${formatKcal(actual)} kcal` : '今天還沒餵'}
                          </span>
                        </>
                      )}
                    </span>
                  </Link>
                )
              })()}

              {/* 右：分頁，左右滑動（圓點跟著右區塊置中） */}
              <div className="flex min-w-0 flex-1 flex-col">
              <div ref={feedScrollRef} onScroll={onFeedScroll} className="no-scrollbar flex min-w-0 flex-1 snap-x snap-mandatory overflow-x-auto">
            {feedingToday.map(({ pet, row, loading, error }) => {
                const status = row?.status || 'no_data'
                const statusMeta = FEEDING_STATUS[status] || FEEDING_STATUS.no_data
                const hasData = Boolean(row?.hasData)
                const actual = hasData ? Number(row.actualKcal) : null
                const targetKcal = Number(row?.targetKcal)
                const minKcal = Number(row?.minKcal)
                const maxKcal = Number(row?.maxKcal)
                const hasTarget = Number.isFinite(targetKcal) && targetKcal > 0
                const percent = hasData && hasTarget ? Math.round((actual / targetKcal) * 100) : null
                const ceiling = hasTarget
                  ? Math.max(maxKcal * 1.25, actual ?? 0, targetKcal)
                  : Math.max(actual ?? 0, 1)
                const pos = v => {
                  const n = Number(v)
                  if (!Number.isFinite(n)) return 0
                  return Math.min(Math.max((n / ceiling) * 100, 0), 100)
                }

                return (
                  <Link
                    key={pet.id}
                    to="/diet"
                    aria-label={`${pet.name} 的建議熱量，點此記一筆`}
                    className="flex w-full shrink-0 snap-start flex-col transition-colors hover:bg-warm"
                  >
                      {/* 區塊 B：建議熱量 + 範圍條 */}
                      <div className="min-w-0 flex-1 p-4 md:p-5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[9px] font-bold text-ink-soft md:text-[10px]">建議熱量</span>
                          {!loading && (
                            <span className={`rounded-full border px-2 py-0.5 text-[8px] font-bold md:text-[9px] ${statusMeta.cls}`}>
                              {statusMeta.label}
                            </span>
                          )}
                        </div>
                        {loading ? (
                          <div className="mt-2 animate-pulse">
                            <div className="h-6 w-36 rounded-lg bg-sand" />
                            <div className="mt-2 h-1.5 w-full rounded-full bg-sand/70" />
                          </div>
                        ) : error ? (
                          <p className="mt-1.5 text-[9px] text-ink-soft md:text-[10px]">暫時讀不到資料</p>
                        ) : (
                          <>
                            <p className="font-brand mt-0.5 text-lg font-extrabold tabular-nums text-pine-900 md:text-2xl">
                              {hasTarget ? `${formatKcal(targetKcal)} kcal` : '∅'}
                            </p>
                            <p className="text-[8px] text-ink-soft md:text-[9px]">
                              {hasTarget ? `建議範圍 ${formatKcal(minKcal)} – ${formatKcal(maxKcal)}` : '補上體重和出生日才能估算'}
                            </p>

                            {hasTarget && (
                              <div className="mt-2">
                                <div className="relative h-2.5 rounded-full bg-sand">
                                  <div
                                    className="absolute top-0 bottom-0 rounded-full border border-pine-200 bg-pine-100"
                                    style={{
                                      left: `${pos(minKcal)}%`,
                                      width: `${Math.max(pos(maxKcal) - pos(minKcal), 2)}%`
                                    }}
                                  />
                                  {hasData && (
                                    <div
                                      className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-plate bg-tabby shadow-sm"
                                      style={{ left: `${pos(actual)}%` }}
                                      title={`今天吃了 ${formatKcal(actual)} kcal`}
                                    />
                                  )}
                                </div>
                                <div className="mt-1 flex items-center justify-between text-[8px] text-ink-soft md:text-[9px]">
                                  <span>0</span>
                                  <span className="font-semibold">
                                    {percent !== null ? `已達 ${percent}%` : '無紀錄'}
                                  </span>
                                  <span className="tabular-nums">{formatKcal(Math.round(ceiling))} kcal</span>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                  </Link>
                )
              })}
              </div>
              {pets.length > 1 && (
                <div className="flex items-center justify-center gap-1.5 py-2.5">
                  {pets.map((p, i) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => scrollToFeed(i)}
                      aria-label={`切換到 ${p.name}`}
                      aria-current={feedIndex === i}
                      className={`h-2 rounded-full transition-all duration-300 ${feedIndex === i ? 'w-5 bg-pine-800' : 'w-2 bg-line'}`}
                    />
                  ))}
                </div>
              )}
              </div>
            </div>
          </div>
        )}
        {/* ===== 主內容：左 = 我的寵物，右 = 快速前往（編號列表） ===== */}
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-12 gap-4">

          {/* 我的寵物 */}
          <section className="lg:col-span-7 rounded-3xl border border-hair shadow-card bg-plate overflow-hidden" aria-labelledby="my-pets-title">
            <div className="flex items-center justify-between gap-4 px-5 md:px-6 pt-4 md:pt-5 pb-3 border-b border-hair">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 md:h-11 md:w-11 items-center justify-center rounded-2xl bg-honey">
                  <PawMark size={22} className="text-pine-900" />
                </span>
                <h2 id="my-pets-title" className="font-brand text-lg md:text-xl font-extrabold text-pine-900">
                  我的寵物
                  <span className="ml-2 align-middle text-[11px] md:text-xs font-body font-bold text-ink-soft tabular-nums">
                    {petsLoading ? '…' : `${pets.length} 隻`}
                  </span>
                </h2>
              </div>
              <Link
                to="/pets"
                className="text-[11px] md:text-xs font-bold text-pine-800 hover:text-pine-900 underline underline-offset-4 decoration-honey decoration-2"
              >
                管理寵物
              </Link>
            </div>

            {petsLoading ? (
              <ul className="px-5 md:px-6 py-3" aria-busy="true">
                {[0, 1, 2].map(i => (
                  <li key={i} className="flex items-center gap-4 py-4 animate-pulse">
                    <div className="h-14 w-14 rounded-full bg-sand" />
                    <div className="flex-1">
                      <div className="h-3.5 w-24 rounded-full bg-sand" />
                      <div className="mt-2 h-3 w-40 rounded-full bg-sand/70" />
                    </div>
                  </li>
                ))}
              </ul>
            ) : petsError ? (
              <div className="px-6 py-12 text-center">
                <p className="text-sm font-bold text-ink">讀不到寵物資料</p>
                <p className="mt-1 text-[11px] text-ink-soft">請檢查網路連線，或確認後端服務是否正常。</p>
                <button
                  type="button"
                  onClick={() => refetchPets()}
                  className="mt-4 rounded-2xl bg-honey px-5 py-2 text-xs font-extrabold text-pine-900 shadow-press"
                >
                  重試
                </button>
              </div>
            ) : pets.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <PawMark size={52} className="mx-auto text-honey-200" />
                <p className="font-brand mt-4 text-lg font-extrabold text-pine-900">還沒有寵物</p>
                <p className="mt-1 text-[11px] md:text-xs text-ink-soft max-w-xs mx-auto">
                  新增第一隻寵物，開始記錄牠的健康、飲食和花費。
                </p>
                <Link
                  to="/pets"
                  className="mt-5 inline-block rounded-2xl bg-honey px-6 py-3 text-xs md:text-sm font-extrabold text-pine-900 shadow-press"
                >
                  新增第一隻寵物
                </Link>
              </div>
            ) : (
              <ul className="px-3 md:px-4 py-2 space-y-1">
                {pets.map((pet, i) => {
                  const reminder = healthSummary.perPet[i]?.reminder || { overdue: [], soon: [], upcoming: [] }
                  const healthLoading = healthSummary.perPet[i]?.done === false
                  const badge = petHealthBadge(reminder, healthLoading)
                  const age = petAgeText(pet.birth_date)
                  const weight = pet.weight != null && pet.weight !== '' ? `${formatKg(pet.weight)} kg` : null

                  return (
                    <li key={pet.id}>
                      <Link
                        to={`/pets/${pet.id}`}
                        className="flex items-center gap-3 md:gap-4 rounded-2xl px-2 py-2.5 transition-colors hover:bg-warm"
                      >
                        <PetIcon species={pet.species} breed={pet.breed} size={56} className="h-12 w-12 shrink-0 md:h-14 md:w-14" />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="text-sm md:text-[15px] font-bold text-ink">
                              {pet.name}
                            </span>
                            <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[9px] md:text-[10px] font-bold ${badge.cls}`}>
                              {badge.label}
                            </span>
                          </span>
                          <span className="mt-0.5 block text-[10px] md:text-[11px] text-ink-soft truncate">
                            {[pet.breed || pet.species, age, weight].filter(Boolean).join(' · ')}
                          </span>
                        </span>
                        <span className="shrink-0 text-ink-soft/60">
                          <SvgIcon size={17}>{Icon.chevron}</SvgIcon>
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          {/* 右欄：快速前往（編號列表） */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <NumberedLinks title="快速前往" items={QUICK_LINKS} />
          </div>

        </div>

        {/* ===== 深綠功能區（Kizupi 式）：記一筆，提醒才有資料 ===== */}
        <div className="mt-8">
          <ForestBand
            id="record-band-title"
            lines={['記一筆，', '提醒才有資料。']}
            sub="報表和提醒，都靠你記下的每一筆。"
            cta={{ to: '/diet', label: '新增餵食紀錄' }}
            cards={BAND_CARDS}
          />
        </div>

        {/* ===== 編號式 FAQ（Kizupi 式） ===== */}
        <div className="mt-8">
          <FaqSection
            id="faq-title"
            title={<>使用上，<br />常被問的<br />幾件事。</>}
            intro={<>找不到答案？到「<Link to="/health-consult" className="font-bold text-pine-700 underline underline-offset-4">健康諮詢</Link>」問問 AI。</>}
            items={FAQ_ITEMS}
          />
        </div>

        {/* 頁尾 */}
        <footer className="mt-6 flex items-center justify-center gap-2 text-[9px] md:text-[10px] text-ink-soft/70">
          <PawMark size={10} className="text-hair-strong" />
          PawCare · 用心守護每個毛孩
          <PawMark size={10} className="text-hair-strong" />
        </footer>

      </div>
    </div>
  )
}
