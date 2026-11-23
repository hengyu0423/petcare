import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { petAgeText, ageInMonths } from '../lib/petAge'
import { lifeStage, nextBirthday, formatKg, todayString } from '../lib/petInsights'
import PetIcon from '../components/brand/PetIcon'

const SPECIES = [['dog','狗'],['cat','貓'],['bird','鳥'],['rabbit','兔子'],['fish','魚'],['other','其他']]
const GENDER  = [['male','男'],['female','女'],['unknown','不明']]

// 生命階段：改用暖色系標籤（與首頁同一組顏色）
const STAGE_CLS = {
  young:  'bg-water-50 text-water-700 border-water-100',
  adult:  'bg-pine-50 text-pine-700 border-pine-100',
  senior: 'bg-warm text-honey-deep border-honey-200'
}

const fieldCls = "w-full border border-sand rounded-xl px-3 py-2.5 text-sm bg-cream text-ink placeholder:text-ink-soft/60 focus:outline-none focus:ring-2 focus:ring-pine-700/35 focus:border-pine-700/40 focus:bg-plate transition-all"

// 卡片上的小標籤：生命階段、體重、快到的生日
function PetChips({ pet }) {
  const birthDate = pet.birth_date ? String(pet.birth_date).slice(0, 10) : null
  const stage = lifeStage(pet.species, birthDate ? ageInMonths(birthDate) : null)
  const birthday = nextBirthday(birthDate, todayString())
  const soon = birthday && birthday.daysUntil <= 30

  if (!stage && !pet.weight && !soon) return null

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {stage && (
        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STAGE_CLS[stage.key] || STAGE_CLS.adult}`}>
          {stage.label}
        </span>
      )}
      {pet.weight && (
        <span className="rounded-full border border-line bg-cream px-2 py-0.5 text-[11px] text-ink-soft">
          {formatKg(pet.weight)} kg
        </span>
      )}
      {soon && (
        <span className="rounded-full border border-honey-200 bg-warm px-2 py-0.5 text-[11px] font-semibold text-honey-deep">
          {birthday.isToday ? '今天生日' : `${birthday.daysUntil} 天後生日`}
        </span>
      )}
    </div>
  )
}

function PetModal({ onClose, onSave, saving }) {
  const [form, setForm] = useState({ name:'', species:'dog', breed:'', gender:'unknown', birthDate:'', weight:'', notes:'' })
  const set = (k, v) => setForm(f => ({...f, [k]: v}))
  const labelCls = "mb-1.5 block text-[12px] font-semibold text-ink-soft"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-pine-900/35 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-hair bg-plate p-6 shadow-[0_30px_60px_-30px_rgba(87,54,17,0.55)]">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-pine-900">新增寵物</h2>
            <p className="mt-0.5 text-xs text-ink-soft">填好基本資料，之後才能估算熱量與健康提醒</p>
          </div>
          <button
            onClick={onClose}
            aria-label="關閉"
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-warm hover:text-pine-900"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <form onSubmit={e => { e.preventDefault(); onSave({...form, weight: form.weight ? Number(form.weight) : undefined}) }} className="space-y-3">
          <div>
            <label className={labelCls}>名字 *</label>
            <input required placeholder="寵物名字" value={form.name} onChange={e => set('name', e.target.value)} className={fieldCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>種類</label>
              <select value={form.species} onChange={e => set('species', e.target.value)} className={fieldCls}>
                {SPECIES.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>性別</label>
              <select value={form.gender} onChange={e => set('gender', e.target.value)} className={fieldCls}>
                {GENDER.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>品種</label>
            <input placeholder="選填" value={form.breed} onChange={e => set('breed', e.target.value)} className={fieldCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>生日</label>
              <input type="date" value={form.birthDate} onChange={e => set('birthDate', e.target.value)} className={fieldCls} />
            </div>
            <div>
              <label className={labelCls}>體重 (kg)</label>
              <input type="number" step="0.1" min="0" value={form.weight} onChange={e => set('weight', e.target.value)} className={fieldCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>備注</label>
            <textarea placeholder="選填" value={form.notes} rows={2} onChange={e => set('notes', e.target.value)} className={`${fieldCls} resize-none`} />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-line py-2.5 text-sm font-semibold text-ink-soft transition-colors hover:bg-warm"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-xl bg-honey py-2.5 text-sm font-extrabold text-pine-900 shadow-press transition-all hover:bg-honey-hover active:translate-y-[3px] active:shadow-none disabled:opacity-50"
            >
              {saving ? '新增中...' : '新增'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function PetsPage() {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)

  const { data: pets = [], isLoading } = useQuery({
    queryKey: ['pets'],
    queryFn: () =>
      api.get('/pets').then(r => {
        const d = r.data?.data
        if (Array.isArray(d)) return d
        if (Array.isArray(d?.rows)) return d.rows
        return []
      })
  })

  const addPet = useMutation({
    mutationFn: payload => api.post('/pets', payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pets'] }); setShowModal(false) }
  })

  const deletePet = useMutation({
    mutationFn: id => api.delete(`/pets/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pets'] })
  })

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
      <PageHeader
        title="我的"
        accent="寵物"
        className="mb-0"
        subtitle={
          pets.length > 0
            ? `共 ${pets.length} 隻・點進去可以看體重成長曲線與健康紀錄`
            : '管理你的毛孩子資料'
        }
        actions={
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 rounded-2xl bg-honey px-4 py-2.5 text-sm font-extrabold text-pine-900 shadow-press transition-all hover:bg-honey-hover active:translate-y-[3px] active:shadow-none"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                <path d="M12 5v14M5 12h14" />
              </svg>
              新增寵物
            </button>
        }
      />

      {showModal && <PetModal onClose={() => setShowModal(false)} onSave={d => addPet.mutate(d)} saving={addPet.isPending} />}

      {isLoading ? (
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="載入中">
          {[0, 1, 2].map(i => <div key={i} className="skeleton h-[92px]" />)}
        </div>
      ) : pets.length === 0 ? (
        <EmptyState
          className="mt-6"
          icon="paw"
          title="還沒有寵物"
          desc="把第一位家人加進來，就能開始記錄體重、飲食和健康。"
          action={{ label: '新增寵物', onClick: () => setShowModal(true) }}
        />
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pets.map(pet => (
            <div
              key={pet.id}
              className="group card-lift rounded-3xl border border-hair bg-plate p-4 shadow-card hover:border-hair-strong"
            >
              <div className="flex items-start justify-between gap-2">
                <Link to={`/pets/${pet.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <PetIcon species={pet.species} breed={pet.breed} size={52} className="h-13 w-13 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[15px] font-bold text-pine-900">{pet.name}</p>
                    <p className="truncate text-xs text-ink-soft">
                      {pet.breed || SPECIES.find(s => s[0]===pet.species)?.[1]}
                      {petAgeText(pet.birth_date) ? ` · ${petAgeText(pet.birth_date)}` : ''}
                    </p>
                    <PetChips pet={pet} />
                  </div>
                </Link>
                <button
                  onClick={() => { if(confirm(`確定刪除 ${pet.name}？`)) deletePet.mutate(pet.id) }}
                  aria-label={`刪除 ${pet.name}`}
                  className="shrink-0 rounded-xl p-1.5 text-ink-soft/50 transition-colors hover:bg-clay-50 hover:text-clay"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 7h16M9.5 7V5.2A1.2 1.2 0 0 1 10.7 4h2.6a1.2 1.2 0 0 1 1.2 1.2V7" />
                    <path d="M6.5 7l.8 12.1A1.9 1.9 0 0 0 9.2 21h5.6a1.9 1.9 0 0 0 1.9-1.9L17.5 7" />
                    <path d="M10.5 11v6M13.5 11v6" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
