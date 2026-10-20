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

const EMOJI = { dog: '🐶', cat: '🐱', bird: '🐦', rabbit: '🐰', fish: '🐟', other: '🐾' }
const SPECIES = [['dog', '狗'], ['cat', '貓'], ['bird', '鳥'], ['rabbit', '兔子'], ['fish', '魚'], ['other', '其他']]
const GENDER = [['male', '男'], ['female', '女'], ['unknown', '不明']]
const SPECIES_MAP = Object.fromEntries(SPECIES)
const GENDER_MAP = Object.fromEntries(GENDER)

const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-400 focus:bg-white transition-all"

function InfoRow({ label, value }) {
  if (!value) return null
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-400">{label}</span>
      <span className="text-sm font-medium text-gray-700">{value}</span>
    </div>
  )
}

function StatTile({ label, value, sub, tone = 'text-gray-800' }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <p className="text-[11px] font-semibold text-gray-400">{label}</p>
      <p className={`mt-1 text-lg font-bold leading-tight ${tone}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
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
        <header className="bg-white rounded-2xl border border-gray-200 p-6 text-center">
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
        </header>

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
              trend && Math.abs(trend.pct) >= 10 && stage?.key !== 'young' ? 'text-amber-600' : 'text-gray-800'
            }
          />
          <StatTile
            label="下次生日"
            value={
              birthday
                ? birthday.isToday ? '就是今天 🎂' : `還有 ${birthday.daysUntil} 天`
                : '—'
            }
            sub={birthday ? `${birthday.date.slice(5).replace('-', '/')} ・ 滿 ${birthday.turning} 歲` : '設定生日後顯示'}
          />
          <StatTile
            label="下次提醒"
            value={reminder ? (reminder.daysLeft === 0 ? '就是今天' : `${reminder.daysLeft} 天後`) : '沒有安排'}
            sub={reminder ? reminder.title : '新增疫苗、回診日期就會提醒'}
            tone={reminder && reminder.daysLeft <= 7 ? 'text-amber-600' : 'text-gray-800'}
          />
        </div>

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

        {/* 基本資料 */}
        <section className="bg-white rounded-2xl border border-gray-200 p-5" aria-label="基本資料">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              {editing ? '編輯資料' : '基本資料'}
            </p>
            {!editing && (
              <button onClick={startEdit}
                className="bg-white border border-gray-200 text-green-500 hover:bg-green-50 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors">
                ✏️ 編輯
              </button>
            )}
          </div>

          {!editing ? (
            <>
              <InfoRow label="種類" value={SPECIES_MAP[pet.species]} />
              <InfoRow label="性別" value={GENDER_MAP[pet.gender]} />
              <InfoRow label="年齡" value={age} />
              <InfoRow label="生日" value={birthDate} />
              <InfoRow label="體重" value={pet.weight ? `${formatKg(pet.weight)} kg` : null} />
              {pet.notes && (
                <div className="mt-4 bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-gray-400 font-semibold mb-1">備注</p>
                  <p className="text-sm text-gray-600">{pet.notes}</p>
                </div>
              )}
            </>
          ) : (
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">名字</label>
                <input required value={form.name} onChange={e => set('name', e.target.value)} className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">種類</label>
                  <select value={form.species} onChange={e => set('species', e.target.value)} className={inputCls}>
                    {SPECIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">性別</label>
                  <select value={form.gender} onChange={e => set('gender', e.target.value)} className={inputCls}>
                    {GENDER.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">品種</label>
                <input value={form.breed} onChange={e => set('breed', e.target.value)} placeholder="選填" className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">生日</label>
                  <input type="date" max={today} value={form.birthDate} onChange={e => set('birthDate', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">體重 (kg)</label>
                  <input type="number" step="0.01" min="0.01" max="200" value={form.weight} onChange={e => set('weight', e.target.value)} placeholder="選填" className={inputCls} />
                </div>
              </div>
              <p className="-mt-2 text-[11px] text-gray-400">改了體重會同時新增一筆今天的體重紀錄，成長曲線也會更新。</p>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">備注</label>
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
          )}
        </section>
      </div>
    </div>
  )
}