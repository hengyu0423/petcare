import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { petAgeText, ageInMonths } from '../lib/petAge'
import { lifeStage, humanAgeYears, nextBirthday, weightTrend, formatKg, todayString } from '../lib/petInsights'
import WeightCard from '../components/pets/WeightCard'
import HealthCard, { useHealthRecords, upcomingReminders } from '../components/pets/HealthCard'

const EMOJI   = { dog:'🐶', cat:'🐱', bird:'🐦', rabbit:'🐰', fish:'🐟', other:'🐾' }
const SPECIES = [['dog','狗'],['cat','貓'],['bird','鳥'],['rabbit','兔子'],['fish','魚'],['other','其他']]
const GENDER  = [['male','男'],['female','女'],['unknown','不明']]
const SPECIES_MAP = Object.fromEntries(SPECIES)
const GENDER_MAP  = Object.fromEntries(GENDER)

const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-400 focus:bg-white transition-all"

// 編輯資料用的彈出視窗：按 Esc 或點背景關閉
function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = e => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <div
        role="dialog" aria-modal="true" aria-label={title}
        onClick={e => e.stopPropagation()}
        className="w-full sm:max-w-lg max-h-[90dvh] overflow-y-auto bg-white rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-800">{title}</h2>
          <button onClick={onClose} aria-label="關閉" className="p-1.5 -mr-1.5 rounded-lg text-gray-400 hover:bg-gray-100">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// 有 onClick 就變成可以點的按鈕（右上角顯示箭頭）
function StatTile({ label, value, sub, tone = 'text-gray-800', onClick, hint }) {
  const body = (
    <>
      <p className="flex items-center justify-between text-[11px] font-semibold text-gray-400">
        {label}
        {onClick && <span aria-hidden="true" className="text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-green-500">›</span>}
      </p>
      <p className={`mt-1 text-lg font-bold leading-tight ${tone}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
    </>
  )

  if (!onClick) {
    return <div className="rounded-2xl border border-gray-200 bg-white p-4">{body}</div>
  }
  return (
    <button
      type="button" onClick={onClick} title={hint} aria-label={`${label}：${value}${hint ? `（${hint}）` : ''}`}
      className="group rounded-2xl border border-gray-200 bg-white p-4 text-left transition-all hover:border-green-300 hover:shadow-sm active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-green-400"
    >
      {body}
    </button>
  )
}

// 幾分鐘前 → 文字
function timeAgo(minutes) {
  if (minutes === null || minutes === undefined) return ''
  if (minutes < 1) return '剛剛'
  if (minutes < 60) return `${minutes} 分鐘前`
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)} 小時前`
  if (minutes < 60 * 24 * 30) return `${Math.floor(minutes / 1440)} 天前`
  return `${Math.floor(minutes / 43200)} 個月前`
}

// AI 回覆是 Markdown：去掉符號、只留前面一小段
const snippet = (text, max) => {
  const plain = String(text || '').replace(/[#*_>`|]/g, '').replace(/^\s*[-•]\s*/gm, '').replace(/\s+/g, ' ').trim()
  return plain.length > max ? `${plain.slice(0, max)}…` : plain
}

const SEVERITY = {
  normal:    { label: '一般建議',     cls: 'bg-green-50 text-green-700 border-green-200' },
  urgent:    { label: '建議儘快就醫', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  emergency: { label: '緊急',         cls: 'bg-red-50 text-red-600 border-red-200' },
}

function RecentCard({ icon, title, link, linkText, children }) {
  return (
    <div className="flex flex-col rounded-xl bg-gray-50 p-4">
      <p className="text-xs font-semibold text-gray-500">{icon} {title}</p>
      <div className="mt-2 flex-1">{children}</div>
      <Link to={link} className="mt-3 self-start text-xs font-medium text-green-600 hover:underline">{linkText} →</Link>
    </div>
  )
}

// 近況：最後一次健康諮詢 + 即時監控的心情／行為
function RecentSection({ petId, data, isLoading }) {
  const c = data?.consultation
  const m = data?.mood
  const sev = c?.severity ? SEVERITY[c.severity] : null

  return (
    <section className="bg-white rounded-2xl border border-gray-200 p-5" aria-label="近況">
      <h2 className="text-sm font-bold text-gray-800">近況</h2>
      {isLoading ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="h-28 animate-pulse rounded-xl bg-gray-100" />
          <div className="h-28 animate-pulse rounded-xl bg-gray-100" />
        </div>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <RecentCard
            icon="🏥" title="最近一次健康諮詢"
            link={`/health-consult?pet=${petId}`} linkText={c ? '繼續諮詢' : '問問 AI'}
          >
            {c ? (
              <>
                <div className="flex flex-wrap items-center gap-1.5">
                  {sev && <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${sev.cls}`}>{sev.label}</span>}
                  <span className="text-[11px] text-gray-400">{timeAgo(c.minutesAgo)}</span>
                </div>
                <p className="mt-1.5 text-sm font-medium text-gray-800">「{snippet(c.question, 40)}」</p>
                {c.reply && <p className="mt-1 text-xs leading-relaxed text-gray-500">{snippet(c.reply, 70)}</p>}
              </>
            ) : (
              <p className="text-sm text-gray-400">還沒有諮詢紀錄。有任何健康問題都可以問 AI。</p>
            )}
          </RecentCard>

          <RecentCard
            icon="📹" title="心情與行為"
            link={m ? '/pet-cam' : '/pet-emotion'} linkText={m ? '查看即時監控' : '用照片辨識心情'}
          >
            {m ? (
              <>
                <p className="text-[11px] text-gray-400">最後偵測：{timeAgo(m.latest.minutesAgo)}</p>
                <p className="mt-1 text-lg font-bold text-gray-800">{m.latest.mood}</p>
                {m.latest.behavior && <p className="text-xs text-gray-500">{m.latest.behavior}</p>}
                {m.day && (
                  <p className="mt-1.5 text-xs text-gray-500">
                    近 24 小時多半是 <span className="font-semibold text-gray-700">{m.day.mainMood}</span>（{m.day.percentage}%）
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-400">這隻寵物還沒有監控紀錄。也可以上傳照片讓 AI 判斷心情。</p>
            )}
          </RecentCard>
        </div>
      )}
    </section>
  )
}

const scrollToId = id =>
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

const twd = n => `TWD ${Math.round(n).toLocaleString()}`

export default function PetDetailPage() {
  const { id } = useParams()
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(null)

  const { data: pets = [], isLoading } = useQuery({
    queryKey: ['pets'],
    queryFn: () => api.get('/pets').then(r => r.data.data)
  })

  const pet = pets.find(p => String(p.id) === id)

  // 與下方的卡片共用同一組查詢（key 相同，只會發一次請求）
  const { data: health = [] } = useHealthRecords(pet?.id)
  const { data: weights = [] } = useQuery({
    queryKey: ['pet-weights', pet?.id],
    queryFn: async () => (await api.get(`/pets/${pet.id}/weights`)).data.data,
    enabled: !!pet
  })
  const { data: expenses = [] } = useQuery({
    queryKey: ['pet-expenses', pet?.id],
    queryFn: async () => (await api.get(`/expenses/pet/${pet.id}`)).data.data,
    enabled: !!pet
  })
  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ['pet-overview', pet?.id],
    queryFn: async () => (await api.get(`/pets/${pet.id}/overview`)).data.data,
    enabled: !!pet
  })

  const updatePet = useMutation({
    mutationFn: payload => api.put(`/pets/${id}`, payload),
    onSuccess: () => {
      // 改了生日會影響年齡、飲食計畫等，所以全部重新抓
      qc.invalidateQueries()
      setEditing(false)
    }
  })

  const today = todayString()
  const birthDate = pet?.birth_date ? String(pet.birth_date).slice(0, 10) : null
  const months = birthDate ? ageInMonths(birthDate) : null
  const stage = pet ? lifeStage(pet.species, months) : null
  const human = pet ? humanAgeYears(pet.species, months) : null
  const birthday = nextBirthday(birthDate, today)
  const trend = useMemo(() => weightTrend(weights), [weights])
  const reminder = upcomingReminders(health, today)[0]

  let spendMonth = 0, spendYear = 0
  for (const e of expenses) {
    const d = String(e.date || '').slice(0, 10), amt = Number(e.amount) || 0
    if (d.startsWith(today.slice(0, 7))) spendMonth += amt
    if (d.startsWith(today.slice(0, 4))) spendYear += amt
  }
  const spend = { month: spendMonth, year: spendYear }

  const startEdit = () => {
    setForm({
      name:      pet.name,
      species:   pet.species,
      breed:     pet.breed || '',
      gender:    pet.gender || 'unknown',
      birthDate: birthDate || '',
      notes:     pet.notes || '',
    })
    setEditing(true)
  }

  // 體重不在這裡改（走成長曲線卡片），避免「目前體重」跟紀錄對不上
  const handleSave = (e) => {
    e.preventDefault()
    updatePet.mutate(form)
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  if (isLoading) return <div className="p-8 text-center text-sm text-gray-400">載入中…</div>

  if (!pet) return (
    <div className="p-8 text-center">
      <p className="text-5xl mb-4">🔍</p>
      <p className="text-gray-400 mb-4">找不到這隻寵物</p>
      <Link to="/pets" className="text-green-500 hover:underline text-sm font-medium">← 返回列表</Link>
    </div>
  )

  const age = petAgeText(pet.birth_date)

  return (
    <div className="p-4 sm:p-6 max-w-3xl">
      <Link to="/pets" className="text-sm text-green-500 hover:underline font-medium mb-5 inline-block">
        ← 返回列表
      </Link>

      <div className="space-y-4">
        {/* 頂部：頭像、名字、標籤 */}
        <header className="relative bg-white rounded-2xl border border-gray-200 p-6 text-center">
          <button onClick={startEdit}
            className="absolute right-4 top-4 bg-white border border-gray-200 text-green-500 hover:bg-green-50 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors">
            ✏️ 編輯資料
          </button>
          <div className="text-7xl mb-3" aria-hidden="true">{EMOJI[pet.species] || '🐾'}</div>
          <h1 className="text-2xl font-bold text-gray-800">{pet.name}</h1>
          {pet.breed && <p className="text-gray-400 text-sm mt-1">{pet.breed}</p>}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-xs text-gray-600">
              {SPECIES_MAP[pet.species]}
              {pet.gender && pet.gender !== 'unknown' ? ` ・ ${GENDER_MAP[pet.gender]}` : ''}
            </span>
            {stage && (
              <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${stage.cls}`}>
                {stage.emoji} {stage.label}
              </span>
            )}
            {birthday?.isToday && (
              <span className="rounded-full border border-pink-200 bg-pink-50 px-2.5 py-0.5 text-xs font-medium text-pink-600">
                🎂 今天生日！
              </span>
            )}
          </div>
          {pet.notes && (
            <p className="mx-auto mt-4 max-w-md rounded-xl bg-gray-50 px-4 py-3 text-left text-sm text-gray-600 whitespace-pre-line">
              <span className="mr-1 text-xs font-semibold text-gray-400">備註</span>
              {pet.notes}
            </p>
          )}
        </header>

        {/* 重點數字 */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="重點數字">
          <StatTile
            label="年齡"
            value={age || '未設定生日'}
            sub={human !== null ? `約相當於人類 ${human} 歲（概略）` : !birthDate ? '點一下設定生日' : null}
            onClick={!birthDate ? startEdit : undefined}
            hint="設定生日"
          />
          <StatTile
            label="目前體重"
            value={pet.weight ? `${formatKg(pet.weight)} kg` : '未記錄'}
            sub={
              trend
                ? `近 ${trend.spanDays} 天 ${trend.delta > 0 ? '+' : ''}${formatKg(trend.delta)} kg`
                : pet.weight ? '再記錄幾次就能看到變化' : '點一下記錄體重'
            }
            tone={
              trend && Math.abs(trend.pct) >= 10 && stage?.key !== 'young' ? 'text-amber-600' : 'text-gray-800'
            }
            onClick={() => scrollToId('weight-card')}
            hint="查看成長曲線"
          />
          <StatTile
            label="下次生日"
            value={
              birthday
                ? birthday.isToday ? '就是今天 🎂' : `還有 ${birthday.daysUntil} 天`
                : '—'
            }
            sub={birthday ? `${birthday.date.slice(5).replace('-', '/')} ・ 滿 ${birthday.turning} 歲` : '設定生日後顯示'}
            onClick={!birthDate ? startEdit : undefined}
            hint="設定生日"
          />
          <StatTile
            label="下次提醒"
            value={reminder ? (reminder.daysLeft === 0 ? '就是今天' : `${reminder.daysLeft} 天後`) : '沒有安排'}
            sub={reminder ? reminder.title : '新增疫苗、回診日期就會提醒'}
            tone={reminder && reminder.daysLeft <= 7 ? 'text-amber-600' : 'text-gray-800'}
            onClick={() => scrollToId('health-card')}
            hint="查看健康紀錄"
          />
        </div>

        <RecentSection petId={pet.id} data={overview} isLoading={overviewLoading} />

        <WeightCard pet={pet} />

        <HealthCard petId={pet.id} />

        {/* 花費摘要 */}
        <section className="bg-white rounded-2xl border border-gray-200 p-5" aria-label="花費摘要">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-800">花費摘要</h2>
            <Link to="/expenses" className="text-xs font-medium text-green-600 hover:underline">查看財務管理 →</Link>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-gray-50 p-3">
              <p className="text-[11px] text-gray-400">本月</p>
              <p className="mt-0.5 text-base font-bold text-gray-800">{twd(spend.month)}</p>
            </div>
            <div className="rounded-xl bg-gray-50 p-3">
              <p className="text-[11px] text-gray-400">今年累計</p>
              <p className="mt-0.5 text-base font-bold text-gray-800">{twd(spend.year)}</p>
            </div>
          </div>
        </section>

        {/* 編輯資料（彈出視窗） */}
        {editing && (
          <Modal title="編輯資料" onClose={() => setEditing(false)}>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">名字</label>
                <input required value={form.name} onChange={e => set('name', e.target.value)} className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">種類</label>
                  <select value={form.species} onChange={e => set('species', e.target.value)} className={inputCls}>
                    {SPECIES.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">性別</label>
                  <select value={form.gender} onChange={e => set('gender', e.target.value)} className={inputCls}>
                    {GENDER.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">品種</label>
                <input value={form.breed} onChange={e => set('breed', e.target.value)} placeholder="選填" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">生日</label>
                <input type="date" max={today} value={form.birthDate} onChange={e => set('birthDate', e.target.value)} className={inputCls} />
              </div>
              <p className="-mt-2 text-[11px] text-gray-400">體重請在頁面上的「體重與成長曲線」記錄，每筆都會留下日期。</p>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">備註</label>
                <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} placeholder="選填" className={`${inputCls} resize-none`} />
              </div>
              {updatePet.isError && (
                <p role="alert" className="text-xs text-red-500">
                  {updatePet.error?.response?.data?.error || '儲存失敗，請稍後再試'}
                </p>
              )}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setEditing(false)}
                  className="flex-1 border border-gray-200 rounded-lg py-2.5 text-sm text-gray-500 hover:bg-gray-50 font-medium transition-colors">取消</button>
                <button type="submit" disabled={updatePet.isPending}
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white rounded-lg py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 shadow-sm">
                  {updatePet.isPending ? '儲存中...' : '儲存'}
                </button>
              </div>
            </form>
          </Modal>
        )}
      </div>
    </div>
  )
}