import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  SectionTitle,
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
  Plus,
  Trash2,
  Scale,
  Cake,
  X
} from 'lucide-react'
import { api } from '../lib/api'
import { petAgeText, ageInMonths } from '../lib/petAge'
import { lifeStage, nextBirthday, formatKg, todayString } from '../lib/petInsights'

const SPECIES_ICONS = {
  dog: Dog,
  cat: Cat,
  bird: Bird,
  rabbit: Rabbit,
  fish: Fish,
  other: PawPrint
}

const SPECIES = [['dog','狗'],['cat','貓'],['bird','鳥'],['rabbit','兔子'],['fish','魚'],['other','其他']]
const GENDER  = [['male','男'],['female','女'],['unknown','不明']]

const SPECIES_THEME = {
  dog: {
    avatarBg: 'bg-sky-50 border-sky-300 text-sky-700 shadow-sky-100',
    topBar: 'from-sky-400 via-blue-500 to-indigo-500',
    badge: 'border-sky-300 bg-sky-50 text-sky-800'
  },
  cat: {
    avatarBg: 'bg-amber-50 border-amber-300 text-amber-700 shadow-amber-100',
    topBar: 'from-amber-400 via-orange-400 to-rose-400',
    badge: 'border-amber-300 bg-amber-50 text-amber-900'
  },
  bird: {
    avatarBg: 'bg-emerald-50 border-emerald-300 text-emerald-700 shadow-emerald-100',
    topBar: 'from-emerald-400 via-teal-500 to-cyan-500',
    badge: 'border-emerald-300 bg-emerald-50 text-emerald-900'
  },
  rabbit: {
    avatarBg: 'bg-rose-50 border-rose-300 text-rose-700 shadow-rose-100',
    topBar: 'from-rose-400 via-pink-400 to-purple-400',
    badge: 'border-rose-300 bg-rose-50 text-rose-900'
  },
  fish: {
    avatarBg: 'bg-cyan-50 border-cyan-300 text-cyan-700 shadow-cyan-100',
    topBar: 'from-cyan-400 via-blue-500 to-sky-500',
    badge: 'border-cyan-300 bg-cyan-50 text-cyan-900'
  },
  other: {
    avatarBg: 'bg-yellow-50 border-yellow-300 text-yellow-800 shadow-yellow-100',
    topBar: 'from-[#fffa00] via-amber-400 to-orange-400',
    badge: 'border-[#191919] bg-[#fffa00] text-[#191919]'
  }
}

function getSpeciesIcon(species, props = {}) {
  const Icon = SPECIES_ICONS[species?.toLowerCase()] || PawPrint
  return <Icon {...props} />
}

const inputCls = "w-full border border-[#d9d9d9] bg-[#f8f9fa] focus:bg-white focus:border-[#191919] px-3 py-2.5 text-xs text-[#191919] font-sans focus:outline-none transition-colors"
const selectCls = "w-full border border-[#d9d9d9] bg-[#f8f9fa] focus:bg-white focus:border-[#191919] px-3 py-2.5 text-xs text-[#191919] font-sans focus:outline-none transition-colors"

// 卡片標籤：生命階段、體重、生日
function PetChips({ pet }) {
  const birthDate = pet.birth_date ? String(pet.birth_date).slice(0, 10) : null
  const stage = lifeStage(pet.species, birthDate ? ageInMonths(birthDate) : null)
  const birthday = nextBirthday(birthDate, todayString())
  const soon = birthday && birthday.daysUntil <= 30

  if (!stage && !pet.weight && !soon) return null

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {stage && (
        <span className="border border-[#d9d9d9] bg-[#f8f9fa] px-2 py-0.5 text-[10px] font-mono text-[#626262]">
          {stage.label}
        </span>
      )}
      {pet.weight && (
        <span className="border border-[#e5e5e5] bg-white px-2 py-0.5 text-[10px] font-mono text-[#8a8a8a] flex items-center gap-1">
          <Scale size={11} /> {formatKg(pet.weight)} kg
        </span>
      )}
      {soon && (
        <span className="border border-[#fc6c00]/30 bg-[#fc6c00]/10 px-2 py-0.5 text-[10px] font-mono font-bold text-[#fc6c00] flex items-center gap-1">
          <Cake size={11} /> {birthday.isToday ? '今天生日' : `${birthday.daysUntil}天後生日`}
        </span>
      )}
    </div>
  )
}

function PetModal({ onClose, onSave, saving }) {
  const [form, setForm] = useState({ name:'', species:'dog', breed:'', gender:'unknown', birthDate:'', weight:'', notes:'' })
  const set = (k, v) => setForm(f => ({...f, [k]: v}))

  const modal = (
    <div className="fixed inset-0 bg-black/45 backdrop-blur-xs flex items-center justify-center z-[100] p-4 font-sans animate-fade-in">
      <div className="bg-white border-2 border-[#191919] shadow-2xl w-full max-w-md flex flex-col overflow-hidden">
        
        {/* 頂部標題 */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-[#f8f9fa] border-b border-[#e5e5e5]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-[#fffa00] border border-[#191919]" />
            <h2 className="text-xs font-mono font-bold tracking-wider text-[#191919]">
              // REGISTER // 新增寵物檔案
            </h2>
          </div>
          <button onClick={onClose} className="p-1 text-[#626262] hover:text-[#191919] hover:bg-[#e5e5e5] transition-colors" aria-label="關閉">
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        {/* 表單內容 */}
        <form onSubmit={e => { e.preventDefault(); onSave({...form, weight: form.weight ? Number(form.weight) : undefined}) }} className="p-5 space-y-3.5">
          <div>
            <label className="block text-[11px] font-mono font-bold text-[#626262] mb-1 uppercase tracking-wider">寵物名字 *</label>
            <input required placeholder="輸入寵物名字" value={form.name} onChange={e => set('name', e.target.value)} className={inputCls} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-mono font-bold text-[#626262] mb-1 uppercase tracking-wider">物種</label>
              <select value={form.species} onChange={e => set('species', e.target.value)} className={selectCls}>
                {SPECIES.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-mono font-bold text-[#626262] mb-1 uppercase tracking-wider">性別</label>
              <select value={form.gender} onChange={e => set('gender', e.target.value)} className={selectCls}>
                {GENDER.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono font-bold text-[#626262] mb-1 uppercase tracking-wider">品種</label>
            <input placeholder="例如：米克斯、柴犬、英國短毛貓 (選填)" value={form.breed} onChange={e => set('breed', e.target.value)} className={inputCls} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-mono font-bold text-[#626262] mb-1 uppercase tracking-wider">出生日期</label>
              <input type="date" value={form.birthDate} onChange={e => set('birthDate', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-[11px] font-mono font-bold text-[#626262] mb-1 uppercase tracking-wider">體重 (kg)</label>
              <input type="number" step="0.1" min="0" placeholder="例如：4.5" value={form.weight} onChange={e => set('weight', e.target.value)} className={inputCls} />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono font-bold text-[#626262] mb-1 uppercase tracking-wider">備註記事</label>
            <textarea placeholder="飲食偏好、過敏史、特殊照顧習慣 (選填)" value={form.notes} rows={2} onChange={e => set('notes', e.target.value)} className={`${inputCls} resize-none`} />
          </div>

          <div className="flex gap-3 pt-3 border-t border-[#f0f0f0]">
            <Button type="button" variant="light" size="sm" onClick={onClose} className="flex-1">
              取消
            </Button>
            <Button type="submit" variant="action" size="sm" disabled={saving} className="flex-1">
              {saving ? '儲存中...' : '確認新增'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : modal
}

export default function PetsPage() {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)

  const { data: pets = [], isLoading } = useQuery({
    queryKey: ['pets'],
    queryFn: () => api.get('/pets').then(r => r.data.data)
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
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-6 font-sans">
      
      {/* 標題與操作列 */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#e5e5e5] pb-4">
        <div>
          <SectionTitle
            latin="MY PETS // ROSTER"
            meta={`// REGISTERED: ${pets.length}`}
            level={1}
            tone="accent"
            className="text-2xl font-extrabold tracking-tight text-[#191919]"
          >
            我的寵物
          </SectionTitle>
          <p className="text-xs text-[#8a8a8a] font-mono mt-1">
            {pets.length > 0 ? `目前共登錄 ${pets.length} 隻毛小孩 ・ 點選可檢視健康紀錄與體重曲線` : '管理家中毛小孩之生活與健康檔案'}
          </p>
        </div>

        <Button
          variant="action"
          size="sm"
          iconStart={<Plus size={15} />}
          onClick={() => setShowModal(true)}
        >
          新增寵物
        </Button>
      </div>

      {showModal && <PetModal onClose={() => setShowModal(false)} onSave={d => addPet.mutate(d)} saving={addPet.isPending} />}

      {isLoading ? (
        <div className="py-16 text-center font-mono space-y-2">
          <div className="inline-block w-5 h-5 border-2 border-[#191919] border-t-transparent animate-spin rounded-full" />
          <p className="text-xs text-[#8a8a8a]">載入寵物檔案庫中...</p>
        </div>
      ) : pets.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-[#d9d9d9] bg-white p-6 space-y-3">
          <div className="w-12 h-12 mx-auto bg-[#f8f9fa] border border-[#d9d9d9] flex items-center justify-center text-[#8a8a8a]">
            <PawPrint size={24} strokeWidth={1.5} />
          </div>
          <p className="text-xs font-mono text-[#8a8a8a]">尚未新增任何毛孩資料</p>
          <Button variant="action" size="sm" onClick={() => setShowModal(true)}>
            新增第一隻寵物
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {pets.map((pet, idx) => {
            const theme = SPECIES_THEME[pet.species?.toLowerCase()] || SPECIES_THEME.other
            return (
              <div
                key={pet.id}
                className="relative bg-white border border-[#d9d9d9] p-4.5 hover:border-[#191919] transition-all group shadow-xs hover:shadow overflow-hidden"
              >
                {/* 頂部物種色彩光條 */}
                <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${theme.topBar}`} />
                <CornerBrackets size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity" />

                <div className="flex items-start justify-between gap-3">
                  <Link to={`/pets/${pet.id}`} className="flex items-start gap-3.5 flex-1 min-w-0">
                    <div className={`w-12 h-12 border flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${theme.avatarBg}`}>
                      {getSpeciesIcon(pet.species, { size: 22, strokeWidth: 2 })}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-[#191919] truncate group-hover:text-black">
                          {pet.name}
                        </p>
                        <span className={`px-2 py-0.2 text-[11px] font-mono font-bold border ${theme.badge}`}>
                          {SPECIES.find(s => s[0] === pet.species)?.[1] || pet.species}
                        </span>
                      </div>

                      <p className="text-xs text-[#8a8a8a] truncate mt-0.5 font-mono">
                        {pet.breed || '未設定品種'}
                        {petAgeText(pet.birth_date) ? ` · ${petAgeText(pet.birth_date)}` : ''}
                      </p>

                      <PetChips pet={pet} />
                    </div>
                  </Link>

                  <button
                    type="button"
                    onClick={() => { if(confirm(`確定要刪除「${pet.name}」的檔案嗎？相關紀錄也將一併移除。`)) deletePet.mutate(pet.id) }}
                    className="p-1.5 text-[#b3b3b3] hover:text-[#de0909] hover:bg-[#fee2e2]/60 transition-colors shrink-0"
                    title="刪除寵物"
                  >
                    <Trash2 size={15} strokeWidth={1.8} />
                  </button>
                </div>

                <div className="mt-3.5 pt-2.5 border-t border-[#f0f0f0] flex items-center justify-between text-[11px] font-mono group-hover:text-[#191919]">
                  <span className="flex items-center gap-1.5 text-emerald-700 font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    檔案狀態：正常
                  </span>
                  <span className="font-bold text-[#191919] group-hover:underline">檢視詳細檔案 →</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

    </div>
  )
}