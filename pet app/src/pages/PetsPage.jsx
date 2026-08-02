import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'

const EMOJI   = { dog:'🐶', cat:'🐱', bird:'🐦', rabbit:'🐰', fish:'🐟', other:'🐾' }
const SPECIES = [['dog','狗'],['cat','貓'],['bird','鳥'],['rabbit','兔子'],['fish','魚'],['other','其他']]
const GENDER  = [['male','男'],['female','女'],['unknown','不明']]

const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-400 focus:bg-white transition-all"
const selectCls = "w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-400 focus:bg-white transition-all"

function PetModal({ onClose, onSave, saving }) {
  const [form, setForm] = useState({ name:'', species:'dog', breed:'', gender:'unknown', birthDate:'', weight:'', notes:'' })
  const set = (k, v) => setForm(f => ({...f, [k]: v}))

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md border border-gray-100">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-gray-800">新增寵物</h2>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors text-sm">✕</button>
        </div>
        <form onSubmit={e => { e.preventDefault(); onSave({...form, weight: form.weight ? Number(form.weight) : undefined}) }} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">名字 *</label>
            <input required placeholder="寵物名字" value={form.name} onChange={e => set('name', e.target.value)} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">種類</label>
              <select value={form.species} onChange={e => set('species', e.target.value)} className={selectCls}>
                {SPECIES.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">性別</label>
              <select value={form.gender} onChange={e => set('gender', e.target.value)} className={selectCls}>
                {GENDER.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">品種</label>
            <input placeholder="選填" value={form.breed} onChange={e => set('breed', e.target.value)} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">生日</label>
              <input type="date" value={form.birthDate} onChange={e => set('birthDate', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">體重 (kg)</label>
              <input type="number" step="0.1" min="0" value={form.weight} onChange={e => set('weight', e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">備注</label>
            <textarea placeholder="選填" value={form.notes} rows={2} onChange={e => set('notes', e.target.value)} className={`${inputCls} resize-none`} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-200 rounded-lg py-2.5 text-sm text-gray-500 hover:bg-gray-50 font-medium transition-colors">取消</button>
            <button type="submit" disabled={saving}
              className="flex-1 bg-green-500 hover:bg-green-600 text-white rounded-lg py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 shadow-sm">
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
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-800">我的寵物</h1>
          <p className="text-sm text-gray-400 mt-0.5">管理你的毛孩子資料</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-sm">
          ＋ 新增寵物
        </button>
      </div>

      {showModal && <PetModal onClose={() => setShowModal(false)} onSave={d => addPet.mutate(d)} saving={addPet.isPending} />}

      {isLoading ? (
        <p className="text-sm text-gray-300">載入中...</p>
      ) : pets.length === 0 ? (
        <div className="text-center py-24 border-2 border-dashed border-gray-200 rounded-2xl">
          <p className="text-5xl mb-3">🐾</p>
          <p className="text-gray-400 text-sm">還沒有寵物，點右上角按鈕新增！</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {pets.map(pet => (
            <div key={pet.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm hover:border-green-200 transition-all group">
              <div className="flex items-center justify-between">
                <Link to={`/pets/${pet.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-11 h-11 bg-green-50 rounded-xl flex items-center justify-center text-2xl group-hover:bg-green-100 transition-colors shrink-0">
                    {EMOJI[pet.species] || '🐾'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{pet.name}</p>
                    <p className="text-xs text-gray-400 truncate">{pet.breed || SPECIES.find(s => s[0]===pet.species)?.[1]}</p>
                    {pet.weight && <p className="text-xs text-gray-300 mt-0.5">{pet.weight} kg</p>}
                  </div>
                </Link>
                <button onClick={() => { if(confirm(`確定刪除 ${pet.name}？`)) deletePet.mutate(pet.id) }}
                  className="text-gray-300 hover:text-red-400 transition-colors ml-2 shrink-0 text-sm">🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}