import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  BracketTitle,
  Button,
  Tag,
  CornerBrackets
} from '@endfield-ui/react'
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
  DollarSign
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

const SPECIES = [['dog', '狗'], ['cat', '貓'], ['bird', '鳥'], ['rabbit', '兔子'], ['fish', '魚'], ['other', '其他']]
const GENDER = [['male', '男'], ['female', '女'], ['unknown', '不明']]
const SPECIES_MAP = Object.fromEntries(SPECIES)
const GENDER_MAP = Object.fromEntries(GENDER)

function getSpeciesIcon(species, props = {}) {
  const Icon = SPECIES_ICONS[species?.toLowerCase()] || PawPrint
  return <Icon {...props} />
}

const inputCls = "w-full border border-[#d9d9d9] bg-[#f8f9fa] focus:bg-white focus:border-[#191919] px-3 py-2.5 text-xs text-[#191919] font-sans focus:outline-none transition-colors"

function InfoRow({ label, value }) {
  if (!value) return null
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-[#f0f0f0] last:border-0 text-xs">
      <span className="text-[#8a8a8a] font-mono">{label}</span>
      <span className="font-bold text-[#191919]">{value}</span>
    </div>
  )
}

const SPECIES_THEME = {
  dog: {
    badge: 'border-sky-300 bg-sky-50 text-sky-800 font-bold',
    avatarBg: 'bg-sky-50 border-sky-300 text-sky-700 shadow-sky-100',
    topBar: 'from-sky-400 via-blue-500 to-indigo-500'
  },
  cat: {
    badge: 'border-amber-300 bg-amber-50 text-amber-900 font-bold',
    avatarBg: 'bg-amber-50 border-amber-300 text-amber-700 shadow-amber-100',
    topBar: 'from-amber-400 via-orange-400 to-rose-400'
  },
  bird: {
    badge: 'border-emerald-300 bg-emerald-50 text-emerald-900 font-bold',
    avatarBg: 'bg-emerald-50 border-emerald-300 text-emerald-700 shadow-emerald-100',
    topBar: 'from-emerald-400 via-teal-500 to-cyan-500'
  },
  rabbit: {
    badge: 'border-rose-300 bg-rose-50 text-rose-900 font-bold',
    avatarBg: 'bg-rose-50 border-rose-300 text-rose-700 shadow-rose-100',
    topBar: 'from-rose-400 via-pink-400 to-purple-400'
  },
  fish: {
    badge: 'border-cyan-300 bg-cyan-50 text-cyan-900 font-bold',
    avatarBg: 'bg-cyan-50 border-cyan-300 text-cyan-700 shadow-cyan-100',
    topBar: 'from-cyan-400 via-blue-500 to-sky-500'
  },
  other: {
    badge: 'border-[#191919] bg-[#fffa00] text-[#191919] font-bold',
    avatarBg: 'bg-yellow-50 border-yellow-300 text-yellow-800 shadow-yellow-100',
    topBar: 'from-[#fffa00] via-amber-400 to-orange-400'
  }
}

function StatTile({
  label,
  value,
  sub,
  icon: Icon,
  tone = 'text-[#191919]',
  accent = 'border-t-sky-500',
  iconColor = 'text-sky-600 bg-sky-50 border-sky-200'
}) {
  return (
    <div className={`relative bg-white border border-[#d9d9d9] border-t-2 ${accent} p-4 shadow-xs group hover:border-[#191919] transition-all`}>
      <CornerBrackets size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-mono font-bold text-[#8a8a8a] uppercase tracking-wider">
          // {label}
        </span>
        {Icon && (
          <div className={`w-6 h-6 rounded flex items-center justify-center border text-xs shrink-0 ${iconColor}`}>
            <Icon size={13} strokeWidth={2} />
          </div>
        )}
      </div>
      <p className={`text-base sm:text-lg font-bold font-mono leading-tight ${tone}`}>{value}</p>
      {sub && <p className="mt-1.5 text-[11px] text-[#626262] leading-tight">{sub}</p>}
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
      <div className="p-16 text-center font-mono space-y-2">
        <div className="inline-block w-5 h-5 border-2 border-[#191919] border-t-transparent animate-spin rounded-full" />
        <p className="text-xs text-[#8a8a8a]">載入個體詳細檔案中...</p>
      </div>
    )
  }

  if (!pet) {
    return (
      <div className="p-12 text-center max-w-md mx-auto space-y-4">
        <div className="w-12 h-12 mx-auto bg-[#f8f9fa] border border-[#d9d9d9] flex items-center justify-center text-[#8a8a8a]">
          <PawPrint size={24} strokeWidth={1.5} />
        </div>
        <p className="text-sm font-bold text-[#191919]">查無此寵物檔案</p>
        <Link to="/pets" className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-[#191919] hover:underline">
          <ArrowLeft size={14} /> 返回寵物列表
        </Link>
      </div>
    )
  }

  const age = petAgeText(pet.birth_date)

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-6 font-sans">
      
      {/* 頂部導航 */}
      <div>
        <Link
          to="/pets"
          className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-[#626262] hover:text-[#191919] transition-colors"
        >
          <ArrowLeft size={14} /> // 返回寵物列表
        </Link>
      </div>

      <div className="space-y-5">
        
        {/* 頂部檔案主卡片 */}
        {(() => {
          const theme = SPECIES_THEME[pet.species?.toLowerCase()] || SPECIES_THEME.other
          return (
            <header className="relative bg-white border border-[#d9d9d9] p-6 text-center shadow-xs overflow-hidden">
              {/* 頂部物種色彩光條 */}
              <div className={`absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r ${theme.topBar}`} />
              <CornerBrackets size="sm" />
              
              <div className={`w-16 h-16 mx-auto mb-3 border-2 flex items-center justify-center transition-transform hover:scale-105 ${theme.avatarBg}`}>
                {getSpeciesIcon(pet.species, { size: 32, strokeWidth: 2 })}
              </div>

              <BracketTitle level={1} className="text-2xl font-bold text-[#191919]">
                {pet.name}
              </BracketTitle>

              {pet.breed && (
                <p className="text-xs text-[#8a8a8a] font-mono mt-1">
                  // {pet.breed}
                </p>
              )}

              <div className="mt-3.5 flex flex-wrap items-center justify-center gap-2">
                <span className={`px-2.5 py-0.5 text-xs font-mono font-bold border ${theme.badge}`}>
                  {SPECIES_MAP[pet.species]}
                  {pet.gender && pet.gender !== 'unknown' ? ` · ${GENDER_MAP[pet.gender]}` : ''}
                </span>

                {stage && (
                  <span className={`px-2.5 py-0.5 text-xs font-mono font-bold border ${
                    stage.key === 'young'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : stage.key === 'senior'
                      ? 'bg-amber-50 text-amber-900 border-amber-300'
                      : 'bg-sky-50 text-sky-800 border-sky-300'
                  }`}>
                    {stage.key === 'young' ? '🌱 ' : stage.key === 'senior' ? '✨ ' : '⚡ '}
                    {stage.label}
                  </span>
                )}

                {birthday?.isToday && (
                  <span className="px-2.5 py-0.5 text-xs font-mono font-bold border border-rose-300 bg-gradient-to-r from-rose-100 to-amber-100 text-rose-900 shadow-xs animate-pulse">
                    🎂 今天生日！
                  </span>
                )}
              </div>
            </header>
          )
        })()}

        {/* 4 個關鍵指標方塊 */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="重點數據">
          <StatTile
            label="年齡"
            icon={Calendar}
            accent="border-t-sky-500"
            iconColor="text-sky-600 bg-sky-50 border-sky-200"
            tone="text-sky-950 font-extrabold"
            value={age || '未設定'}
            sub={human !== null ? `約人類 ${human} 歲` : !birthDate ? '編輯資料設定生日' : null}
          />
          <StatTile
            label="目前體重"
            icon={Scale}
            accent="border-t-emerald-500"
            iconColor="text-emerald-600 bg-emerald-50 border-emerald-200"
            value={pet.weight ? `${formatKg(pet.weight)} kg` : '未記錄'}
            sub={
              trend
                ? `近 ${trend.spanDays} 天 ${trend.delta > 0 ? '+' : ''}${formatKg(trend.delta)} kg`
                : pet.weight ? '持續記錄檢視趨勢' : '下方可新增紀錄'
            }
            tone={
              trend && Math.abs(trend.pct) >= 10 && stage?.key !== 'young'
                ? 'text-amber-600 font-extrabold'
                : 'text-emerald-950 font-extrabold'
            }
          />
          <StatTile
            label="下次生日"
            icon={Heart}
            accent="border-t-amber-500"
            iconColor="text-amber-600 bg-amber-50 border-amber-200"
            tone={birthday?.isToday ? 'text-rose-600 font-extrabold' : 'text-amber-950 font-extrabold'}
            value={
              birthday
                ? birthday.isToday ? '今天生日 🎉' : `${birthday.daysUntil} 天後`
                : '—'
            }
            sub={birthday ? `${birthday.date.slice(5).replace('-', '/')} (滿 ${birthday.turning} 歲)` : '設定生日後顯示'}
          />
          <StatTile
            label="預定提醒"
            icon={Bell}
            accent={reminder && reminder.daysLeft <= 7 ? 'border-t-rose-500' : 'border-t-purple-500'}
            iconColor={
              reminder && reminder.daysLeft <= 7
                ? 'text-rose-600 bg-rose-50 border-rose-200'
                : 'text-purple-600 bg-purple-50 border-purple-200'
            }
            value={reminder ? (reminder.daysLeft === 0 ? '今日到期' : `${reminder.daysLeft} 天後`) : '無待辦'}
            sub={reminder ? reminder.title : '疫苗與回診提醒'}
            tone={reminder && reminder.daysLeft <= 7 ? 'text-rose-600 font-extrabold' : 'text-purple-950 font-extrabold'}
          />
        </div>

        {/* 體重與健康卡片 */}
        <div className="space-y-4">
          <WeightCard pet={pet} />
          <HealthCard petId={pet.id} />
        </div>

        {/* 花費摘要 */}
        <section className="bg-white border border-[#d9d9d9] p-5 shadow-xs" aria-label="花費摘要">
          <div className="flex items-center justify-between border-b border-[#f0f0f0] pb-3 mb-3">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-[#fffa00] border border-[#191919]" />
              <h2 className="text-xs font-mono font-bold tracking-wider text-[#191919] uppercase">
                // EXPENSE SUMMARY // 相關支出摘要
              </h2>
            </div>
            <Link to="/expenses" className="text-xs font-mono font-semibold text-[#191919] hover:underline">
              進入財務管理 →
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#f8f9fa] border border-[#e5e5e5] p-3.5">
              <p className="text-[10px] font-mono text-[#8a8a8a] uppercase">// 本月累積</p>
              <p className="mt-1 text-base font-bold font-mono text-[#191919]">{twd(spend.month)}</p>
            </div>
            <div className="bg-[#f8f9fa] border border-[#e5e5e5] p-3.5">
              <p className="text-[10px] font-mono text-[#8a8a8a] uppercase">// 年度總計</p>
              <p className="mt-1 text-base font-bold font-mono text-[#191919]">{twd(spend.year)}</p>
            </div>
          </div>
        </section>

        {/* 基本資料區塊 */}
        <section className="bg-white border border-[#d9d9d9] p-5 shadow-xs" aria-label="基本資料">
          <div className="flex items-center justify-between border-b border-[#f0f0f0] pb-3 mb-3">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-[#fffa00] border border-[#191919]" />
              <p className="text-xs font-mono font-bold tracking-wider text-[#191919] uppercase">
                // PROFILE // {editing ? '編輯毛孩檔案' : '毛孩基本資料'}
              </p>
            </div>

            {!editing && (
              <Button
                variant="light"
                size="sm"
                iconStart={<Edit3 size={13} />}
                onClick={startEdit}
              >
                編輯資料
              </Button>
            )}
          </div>

          {!editing ? (
            <div className="space-y-0.5">
              <InfoRow label="物種" value={SPECIES_MAP[pet.species]} />
              <InfoRow label="性別" value={GENDER_MAP[pet.gender]} />
              <InfoRow label="計算年齡" value={age} />
              <InfoRow label="出生日期" value={birthDate} />
              <InfoRow label="登錄體重" value={pet.weight ? `${formatKg(pet.weight)} kg` : null} />
              {pet.notes && (
                <div className="mt-4 bg-[#f8f9fa] border border-[#e5e5e5] p-3.5">
                  <p className="text-[10px] font-mono font-bold text-[#8a8a8a] mb-1 uppercase">// 備忘備註</p>
                  <p className="text-xs text-[#626262] leading-relaxed">{pet.notes}</p>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-3.5 pt-1">
              <div>
                <label className="block text-[11px] font-mono font-bold text-[#626262] mb-1 uppercase tracking-wider">名字</label>
                <input required value={form.name} onChange={e => set('name', e.target.value)} className={inputCls} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-mono font-bold text-[#626262] mb-1 uppercase tracking-wider">物種</label>
                  <select value={form.species} onChange={e => set('species', e.target.value)} className={inputCls}>
                    {SPECIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-mono font-bold text-[#626262] mb-1 uppercase tracking-wider">性別</label>
                  <select value={form.gender} onChange={e => set('gender', e.target.value)} className={inputCls}>
                    {GENDER.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono font-bold text-[#626262] mb-1 uppercase tracking-wider">品種</label>
                <input value={form.breed} onChange={e => set('breed', e.target.value)} placeholder="選填" className={inputCls} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-mono font-bold text-[#626262] mb-1 uppercase tracking-wider">出生日期</label>
                  <input type="date" max={today} value={form.birthDate} onChange={e => set('birthDate', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-[11px] font-mono font-bold text-[#626262] mb-1 uppercase tracking-wider">體重 (kg)</label>
                  <input type="number" step="0.01" min="0.01" max="200" value={form.weight} onChange={e => set('weight', e.target.value)} placeholder="選填" className={inputCls} />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono font-bold text-[#626262] mb-1 uppercase tracking-wider">備忘備註</label>
                <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} placeholder="選填" className={`${inputCls} resize-none`} />
              </div>

              {updatePet.isError && (
                <p role="alert" className="text-xs font-mono text-[#de0909]">
                  ※ {updatePet.error?.response?.data?.error || '儲存失敗，請稍後再試'}
                </p>
              )}

              <div className="flex gap-3 pt-2 border-t border-[#f0f0f0]">
                <Button type="button" variant="light" size="sm" onClick={() => setEditing(false)} className="flex-1">
                  取消
                </Button>
                <Button type="submit" variant="action" size="sm" disabled={updatePet.isPending} className="flex-1">
                  {updatePet.isPending ? '儲存中...' : '確認更新'}
                </Button>
              </div>
            </form>
          )}
        </section>

      </div>
    </div>
  )
}