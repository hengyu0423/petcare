import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import '@fontsource-variable/saira/standard.css'
import '@fontsource-variable/noto-sans-sc/wght.css'
import '../styles/endfield/endfield.css'
import './dashboard.css'
import { api } from '../lib/api'
import { useAuthStore } from '../store/authStore'
import { petAgeText, ageInMonths } from '../lib/petAge'
import { lifeStage, weightTrend, formatKg, todayString } from '../lib/petInsights'
import { useHealthRecords, upcomingReminders } from '../lib/petHealth'
import Dial from '../components/ef/Dial'
import Num from '../components/ef/Num'

// 設計變體（強調色、紙色、切角…）由外框 Layout 統一設定，見 lib/useEfVariant.js。
// 首頁自己只管深色／淺色主題。
const THEME_KEY = 'pawcare-home-theme' // 'dark' | 'light'；沒有就跟著系統

const SPECIES_ZH = { dog: '狗', cat: '貓', bird: '鳥', rabbit: '兔子', fish: '魚', other: '其他' }

const pad = n => String(n).padStart(2, '0')
const dotDate = d => `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`
const dotDateStr = s => String(s || '').slice(0, 10).replaceAll('-', '.')
const hm = iso => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : `${pad(d.getHours())}:${pad(d.getMinutes())}`
}
const n0 = v => Math.round(Number(v) || 0).toLocaleString('en-US')

// 三格讀數的容器：依最長那個數字的字數縮小字號，太長就改成一行一項（見 dashboard.css）
const figs = (...vals) => {
  const n = Math.max(...vals.map(v => String(v).length))
  return `ef-figs${n >= 6 ? ' pc-fig-stack' : n === 5 ? ' pc-fig-xs' : n === 4 ? ' pc-fig-sm' : ''}`
}

// ISO 週數與這一週的起訖（週一到週日）
function weekInfo(now = new Date()) {
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7)

  const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7))
  const sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6)
  return { week, range: `${pad(mon.getMonth() + 1)}.${pad(mon.getDate())} – ${pad(sun.getMonth() + 1)}.${pad(sun.getDate())}` }
}

function greeting(now = new Date()) {
  const h = now.getHours()
  if (h < 5) return '夜深了'
  if (h < 12) return '早安'
  if (h < 18) return '午安'
  return '晚安'
}

// 首頁顯示期間，把主題掛到 <html>（離開首頁就拿掉，其他頁面還是淺色）
function useHomeTheme() {
  const [dark, setDark] = useState(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY)
      if (saved) return saved === 'dark'
    } catch { /* 忽略 */ }
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
  })

  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-theme', dark ? 'dark' : 'light')
    return () => root.removeAttribute('data-theme')
  }, [dark])

  const toggle = () =>
    setDark(d => {
      try { localStorage.setItem(THEME_KEY, d ? 'light' : 'dark') } catch { /* 忽略 */ }
      return !d
    })

  return [dark, toggle]
}

export default function DashboardPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [dark, toggleTheme] = useHomeTheme()

  const { data: pets = [], isLoading: loadingPets, isError: petsError, refetch: refetchPets } = useQuery({
    queryKey: ['pets'],
    queryFn: () => api.get('/pets').then(r => r.data.data)
  })

  // 目前聚焦的寵物：網址 ?pet=ID，沒有就優先貓（監控是看貓的），再來第一隻
  const wanted = Number(searchParams.get('pet'))
  const featured = pets.find(p => p.id === wanted) || pets.find(p => p.species === 'cat') || pets[0]
  const fid = featured?.id

  const { data: plan, isError: planError } = useQuery({
    queryKey: ['meal-plan-home', fid],
    queryFn: () => api.get(`/food/meal-plan/${fid}`).then(r => r.data.data),
    enabled: !!fid
  })
  const { data: weights = [] } = useQuery({
    queryKey: ['pet-weights', fid],
    queryFn: async () => (await api.get(`/pets/${fid}/weights`)).data.data,
    enabled: !!fid
  })
  const { data: health = [] } = useHealthRecords(fid)
  const { data: monthly = [] } = useQuery({
    queryKey: ['expenses-monthly'],
    queryFn: () => api.get('/expenses/monthly').then(r => r.data.data)
  })
  const { data: mood } = useQuery({
    queryKey: ['mood-summary', fid],
    queryFn: () => api.get(`/mood-records/pet/${fid}/summary?minutes=10`).then(r => r.data),
    enabled: !!fid
  })
  const { data: notices = [] } = useQuery({
    queryKey: ['dashboard-notifications', fid],
    queryFn: () => api.get(`/notifications?petId=${fid}`).then(r => r.data.notifications || []),
    enabled: !!fid
  })

  // ---------- 由真實資料算出來的讀數 ----------
  const now = new Date()
  const today = todayString(now)
  const monthKey = today.slice(0, 7)
  const lastMonthKey = (() => {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
  })()
  const sumMonth = key => monthly.filter(r => r.month === key).reduce((s, r) => s + Number(r.total || 0), 0)
  const spend = {
    month: sumMonth(monthKey),
    last: sumMonth(lastMonthKey),
    all: monthly.reduce((s, r) => s + Number(r.total || 0), 0)
  }

  const logged = plan?.today?.loggedKcal ?? 0
  const target = plan?.today?.targetKcal ?? null
  const meals = plan?.meals ?? []
  const mealsDone = meals.filter(m => m.logged).length
  const share = target > 0 ? logged / target : null

  const months = featured?.birth_date ? ageInMonths(String(featured.birth_date).slice(0, 10)) : null
  const stage = featured ? lifeStage(featured.species, months) : null
  const trend = weightTrend(weights)
  const latestWeight = weights[weights.length - 1]
  const reminder = upcomingReminders(health, today)[0]
  const unread = notices.filter(n => !n.isRead).length
  const wk = weekInfo(now)

  const goto = href => navigate(href)

  // ---------- 圓盤：六個入口，每一個都是一組真實讀數 ----------
  const sections = [
    {
      zh: '寵物', en: 'Pets', href: '/pets',
      big: pets.length, unit: '隻',
      sub: pets.slice(0, 2).map(p => p.name).join('、') || '尚未新增'
    },
    {
      zh: '飲食', en: 'Diet', href: '/diet',
      big: plan ? n0(logged) : '—', unit: plan ? 'kcal' : '',
      sub: target ? `目標 ${n0(target)}` : plan ? '需先記錄體重' : '讀取中'
    },
    {
      zh: '健康', en: 'Health', href: '/health-consult',
      big: reminder ? reminder.daysLeft : '—', unit: reminder ? '天' : '',
      sub: reminder ? `${reminder.title} ${dotDateStr(reminder.date)}` : '沒有安排的提醒',
      alert: !!reminder && reminder.daysLeft <= 7
    },
    {
      zh: '週報', en: 'Report', href: '/weekly-report',
      big: wk.week, unit: '週', sub: wk.range
    },
    {
      zh: '監控', en: 'Camera', href: '/pet-cam',
      big: mood?.success ? mood.mainMood : '—', unit: '',
      sub: mood?.success ? `更新 ${hm(mood.updatedAt)}` : '最近沒有辨識紀錄'
    },
    {
      zh: '財務', en: 'Spend', href: '/expenses',
      big: n0(spend.month), unit: 'TWD', sub: `本月 ${monthKey.replace('-', '.')}`
    }
  ]
  const gauges = share !== null ? [{ label: '今日熱量', share }] : []
  const idle = featured
    ? { label: featured.name.slice(0, 6), big: plan ? n0(logged) : '—', unit: plan ? 'kcal' : '', sub: '今日已記錄' }
    : { label: 'PawCare', big: 0, unit: '隻', sub: '尚未新增寵物' }

  return (
    <div className="pc-home">
      <main className="pc-main">
        <div className="pc-head">
          <div className="pc-head-top">
            <span className="ef-eyebrow slash">PawCare / Overview</span>
            <button className="ef-btn small" type="button" aria-pressed={dark} onClick={toggleTheme}>深色</button>
          </div>
          <h1>
            {greeting(now)}，{user?.name || '主人'}{' '}<span className="ef-marker ef-in-stroke">總覽</span>
          </h1>
          <ul className="ef-facts ef-field">
            <li><time dateTime={today}>{dotDate(now)}</time></li>
            <li>寵物 {pets.length} 隻</li>
            {featured && <li>目前顯示 {featured.name}</li>}
            {featured && <li>未讀提醒 {unread} 則</li>}
          </ul>
          {pets.length > 1 && (
            <div className="pc-chips" role="group" aria-label="切換寵物">
              {pets.map(p => (
                <button
                  key={p.id}
                  type="button"
                  className="ef-chip"
                  aria-pressed={p.id === fid}
                  aria-label={`${p.name}（${SPECIES_ZH[p.species] || '其他'}）`}
                  onClick={() => setSearchParams({ pet: String(p.id) }, { replace: true })}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {loadingPets ? (
          <div className="ef-progress is-unknown" role="progressbar" aria-label="正在載入">
            <span className="ef-eyebrow">Loading / 載入中</span><i></i>
          </div>
        ) : petsError ? (
          <section className="ef-panel">
            <h2><span className="ef-pair"><span className="ef-eyebrow">Error</span><span>讀取失敗</span></span></h2>
            <p className="ef-notice" data-flag="錯誤">寵物資料讀取失敗，請確認網路連線後再試一次。</p>
            <p className="ef-actions"><button type="button" className="ef-btn go" onClick={() => refetchPets()}>重新讀取</button></p>
          </section>
        ) : !featured ? (
          <section className="ef-panel">
            <h2><span className="ef-pair"><span className="ef-eyebrow">Start</span><span>開始使用</span></span></h2>
            <p className="ef-empty">還沒有新增寵物。先建立第一隻，首頁就會開始顯示牠的餵食、體重和健康提醒。</p>
            <p className="ef-actions"><Link className="ef-btn go" to="/pets">新增寵物</Link></p>
          </section>
        ) : (
          <>
            <div className="pc-board">
              <div className="pc-orbit">
                <figure className="pc-hub">
                  <Dial label="快速入口" sections={sections} gauges={gauges} idle={idle} onNavigate={goto} />
                </figure>

                {/* 左上：今日餵食 */}
                <section className="ef-panel cut-br lead-right pc-l1 ef-in-power" style={{ '--i': 0 }}>
                  <h2><span className="ef-pair"><span className="ef-eyebrow">Diet</span><span>今日餵食</span></span> <Link to="/diet">飲食管理</Link></h2>
                  {plan && target ? (
                    <div className={figs(n0(logged), n0(target), `${mealsDone}/${meals.length}`)}>
                      <Link to="/diet"><Num value={n0(logged)} /><span>已記錄 kcal</span></Link>
                      <Link to="/diet"><Num value={n0(target)} /><span>目標 kcal</span></Link>
                      <Link to="/diet"><Num value={`${mealsDone}/${meals.length}`} /><span>餐次</span></Link>
                    </div>
                  ) : plan ? (
                    <p className="ef-notice" data-flag="缺體重">{featured.name} 還沒有體重，算不出每日熱量目標。<Link to={`/pets/${featured.id}`}>去記錄體重</Link></p>
                  ) : planError ? (
                    <p className="ef-notice" data-flag="錯誤">飲食計畫讀取失敗，請稍後再試。</p>
                  ) : (
                    <span className="ef-skeleton line"></span>
                  )}
                </section>

                {/* 右上：即時監控 */}
                <section className="ef-panel cut-bl tab-right pc-r1 ef-in-power" style={{ '--i': 0 }}>
                  <h2><span className="ef-pair"><span className="ef-eyebrow">Camera</span><span>即時監控</span></span> <Link to="/pet-cam">詳情</Link></h2>
                  {mood?.success ? (
                    <div className={figs(Number(mood.percentage), Number(mood.minutes))}>
                      <Link to="/pet-cam"><b className="pc-word">{mood.mainMood}</b><span>主要心情</span></Link>
                      <Link to="/pet-cam"><Num value={Number(mood.percentage)} /><span>佔比 %</span></Link>
                      <Link to="/pet-cam"><Num value={Number(mood.minutes)} /><span>取樣 分鐘</span></Link>
                    </div>
                  ) : (
                    <p className="ef-empty">{featured.name} 最近 10 分鐘沒有辨識紀錄。開啟即時監控後，牠的心情佔比會顯示在這裡。</p>
                  )}
                </section>

                {/* 左中：提醒 */}
                <section className="ef-panel lead-right pc-l2 ef-in-power" style={{ '--i': 1 }}>
                  <h2><span className="ef-pair"><span className="ef-eyebrow">Alerts</span><span>提醒</span></span></h2>
                  <div className={figs(unread, notices.length, reminder ? reminder.daysLeft : '—')}>
                    <a href="#notices" className={unread > 0 ? 'is-alert' : undefined}><Num value={unread} /><span>未讀</span></a>
                    <a href="#notices"><Num value={notices.length} /><span>近期通知</span></a>
                    <Link to="/health-consult" className={reminder && reminder.daysLeft <= 7 ? 'is-alert' : undefined}>
                      <Num value={reminder ? reminder.daysLeft : '—'} /><span>距提醒 天</span>
                    </Link>
                  </div>
                </section>

                {/* 右中：支出 */}
                <section className="ef-panel lead-left tab-right pc-r2 ef-in-power" style={{ '--i': 1 }}>
                  <h2><span className="ef-pair"><span className="ef-eyebrow">Spend</span><span>支出</span></span> <Link to="/expenses">財務管理</Link></h2>
                  <div className={figs(n0(spend.month), n0(spend.last), n0(spend.all))}>
                    <Link to="/expenses"><Num value={n0(spend.month)} /><span>本月 TWD</span></Link>
                    <Link to="/expenses"><Num value={n0(spend.last)} /><span>上月 TWD</span></Link>
                    <Link to="/expense-report"><Num value={n0(spend.all)} /><span>累計 TWD</span></Link>
                  </div>
                </section>

                {/* 左下：這隻寵物 */}
                <section className="ef-panel cut-tr pc-l3 ef-in-power" style={{ '--i': 2 }}>
                  <h2><span className="ef-pair"><span className="ef-eyebrow">Pet</span><span>{featured.name}</span></span> <Link to={`/pets/${featured.id}`}>詳細</Link></h2>
                  <ul className="ef-ledger">
                    <li><span>種類</span><span className="ef-field">{SPECIES_ZH[featured.species] || '其他'}{featured.breed ? ` ${featured.breed}` : ''}</span></li>
                    <li><span>年齡</span><span className="ef-field">{petAgeText(featured.birth_date) || '未設定生日'}</span></li>
                    <li><span>生命階段</span><span className="ef-field">{stage ? stage.label : '—'}</span></li>
                  </ul>
                </section>

                {/* 右下：體重 */}
                <section className="ef-panel cut-tl tab-right pc-r3 ef-in-power" style={{ '--i': 2 }}>
                  <h2><span className="ef-pair"><span className="ef-eyebrow">Weight</span><span>體重</span></span> <Link to={`/pets/${featured.id}`}>曲線</Link></h2>
                  {latestWeight ? (
                    <ul className="ef-ledger">
                      <li><span>目前</span><span className="ef-field">{formatKg(latestWeight.weight)} kg</span></li>
                      <li>
                        <span>{trend ? `近 ${trend.spanDays} 天` : '變化'}</span>
                        <span className={`ef-field${trend && Math.abs(trend.pct) >= 10 && stage?.key !== 'young' ? ' warn' : ''}`}>
                          {trend ? `${trend.delta > 0 ? '+' : ''}${formatKg(trend.delta)} kg` : '再記錄一次就能比較'}
                        </span>
                      </li>
                      <li><span>最近記錄</span><span className="ef-field">{dotDateStr(latestWeight.measured_on)}</span></li>
                    </ul>
                  ) : (
                    <p className="ef-empty">{featured.name} 還沒有體重紀錄。記錄之後，這裡會顯示變化。</p>
                  )}
                </section>
              </div>
            </div>

            <div className="pc-cols">
              <section className="ef-panel">
                <h2><span className="ef-pair"><span className="ef-eyebrow">Roster</span><span>寵物名冊</span></span> <Link to="/pets">全部寵物</Link></h2>
                <ul className="ef-rows">
                  {pets.map(p => {
                    const st = lifeStage(p.species, p.birth_date ? ageInMonths(String(p.birth_date).slice(0, 10)) : null)
                    return (
                      <li key={p.id}>
                        <div>
                          <div>{p.name} {st && <span className="ef-state">{st.label}</span>}</div>
                          <div className="meta">
                            <span>{SPECIES_ZH[p.species] || '其他'}{p.breed ? ` ${p.breed}` : ''}</span>
                            <span>{petAgeText(p.birth_date) || '未設定生日'}</span>
                            {p.weight && <span>{formatKg(p.weight)} kg</span>}
                          </div>
                        </div>
                        <div className="acts">
                          <Link className="ef-btn small" to={`/dashboard?pet=${p.id}`} replace aria-label={`首頁改為顯示 ${p.name}`}>切換</Link>
                          <Link className="ef-btn small" to={`/pets/${p.id}`}>詳細</Link>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </section>

              <section className="ef-panel" id="notices">
                <h2><span className="ef-pair"><span className="ef-eyebrow">Notices</span><span>{featured.name} 的通知</span></span></h2>
                {notices.length === 0 ? (
                  <p className="ef-empty">目前沒有通知。有新的提醒時，會依序列在這裡。</p>
                ) : (
                  <ul className="ef-rows">
                    {notices.slice(0, 4).map(n => (
                      <li key={n.id}>
                        <div>
                          <div>{n.title} {!n.isRead && <span className="ef-state is-alert">未讀</span>}</div>
                          <div className="meta"><span>{dotDateStr(n.createdAt)} {hm(n.createdAt)}</span></div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="ef-actions">
                  <Link className="ef-btn go" to="/diet">記錄餵食</Link>
                  <Link className="ef-btn" to="/health-consult">健康諮詢</Link>
                </p>
              </section>
            </div>
          </>
        )}
      </main>
    </div>
  )
}