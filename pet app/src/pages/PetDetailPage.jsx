import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

const EMOJI   = { dog:'🐶', cat:'🐱', bird:'🐦', rabbit:'🐰', fish:'🐟', other:'🐾' }
const SPECIES = [['dog','狗'],['cat','貓'],['bird','鳥'],['rabbit','兔子'],['fish','魚'],['other','其他']]
const GENDER  = [['male','男'],['female','女'],['unknown','不明']]
const SPECIES_MAP = Object.fromEntries(SPECIES)
const GENDER_MAP  = Object.fromEntries(GENDER)

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

export default function PetDetailPage() {
  const { id } = useParams()
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(null)

  const { data: pets = [] } = useQuery({
    queryKey: ['pets'],
    queryFn: () => api.get('/pets').then(r => r.data.data)
  })

  const pet = pets.find(p => String(p.id) === id)

  const updatePet = useMutation({
    mutationFn: payload => api.put(`/pets/${id}`, payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pets'] }); setEditing(false) }
  })

  const startEdit = () => {
    setForm({
      name:      pet.name,
      species:   pet.species,
      breed:     pet.breed || '',
      gender:    pet.gender || 'unknown',
      birthDate: pet.birth_date ? pet.birth_date.slice(0, 10) : '',
      weight:    pet.weight || '',
      notes:     pet.notes || '',
    })
    setEditing(true)
  }

  const handleSave = (e) => {
    e.preventDefault()
    updatePet.mutate({ ...form, weight: form.weight ? Number(form.weight) : null })
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  if (!pet) return (
    <div className="p-8 text-center">
      <p className="text-5xl mb-4">🔍</p>
      <p className="text-gray-400 mb-4">找不到這隻寵物</p>
      <Link to="/pets" className="text-green-500 hover:underline text-sm font-medium">← 返回列表</Link>
    </div>
  )

  const age = pet.birth_date ? (() => {
    const months = Math.floor((Date.now() - new Date(pet.birth_date)) / (1000 * 60 * 60 * 24 * 30.4))
    return months < 12 ? `${months} 個月` : `${Math.floor(months / 12)} 歲`
  })() : null

  return (
    <div className="p-6 max-w-xl">
      <Link to="/pets" className="text-sm text-green-500 hover:underline font-medium mb-5 inline-block">
        ← 返回列表
      </Link>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {/* Hero */}
        <div className="bg-gray-50 p-8 text-center relative">
          <div className="text-7xl mb-3">{EMOJI[pet.species] || '🐾'}</div>
          <h1 className="text-2xl font-bold text-gray-800">{pet.name}</h1>
          {pet.breed && <p className="text-gray-400 text-sm mt-1">{pet.breed}</p>}
          {!editing && (
            <button onClick={startEdit}
              className="absolute top-4 right-4 bg-white border border-gray-200 text-green-500 hover:bg-green-50 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors">
              ✏️ 編輯
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-5">
          {!editing ? (
            <>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">基本資料</p>
              <InfoRow label="種類" value={SPECIES_MAP[pet.species]} />
              <InfoRow label="性別" value={GENDER_MAP[pet.gender]} />
              <InfoRow label="年齡" value={age} />
              <InfoRow label="生日" value={pet.birth_date?.slice(0, 10)} />
              <InfoRow label="體重" value={pet.weight ? `${pet.weight} kg` : null} />
              {pet.notes && (
                <div className="mt-4 bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-gray-400 font-semibold mb-1">備注</p>
                  <p className="text-sm text-gray-600">{pet.notes}</p>
                </div>
              )}
            </>
          ) : (
            <form onSubmit={handleSave} className="space-y-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">編輯資料</p>
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">生日</label>
                  <input type="date" value={form.birthDate} onChange={e => set('birthDate', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">體重 (kg)</label>
                  <input type="number" step="0.1" min="0" value={form.weight} onChange={e => set('weight', e.target.value)} placeholder="選填" className={inputCls} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">備注</label>
                <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} placeholder="選填" className={`${inputCls} resize-none`} />
              </div>
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
        </div>
      </div>
    </div>
  )
}