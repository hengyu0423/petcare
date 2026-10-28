import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Dog,
  Cat,
  Bird,
  Fish,
  Rabbit,
  PawPrint,
  ArrowLeft,
  Edit3,
  Calendar,
  Scale,
  Bell,
  Heart,
  Cake,
  Check,
  ChevronRight
} from 'lucide-react'
import { api } from '../lib/api'
import { petAgeText, ageInMonths } from '../lib/petAge'
import {
  lifeStage, humanAgeYears, nextBirthday, weightTrend, formatKg, todayString
} from '../lib/petInsights'
import WeightCard from '../components/pets/WeightCard'
import HealthCard from '../components/pets/HealthCard'
import { useHealthRecords, upcomingReminders } from '../lib/petHealth'

const SPECIES_ICONS = {
  dog: Dog,
  cat: Cat,
  bird: Bird,
  rabbit: Rabbit,
  fish: Fish,
  other: PawPrint
}

const SPECIES = [['dog', '狗狗'], ['cat', '貓咪'], ['bird', '鳥類'], ['rabbit', '兔子'], ['fish', '魚類'], ['other', '其他']]
const GENDER = [['male', '公 (男)'], ['female', '母 (女)'], ['unknown', '不明']]
const SPECIES_MAP = Object.fromEntries(SPECIES)
const GENDER_MAP = Object.fromEntries(GENDER)

function getSpeciesIcon(species, props = {}) {
  const Icon = SPECIES_ICONS[species?.toLowerCase()] || PawPrint
  return <Icon {...props} />
}

const inputCls = "w-full border border-[var(--ef-rule)] bg-[var(--ef-panel)] focus:border-[var(--ef-ink)] px-3 py-2 text-xs text-[var(--ef-ink)] font-mono focus:outline-none transition-colors"

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

  const updatePet = useMutation({
    mutationFn: payload => api.put(`/pets/${id}`, payload),
    onSuccess: () => {
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

  if (isLoading) {
    return (
      <div className="ef-progress is-unknown max-w-xl mx-auto my-16" role="progressbar" aria-label="載入個體詳細檔案中">
        <span className="ef-eyebrow">Loading / 載入個體詳細檔案</span>
        <i></i>
      </div>
    )
  }

  if (!pet) {
    return (
      <div className="p-12 text-center max-w-md mx-auto space-y-4">
        <div className="w-12 h-12 mx-auto bg-[var(--ef-ink)] text-[var(--ef-signal)] flex items-center justify-center"
          style={{ clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%)' }}
        >
          <PawPrint size={24} strokeWidth={2} />
        </div>
        <p className="text-sm font-bold text-[var(--ef-ink)]">查無此寵物檔案</p>
        <Link to="/pets" className="ef-btn small">
          <ArrowLeft size={14} /> 返回寵物列表
        </Link>
      </div>
    )
  }

  const age = petAgeText(pet.birth_date)

  return (
    <div className="ef pc-home min-h-full p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">

      {/* 頂部導航指示 */}
      <div className="flex items-center justify-between pb-3 border-b border-[var(--ef-rule)]">
        <Link
          to="/pets"
          className="ef-btn small flex items-center gap-1.5"
        >
          <ArrowLeft size={13} strokeWidth={2.5} />
          <span>返回寵物名冊</span>
        </Link>

        <div className="flex items-center gap-2">
          <Link
            to={`/dashboard?pet=${pet.id}`}
            className="ef-btn small go"
          >
            設為首頁關注
          </Link>
        </div>
      </div>

      <div className="space-y-6">

        {/* 頂部檔案主看板 (Endfield Panel) */}
        <section className="ef-panel cut-br p-6 border border-[var(--ef-rule)] bg-[var(--ef-panel)] relative overflow-hidden">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
            {/* 墨底切角頭像 */}
            <div
              className="w-18 h-18 bg-[var(--ef-ink)] text-[var(--ef-panel)] flex items-center justify-center shrink-0 shadow-sm"
              style={{
                clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%)'
              }}
            >
              {getSpeciesIcon(pet.species, { size: 36, strokeWidth: 2, className: 'text-[var(--ef-signal)]' })}
            </div>

            <div className="flex-1 text-center sm:text-left min-w-0">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-black text-[var(--ef-ink)] tracking-tight">
                  {pet.name}
                </h1>
                <span className="ef-tag text-xs font-mono font-bold">
                  {SPECIES_MAP[pet.species]}
                  {pet.gender && pet.gender !== 'unknown' ? ` · ${GENDER_MAP[pet.gender]}` : ''}
                </span>
                {stage && (
                  <span className="ef-state text-xs font-mono font-bold">
                    {stage.label}
                  </span>
                )}
              </div>

              {pet.breed && (
                <p className="text-xs text-[var(--ef-ink-2)] font-mono mt-1">
                  // BREED: {pet.breed}
                </p>
              )}

              {birthday?.isToday && (
                <div className="mt-2.5 inline-flex items-center gap-1.5 px-2 py-0.5 bg-[var(--ef-signal)] text-[var(--ef-on-signal)] text-xs font-mono font-bold">
                  <Cake size={13} strokeWidth={2.5} />
                  <span>今天生日！HAPPY BIRTHDAY</span>
                </div>
              )}
            </div>

            {!editing && (
              <button
                type="button"
                onClick={startEdit}
                className="ef-btn small flex items-center gap-1.5 shrink-0"
              >
                <Edit3 size={13} strokeWidth={2} />
                <span>編輯資料</span>
              </button>
            )}
          </div>
        </section>

        {/* 4 個關鍵指標讀數看板 (Endfield Figures) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" aria-label="重點數據">
          {/* 年齡 */}
          <div className="ef-panel p-3.5 border border-[var(--ef-rule)] bg-[var(--ef-panel)]">
            <p className="text-[10px] font-mono text-[var(--ef-ink-2)] uppercase">// AGE / 年齡</p>
            <p className="mt-1 text-base sm:text-lg font-black font-mono text-[var(--ef-ink)]">
              {age || '未設定'}
            </p>
            <p className="mt-1 text-[11px] text-[var(--ef-ink-2)] font-mono truncate">
              {human !== null ? `相當人類 ${human} 歲` : '尚未填寫生日'}
            </p>
          </div>

          {/* 體重 */}
          <div className="ef-panel p-3.5 border border-[var(--ef-rule)] bg-[var(--ef-panel)]">
            <p className="text-[10px] font-mono text-[var(--ef-ink-2)] uppercase">// WEIGHT / 體重</p>
            <p className="mt-1 text-base sm:text-lg font-black font-mono text-[var(--ef-ink)]">
              {pet.weight ? `${formatKg(pet.weight)} kg` : '未記錄'}
            </p>
            <p className="mt-1 text-[11px] text-[var(--ef-ink-2)] font-mono truncate">
              {trend
                ? `${trend.delta > 0 ? '+' : ''}${formatKg(trend.delta)} kg (近 ${trend.spanDays} 天)`
                : '下方可記錄趨勢'}
            </p>
          </div>

          {/* 下次生日 */}
          <div className="ef-panel p-3.5 border border-[var(--ef-rule)] bg-[var(--ef-panel)]">
            <p className="text-[10px] font-mono text-[var(--ef-ink-2)] uppercase">// BIRTHDAY / 生日</p>
            <p className={`mt-1 text-base sm:text-lg font-black font-mono ${birthday?.isToday ? 'text-[var(--ef-signal)] bg-[var(--ef-ink)] px-1 inline-block' : 'text-[var(--ef-ink)]'}`}>
              {birthday
                ? birthday.isToday ? '今天生日' : `${birthday.daysUntil} 天後`
                : '—'}
            </p>
            <p className="mt-1 text-[11px] text-[var(--ef-ink-2)] font-mono truncate">
              {birthday ? `${birthday.date.slice(5).replace('-', '.')} (滿 ${birthday.turning} 歲)` : '設定生日後計算'}
            </p>
          </div>

          {/* 預定提醒 */}
          <div className="ef-panel p-3.5 border border-[var(--ef-rule)] bg-[var(--ef-panel)]">
            <p className="text-[10px] font-mono text-[var(--ef-ink-2)] uppercase">// ALERT / 預定提醒</p>
            <p className={`mt-1 text-base sm:text-lg font-black font-mono ${reminder && reminder.daysLeft <= 7 ? 'text-[var(--ef-signal)] bg-[var(--ef-ink)] px-1 inline-block' : 'text-[var(--ef-ink)]'}`}>
              {reminder ? (reminder.daysLeft === 0 ? '今日到期' : `${reminder.daysLeft} 天後`) : '無待辦'}
            </p>
            <p className="mt-1 text-[11px] text-[var(--ef-ink-2)] font-mono truncate">
              {reminder ? reminder.title : '健康行程正常'}
            </p>
          </div>
        </div>

        {/* 體重與健康卡片 */}
        <div className="space-y-4">
          <WeightCard pet={pet} />
          <HealthCard petId={pet.id} />
        </div>

        {/* 財務摘要看板 */}
        <section className="ef-panel p-5 border border-[var(--ef-rule)] bg-[var(--ef-panel)]" aria-label="花費摘要">
          <div className="flex items-center justify-between border-b border-[var(--ef-rule)] pb-3 mb-3">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-[var(--ef-signal)] border border-[var(--ef-ink)]" />
              <h2 className="text-xs font-mono font-bold tracking-wider text-[var(--ef-ink)] uppercase">
                // EXPENSE // 財務支出摘要
              </h2>
            </div>
            <Link to="/expenses" className="text-xs font-mono font-bold text-[var(--ef-ink)] hover:underline flex items-center gap-1">
              <span>前往財務管理</span>
              <ChevronRight size={13} />
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[var(--ef-paper)] border border-[var(--ef-rule)] p-3.5">
              <p className="text-[10px] font-mono text-[var(--ef-ink-2)] uppercase">// 本月累積花費</p>
              <p className="mt-1 text-base font-bold font-mono text-[var(--ef-ink)]">{twd(spend.month)}</p>
            </div>
            <div className="bg-[var(--ef-paper)] border border-[var(--ef-rule)] p-3.5">
              <p className="text-[10px] font-mono text-[var(--ef-ink-2)] uppercase">// 年度累積總計</p>
              <p className="mt-1 text-base font-bold font-mono text-[var(--ef-ink)]">{twd(spend.year)}</p>
            </div>
          </div>
        </section>

        {/* 基本資料與編輯區塊 */}
        <section className="ef-panel p-5 border border-[var(--ef-rule)] bg-[var(--ef-panel)]" aria-label="基本資料">
          <div className="flex items-center justify-between border-b border-[var(--ef-rule)] pb-3 mb-3">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-[var(--ef-signal)] border border-[var(--ef-ink)]" />
              <h2 className="text-xs font-mono font-bold tracking-wider text-[var(--ef-ink)] uppercase">
                // PROFILE // {editing ? '編輯毛孩檔案' : '個體完整檔案'}
              </h2>
            </div>
          </div>

          {!editing ? (
            <ul className="ef-ledger text-xs space-y-1">
              <li><span>物種標記</span><span className="ef-field">{SPECIES_MAP[pet.species]}</span></li>
              <li><span>性別</span><span className="ef-field">{GENDER_MAP[pet.gender]}</span></li>
              <li><span>品種</span><span className="ef-field">{pet.breed || '未設定'}</span></li>
              <li><span>計算年齡</span><span className="ef-field">{age || '未設定'}</span></li>
              <li><span>出生日期</span><span className="ef-field">{birthDate || '未設定'}</span></li>
              <li><span>登錄體重</span><span className="ef-field font-bold">{pet.weight ? `${formatKg(pet.weight)} kg` : '未記錄'}</span></li>
              {pet.notes && (
                <li className="items-start">
                  <span>備忘備註</span>
                  <span className="ef-field text-[11px] leading-relaxed max-w-sm">{pet.notes}</span>
                </li>
              )}
            </ul>
          ) : (
            <form onSubmit={handleSave} className="space-y-3.5 pt-1">
              <div>
                <label className="block text-[10px] font-mono font-bold text-[var(--ef-ink-2)] mb-1 uppercase tracking-wider">名字 *</label>
                <input required value={form.name} onChange={e => set('name', e.target.value)} className={inputCls} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono font-bold text-[var(--ef-ink-2)] mb-1 uppercase tracking-wider">物種</label>
                  <select value={form.species} onChange={e => set('species', e.target.value)} className={inputCls}>
                    {SPECIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-mono font-bold text-[var(--ef-ink-2)] mb-1 uppercase tracking-wider">性別</label>
                  <select value={form.gender} onChange={e => set('gender', e.target.value)} className={inputCls}>
                    {GENDER.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono font-bold text-[var(--ef-ink-2)] mb-1 uppercase tracking-wider">品種</label>
                <input value={form.breed} onChange={e => set('breed', e.target.value)} placeholder="選填" className={inputCls} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono font-bold text-[var(--ef-ink-2)] mb-1 uppercase tracking-wider">出生日期</label>
                  <input type="date" max={today} value={form.birthDate} onChange={e => set('birthDate', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-[10px] font-mono font-bold text-[var(--ef-ink-2)] mb-1 uppercase tracking-wider">體重 (kg)</label>
                  <input type="number" step="0.01" min="0.01" max="200" value={form.weight} onChange={e => set('weight', e.target.value)} placeholder="選填" className={inputCls} />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono font-bold text-[var(--ef-ink-2)] mb-1 uppercase tracking-wider">備註記事</label>
                <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} placeholder="選填" className={`${inputCls} resize-none`} />
              </div>

              {updatePet.isError && (
                <p role="alert" className="text-xs font-mono text-[var(--ef-danger)]">
                  ※ {updatePet.error?.response?.data?.error || '儲存失敗，請稍後再試'}
                </p>
              )}

              <div className="flex gap-2.5 pt-2 border-t border-[var(--ef-rule)]">
                <button type="button" onClick={() => setEditing(false)} className="flex-1 ef-btn small">
                  取消
                </button>
                <button type="submit" disabled={updatePet.isPending} className="flex-1 ef-btn small go">
                  {updatePet.isPending ? '儲存中...' : '確認更新'}
                </button>
              </div>
            </form>
          )}
        </section>

      </div>
    </div>
  )
}