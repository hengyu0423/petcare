import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { petAgeText, ageInMonths } from '../lib/petAge'
import {
  lifeStage, humanAgeYears, nextBirthday, weightTrend, formatKg, todayString
} from '../lib/petInsights'
import WeightCard from '../components/pets/WeightCard'
import HealthCard from '../components/pets/HealthCard'
import { useHealthRecords, upcomingReminders } from '../lib/petHealth'
import PetIcon from '../components/brand/PetIcon'

const SPECIES = [['dog', '狗'], ['cat', '貓'], ['bird', '鳥'], ['rabbit', '兔子'], ['fish', '魚'], ['other', '其他']]
const GENDER = [['male', '男'], ['female', '女'], ['unknown', '不明']]
const SPECIES_MAP = Object.fromEntries(SPECIES)
const GENDER_MAP = Object.fromEntries(GENDER)

// 生命階段：暖色系標籤（與「我的寵物」一致）
const STAGE_CLS = {
  young:  'bg-[#eaf1f4] text-[#3f6b7a] border-[#d5e4ea]',
  adult:  'bg-pine-50 text-pine-700 border-pine-100',
  senior: 'bg-[#fdf3e3] text-[#c96f2e] border-[#f0d9b5]'
}

const fieldCls = "w-full border border-[#eae6d8] rounded-xl px-3 py-2.5 text-sm bg-[#faf7ef] text-ink placeholder:text-ink-soft/60 focus:outline-none focus:ring-2 focus:ring-pine-700/35 focus:border-pine-700/40 focus:bg-plate transition-all"
const labelCls = "mb-1.5 block text-[12px] font-semibold text-ink-soft"

const asRows = value => {
  if (Array.isArray(value)) return value
  if (!value || typeof value !== 'object') return []
  if (Array.isArray(value.rows)) return value.rows
  return []
}

function StatTile({ label, value, sub, tone = 'text-pine-900' }) {
  return (
    <div className="rounded-2xl border border-[#f3e3cd] bg-plate p-4">
      <p className="text-[11px] font-semibold text-ink-soft/85">{label}</p>
      <p className={`mt-1 text-[17px] font-bold leading-tight ${tone}`}>{value}</p>
      {sub && <p className="mt-1 text-[11px] leading-relaxed text-ink-soft">{sub}</p>}
    </div>
  )
}

const twd = n => `TWD ${Math.round(n).toLocaleString()}`

export default function PetDetailPage() {
  const { id } = useParams()
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(null)

  const { data: pets = [], isLoading } = useQuery({
    queryKey: ['pets'],
    queryFn: () => api.get('/pets').then(r => asRows(r.data?.data))
  })

  const pet = pets.find(p => String(p.id) === id)

  // 與下方的卡片共用同一組查詢（key 相同，只會發一次請求）
  const { data: health = [] } = useHealthRecords(pet?.id)
  const { data: weights = [] } = useQuery({
    queryKey: ['pet-weights', pet?.id],
    queryFn: async () => asRows((await api.get(`/pets/${pet.id}/weights`)).data?.data),
    enabled: !!pet
  })
  const { data: expenses = [] } = useQuery({
    queryKey: ['pet-expenses', pet?.id],
    queryFn: async () => asRows((await api.get(`/expenses/pet/${pet.id}`)).data?.data),
    enabled: !!pet
  })

  const updatePet = useMutation({
    mutationFn: payload => api.put(`/pets/${id}`, payload),
    onSuccess: () => {
      // 改了體重會同時新增一筆今天的紀錄，所以曲線、飲食計畫也要一起更新
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
  const trend = weightTrend(weights)
  const reminder = upcomingReminders(health, today)[0]

  const spend = { month: 0, year: 0 }
  for (const e of expenses) {
    const d = String(e.date || '').slice(0, 10), amt = Number(e.amount) || 0
    if (d.startsWith(today.slice(0, 7))) spend.month += amt
    if (d.startsWith(today.slice(0, 4))) spend.year += amt
  }

  const startEdit = () => {
    setForm({
      name: pet.name,
      species: pet.species,
      breed: pet.breed || '',
      gender: pet.gender || 'unknown',
      birthDate: birthDate || '',
      weight: pet.weight || '',
      notes: pet.notes || '',
    })
    setEditing(true)
  }

  const handleSave = (e) => {
    e.preventDefault()
    updatePet.mutate({ ...form, weight: form.weight ? Number(form.weight) : null })
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  if (isLoading) return <div className="px-6 py-16 text-center text-sm text-ink-soft">載入中…</div>

  if (!pet) return (
    <div className="px-6 py-16 text-center">
      <div className="mx-auto w-fit">
        <PetIcon species="other" size={64} />
      </div>
      <p className="mt-4 text-sm text-ink-soft">找不到這隻寵物</p>
      <Link
        to="/pets"
        className="mt-4 inline-block rounded-2xl border border-line bg-plate px-4 py-2 text-sm font-semibold text-pine-800 transition-colors hover:bg-[#fdf6ea]"
      >
        ← 返回列表
      </Link>
    </div>
  )

  const age = petAgeText(pet.birth_date)

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-8 md:py-8">
      <Link
        to="/pets"
        className="mb-4 inline-flex items-center gap-1.5 rounded-xl text-[13px] font-semibold text-ink-soft transition-colors hover:text-pine-900"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 6l-6 6 6 6" />
        </svg>
        返回列表
      </Link>

      <div className="space-y-4">
        {/* 頂部：頭像、名字、標籤 + 編輯按鈕 */}
        <header className="relative overflow-hidden rounded-3xl border border-[#f3e3cd] bg-[#fdf6ea] p-5 md:p-6">
          <div aria-hidden="true" className="absolute -right-12 -top-14 h-40 w-40 rounded-full bg-[#f7e6c8]/80" />
          <div aria-hidden="true" className="absolute -bottom-16 -left-10 h-32 w-32 rounded-full bg-[#f2ead8]/70" />

          <div className="relative flex flex-wrap items-center gap-4 md:gap-5">
            <PetIcon species={pet.species} size={84} className="h-[72px] w-[72px] shrink-0 md:h-[84px] md:w-[84px]" />

            <div className="min-w-0 flex-1">
              <h1 className="font-brand text-2xl font-extrabold leading-tight text-pine-900">{pet.name}</h1>
              <p className="mt-0.5 text-[13px] text-ink-soft">
                {pet.breed || SPECIES_MAP[pet.species]}
                {age ? ` ・ ${age}` : ''}
              </p>

              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <span className="rounded-full border border-[#e8d9bd] bg-plate px-2.5 py-0.5 text-[11px] font-medium text-ink-soft">
                  {SPECIES_MAP[pet.species]}
                  {pet.gender && pet.gender !== 'unknown' ? ` ・ ${GENDER_MAP[pet.gender]}` : ''}
                </span>
                {stage && (
                  <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${STAGE_CLS[stage.key] || STAGE_CLS.adult}`}>
                    {stage.label}
                  </span>
                )}
                {birthday?.isToday && (
                  <span className="rounded-full border border-[#e8a33d] bg-[#ffb31f] px-2.5 py-0.5 text-[11px] font-bold text-[#4a3200]">
                    今天生日！
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={startEdit}
              className="flex shrink-0 items-center gap-1.5 rounded-2xl border border-[#e8d9bd] bg-plate px-3.5 py-2 text-xs font-bold text-pine-800 transition-colors hover:bg-[#fffdf6]"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3Z" />
                <path d="M14.5 6.5l3 3" />
              </svg>
              編輯
            </button>
          </div>
        </header>

        {/* 編輯 Modal */}
        {editing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-pine-900/35 p-4 backdrop-blur-sm">
            <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl border border-[#f0e6d2] bg-plate p-6 shadow-[0_30px_60px_-30px_rgba(87,54,17,0.55)]">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-base font-bold text-pine-900">編輯資料</h2>
                <button
                  onClick={() => setEditing(false)}
                  aria-label="關閉"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-[#fdf6ea] hover:text-pine-900"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>
              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className={labelCls}>名字</label>
                  <input required value={form.name} onChange={e => set('name', e.target.value)} className={fieldCls} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>種類</label>
                    <select value={form.species} onChange={e => set('species', e.target.value)} className={fieldCls}>
                      {SPECIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>性別</label>
                    <select value={form.gender} onChange={e => set('gender', e.target.value)} className={fieldCls}>
                      {GENDER.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>品種</label>
                  <input value={form.breed} onChange={e => set('breed', e.target.value)} placeholder="選填" className={fieldCls} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>生日</label>
                    <input type="date" max={today} value={form.birthDate} onChange={e => set('birthDate', e.target.value)} className={fieldCls} />
                  </div>
                  <div>
                    <label className={labelCls}>體重 (kg)</label>
                    <input type="number" step="0.01" min="0.01" max="200" value={form.weight} onChange={e => set('weight', e.target.value)} placeholder="選填" className={fieldCls} />
                  </div>
                </div>
                <p className="-mt-2 text-[11px] text-ink-soft">改了體重會同時新增一筆今天的體重紀錄，成長曲線也會更新。</p>
                <div>
                  <label className={labelCls}>備注</label>
                  <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} placeholder="選填" className={`${fieldCls} resize-none`} />
                </div>
                {updatePet.isError && (
                  <p role="alert" className="text-xs text-[#b4552f]">
                    {updatePet.error?.response?.data?.error || '儲存失敗，請稍後再試'}
                  </p>
                )}
                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    className="flex-1 rounded-xl border border-line py-2.5 text-sm font-semibold text-ink-soft transition-colors hover:bg-[#fdf6ea]"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={updatePet.isPending}
                    className="flex-1 rounded-xl bg-[#f5c04a] py-2.5 text-sm font-extrabold text-pine-900 shadow-[0_5px_0_#c96f2e] transition-all hover:bg-[#f0b23a] active:translate-y-[3px] active:shadow-none disabled:opacity-50"
                  >
                    {updatePet.isPending ? '儲存中...' : '儲存'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 重點數字 */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="重點數字">
          <StatTile
            label="年齡"
            value={age || '未設定生日'}
            sub={human !== null ? `約相當於人類 ${human} 歲（概略）` : !birthDate ? '編輯資料後可設定' : null}
          />
          <StatTile
            label="目前體重"
            value={pet.weight ? `${formatKg(pet.weight)} kg` : '未記錄'}
            sub={
              trend
                ? `近 ${trend.spanDays} 天 ${trend.delta > 0 ? '+' : ''}${formatKg(trend.delta)} kg`
                : pet.weight ? '再記錄幾次就能看到變化' : '下方可以記錄體重'
            }
            tone={
              trend && Math.abs(trend.pct) >= 10 && stage?.key !== 'young' ? 'text-[#c96f2e]' : 'text-pine-900'
            }
          />
          <StatTile
            label="下次生日"
            value={
              birthday
                ? birthday.isToday ? '就是今天' : `還有 ${birthday.daysUntil} 天`
                : '—'
            }
            sub={birthday ? `${birthday.date.slice(5).replace('-', '/')} ・ 滿 ${birthday.turning} 歲` : '設定生日後顯示'}
          />
          <StatTile
            label="下次提醒"
            value={reminder ? (reminder.daysLeft === 0 ? '就是今天' : `${reminder.daysLeft} 天後`) : '沒有安排'}
            sub={reminder ? reminder.title : '新增疫苗、回診日期就會提醒'}
            tone={reminder && reminder.daysLeft <= 7 ? 'text-[#c96f2e]' : 'text-pine-900'}
          />
        </div>

        <WeightCard pet={pet} />

        <HealthCard petId={pet.id} />

        {/* 花費摘要 */}
        <section className="rounded-3xl border border-[#f3e3cd] bg-plate p-5" aria-label="花費摘要">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-pine-900">花費摘要</h2>
            <Link to="/expenses" className="text-xs font-semibold text-pine-700 hover:underline">
              查看財務管理 →
            </Link>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-[#faf7ef] p-3.5">
              <p className="text-[11px] text-ink-soft">本月</p>
              <p className="mt-0.5 text-base font-bold tabular-nums text-pine-900">{twd(spend.month)}</p>
            </div>
            <div className="rounded-2xl bg-[#faf7ef] p-3.5">
              <p className="text-[11px] text-ink-soft">今年累計</p>
              <p className="mt-0.5 text-base font-bold tabular-nums text-pine-900">{twd(spend.year)}</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
