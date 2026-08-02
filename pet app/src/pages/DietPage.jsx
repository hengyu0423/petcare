import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'

const EMOJI = { dog:'🐶', cat:'🐱', bird:'🐦', rabbit:'🐰', fish:'🐟', other:'🐾' }

function calcNutrition(food, amountG) {
  if (!food || !amountG) return {}
  const ratio = amountG / 100
  return {
    calories: food.calories_per_100g ? +(food.calories_per_100g * ratio).toFixed(1) : null,
    proteinG: food.protein_pct ? +(food.protein_pct * ratio).toFixed(1) : null,
    fatG: food.fat_pct ? +(food.fat_pct * ratio).toFixed(1) : null,
    carbG: food.carb_pct ? +(food.carb_pct * ratio).toFixed(1) : null,
  }
}

function getRecommendedCalories(pet) {
  if (!pet?.weight) return null
  const w = Number(pet.weight)
  const rer = 70 * Math.pow(w, 0.75)
  return Math.round(rer * 1.4)
}

export default function DietPage() {
  const qc = useQueryClient()
  const today = new Date().toISOString().split('T')[0]
  const [selectedPet, setSelectedPet] = useState(null)
  const [selectedDate, setSelectedDate] = useState(today)
  const [showAddModal, setShowAddModal] = useState(false)
  const [form, setForm] = useState({ foodItemId: '', foodName: '', amountG: '', fedAt: new Date().toISOString().slice(0,16), notes: '' })
  const [selectedFood, setSelectedFood] = useState(null)
  const [aiAnalyzing, setAiAnalyzing] = useState(false)

  const { data: pets = [] } = useQuery({
    queryKey: ['pets'],
    queryFn: () => api.get('/pets').then(r => r.data.data)
  })

  useEffect(() => {
    if (pets.length > 0 && !selectedPet) setSelectedPet(pets[0])
  }, [pets])

  const { data: foods = [] } = useQuery({
    queryKey: ['foods'],
    queryFn: () => api.get('/food').then(r => r.data.data)
  })

  const { data: records = [] } = useQuery({
    queryKey: ['feeding', selectedPet?.id, selectedDate],
    queryFn: () => api.get(`/feeding/pet/${selectedPet.id}?date=${selectedDate}`).then(r => r.data.data),
    enabled: !!selectedPet
  })

  const { data: dailyStats = [] } = useQuery({
    queryKey: ['feeding-stats', selectedPet?.id],
    queryFn: () => api.get(`/feeding/pet/${selectedPet.id}/daily-stats`).then(r => r.data.data),
    enabled: !!selectedPet
  })

  const addRecord = useMutation({
    mutationFn: payload => api.post('/feeding', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feeding'] })
      qc.invalidateQueries({ queryKey: ['feeding-stats'] })
      setShowAddModal(false)
      setForm({ foodItemId: '', foodName: '', amountG: '', fedAt: new Date().toISOString().slice(0,16), notes: '' })
      setSelectedFood(null)
    }
  })

  const deleteRecord = useMutation({
    mutationFn: id => api.delete(`/feeding/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feeding'] })
      qc.invalidateQueries({ queryKey: ['feeding-stats'] })
    }
  })

  const handleFoodSelect = (foodId) => {
    const food = foods.find(f => String(f.id) === foodId)
    setSelectedFood(food || null)
    setForm(f => ({ ...f, foodItemId: foodId, foodName: food?.name || '' }))
  }

  const handleAiAnalyze = async () => {
    if (!form.foodName) return
    setAiAnalyzing(true)
    try {
      const { data } = await api.post('/food/ai-analyze', { foodName: form.foodName })
      if (data.success) {
        setSelectedFood({ ...data.data, name: form.foodName })
      }
    } catch (err) {
      console.error(err)
    } finally { setAiAnalyzing(false) }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const nutrition = calcNutrition(selectedFood, Number(form.amountG))
    addRecord.mutate({
      petId: selectedPet.id,
      foodItemId: form.foodItemId || null,
      foodName: form.foodName,
      amountG: Number(form.amountG),
      calories: nutrition.calories,
      proteinG: nutrition.proteinG,
      fatG: nutrition.fatG,
      carbG: nutrition.carbG,
      fedAt: form.fedAt,
      notes: form.notes
    })
  }

  const goDay = (offset) => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + offset)
    const next = d.toISOString().split('T')[0]
    if (next <= today) setSelectedDate(next)
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    const d = dateStr.slice(0, 10)
    return d === today ? '今日' : d
  }

  const todayCalories = records.reduce((s, r) => s + Number(r.calories || 0), 0)
  const todayProtein  = records.reduce((s, r) => s + Number(r.protein_g || 0), 0)
  const todayFat      = records.reduce((s, r) => s + Number(r.fat_g || 0), 0)
  const recommended   = getRecommendedCalories(selectedPet)
  const caloriePct    = recommended ? Math.min((todayCalories / recommended) * 100, 100) : 0
  const nutrition     = selectedFood && form.amountG ? calcNutrition(selectedFood, Number(form.amountG)) : null

  const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-400 focus:bg-white transition-all"

  return (
    <div className="flex h-screen overflow-hidden">
      {/* 左側：選擇寵物 */}
      <div className="w-52 bg-white border-r border-gray-200 flex flex-col shrink-0">
        <div className="px-4 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-800">選擇寵物</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {pets.map(pet => (
            <button key={pet.id} onClick={() => setSelectedPet(pet)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                selectedPet?.id === pet.id
                  ? 'bg-green-50 border-green-300'
                  : 'bg-gray-50 border-gray-100 hover:border-green-200'
              }`}>
              <span className="text-xl">{EMOJI[pet.species] || '🐾'}</span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{pet.name}</p>
                <p className="text-xs text-gray-400">{pet.weight ? `${pet.weight}kg` : pet.species}</p>
              </div>
            </button>
          ))}
        </div>
        <div className="p-3 border-t border-gray-100">
          <Link to="/food-database"
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-50 transition-colors">
            🗄️ 食物資料庫
          </Link>
        </div>
      </div>

      {/* 右側主要內容 */}
      <div className="flex-1 overflow-y-auto">
        {!selectedPet ? (
          <div className="flex items-center justify-center h-full flex-col gap-3 text-gray-400">
            <span className="text-5xl">🍽️</span>
            <p className="text-gray-500 font-semibold">請選擇寵物</p>
          </div>
        ) : (
          <div className="p-6 max-w-4xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-xl font-bold text-gray-800">
                  {EMOJI[selectedPet.species]} {selectedPet.name} 的飲食管理
                </h1>
                <p className="text-sm text-gray-400 mt-0.5">記錄和分析每日餵食狀況</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <button onClick={() => goDay(-1)}
                    className="w-8 h-8 flex items-center justify-center border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors text-lg">
                    ‹
                  </button>
                  <input type="date" value={selectedDate}
                    onChange={e => setSelectedDate(e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-400" />
                  <button onClick={() => goDay(1)} disabled={selectedDate >= today}
                    className="w-8 h-8 flex items-center justify-center border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-30 text-lg">
                    ›
                  </button>
                  {selectedDate !== today && (
                    <button onClick={() => setSelectedDate(today)}
                      className="text-xs text-green-500 hover:underline font-medium px-1">
                      今天
                    </button>
                  )}
                </div>
                <button onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm">
                  ＋ 新增餵食
                </button>
              </div>
            </div>

            {/* 統計卡片 */}
            <div className="grid grid-cols-4 gap-3 mb-6">
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">
                  {formatDate(selectedDate)} 熱量
                </p>
                <p className="text-2xl font-bold text-gray-800 mt-1">
                  {todayCalories.toFixed(0)} <span className="text-sm font-normal text-gray-400">kcal</span>
                </p>
                {recommended && (
                  <div className="mt-2">
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>建議 {recommended} kcal</span>
                      <span>{caloriePct.toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all"
                        style={{
                          width: `${caloriePct}%`,
                          backgroundColor: caloriePct > 100 ? '#ef4444' : caloriePct > 80 ? '#f97316' : '#22c55e'
                        }} />
                    </div>
                  </div>
                )}
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">蛋白質</p>
                <p className="text-2xl font-bold text-blue-500 mt-1">
                  {todayProtein.toFixed(1)} <span className="text-sm font-normal text-gray-400">g</span>
                </p>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">脂肪</p>
                <p className="text-2xl font-bold text-amber-500 mt-1">
                  {todayFat.toFixed(1)} <span className="text-sm font-normal text-gray-400">g</span>
                </p>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">餵食次數</p>
                <p className="text-2xl font-bold text-green-500 mt-1">
                  {records.length} <span className="text-sm font-normal text-gray-400">次</span>
                </p>
              </div>
            </div>

            {/* 餵食紀錄列表 */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="text-sm font-bold text-gray-800">
                  {formatDate(selectedDate)} 餵食紀錄
                </h2>
              </div>
              {records.length === 0 ? (
                <div className="py-16 text-center">
                  <p className="text-4xl mb-3">🍽️</p>
                  <p className="text-gray-400 text-sm mb-4">這天還沒有餵食紀錄</p>
                  {selectedDate === today && (
                    <button onClick={() => setShowAddModal(true)}
                      className="bg-green-500 hover:bg-green-600 text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors">
                      新增第一筆
                    </button>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {records.map(record => (
                    <div key={record.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                      <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center text-xl shrink-0">
                        {record.food_name.includes('乾') ? '🥣' : record.food_name.includes('罐') || record.food_name.includes('濕') ? '🥫' : '🍖'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800">{record.food_name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {record.amount_g}g
                          {record.calories ? ` · ${Number(record.calories).toFixed(0)} kcal` : ''}
                          {record.protein_g ? ` · 蛋白質 ${Number(record.protein_g).toFixed(1)}g` : ''}
                          {' · '}{new Date(record.fed_at).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        {record.notes && <p className="text-xs text-gray-400 mt-0.5">注：{record.notes}</p>}
                      </div>
                      {record.calories && (
                        <p className="text-sm font-bold text-gray-700 shrink-0">
                          {Number(record.calories).toFixed(0)} kcal
                        </p>
                      )}
                      <button onClick={() => { if (confirm('確定刪除？')) deleteRecord.mutate(record.id) }}
                        className="text-gray-300 hover:text-red-400 transition-colors shrink-0">🗑️</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 近期熱量趨勢 */}
            {dailyStats.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4">
                <h2 className="text-sm font-bold text-gray-800 mb-4">近期熱量趨勢</h2>
                <div style={{ height: '140px', display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
                  {dailyStats.slice(0, 7).reverse().map((stat, i) => {
                    const max = Math.max(...dailyStats.slice(0,7).map(s => Number(s.total_calories || 0)))
                    const cal = Number(stat.total_calories || 0)
                    const barHeight = max > 0 ? Math.max((cal / max) * 100, 10) : 10
                    const dateStr = typeof stat.date === 'string'
                      ? stat.date.slice(0, 10)
                      : new Date(stat.date).toISOString().slice(0, 10)
                    const isSelected = dateStr === selectedDate
                    return (
                      <div key={i}
                        style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                        onClick={() => setSelectedDate(dateStr)}>
                        <span style={{ fontSize: '10px', color: '#9ca3af', height: '16px', lineHeight: '16px' }}>
                          {cal > 0 ? cal.toFixed(0) : ''}
                        </span>
                        <div style={{
                          width: '100%',
                          height: `${barHeight}px`,
                          maxHeight: '100px',
                          backgroundColor: isSelected ? '#1D9E75' : '#9FE1CB',
                          borderRadius: '4px 4px 0 0',
                          minHeight: '8px',
                          transition: 'background-color 0.2s'
                        }} />
                        <span style={{ fontSize: '10px', color: isSelected ? '#1D9E75' : '#9ca3af', fontWeight: isSelected ? '600' : '400' }}>
                          {dateStr.slice(5)}
                        </span>
                      </div>
                    )
                  })}
                </div>
                {recommended && (
                  <p className="text-xs text-gray-400 mt-3 text-center">
                    建議每日熱量：{recommended} kcal（根據體重 {selectedPet.weight} kg 估算）
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 新增餵食 Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md border border-gray-100">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-gray-800">新增餵食紀錄</h2>
              <button onClick={() => setShowAddModal(false)}
                className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 text-sm">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">選擇食物</label>
                <select value={form.foodItemId} onChange={e => handleFoodSelect(e.target.value)} className={inputCls}>
                  <option value="">-- 從資料庫選擇 --</option>
                  {foods.map(f => (
                    <option key={f.id} value={f.id}>{f.name} {f.brand ? `(${f.brand})` : ''}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                  食物名稱 * <span className="ml-1 text-gray-300 font-normal normal-case">（可手動輸入）</span>
                </label>
                <div className="flex gap-2">
                  <input required value={form.foodName}
                    onChange={e => { setForm(f => ({...f, foodName: e.target.value})); if (!form.foodItemId) setSelectedFood(null) }}
                    placeholder="例如：希爾思乾糧"
                    className={inputCls} />
                  {form.foodName && !selectedFood && (
                    <button type="button" onClick={handleAiAnalyze} disabled={aiAnalyzing}
                      className="shrink-0 bg-green-50 hover:bg-green-100 text-green-600 border border-green-200 rounded-lg px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-50">
                      {aiAnalyzing ? '...' : '🤖 AI'}
                    </button>
                  )}
                </div>
              </div>

              {selectedFood && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                  <p className="text-xs font-semibold text-green-700 mb-2">
                    {selectedFood.notes ? '🤖 AI 估算結果' : '📋 資料庫資料'}
                  </p>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    {[
                      ['熱量', selectedFood.calories_per_100g, 'kcal/100g'],
                      ['蛋白質', selectedFood.protein_pct, '%'],
                      ['脂肪', selectedFood.fat_pct, '%'],
                      ['碳水', selectedFood.carb_pct, '%'],
                    ].map(([label, val, unit]) => (
                      <div key={label} className="bg-white rounded-lg p-2">
                        <p className="text-xs text-gray-400">{label}</p>
                        <p className="text-sm font-bold text-gray-700">{val ? `${val}` : '—'}</p>
                        <p className="text-xs text-gray-400">{unit}</p>
                      </div>
                    ))}
                  </div>
                  {selectedFood.notes && <p className="text-xs text-green-600 mt-2">注：{selectedFood.notes}</p>}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">份量 (g) *</label>
                  <input type="number" required min="0" step="0.1" value={form.amountG}
                    onChange={e => setForm(f => ({...f, amountG: e.target.value}))}
                    placeholder="例如：60" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">餵食時間</label>
                  <input type="datetime-local" value={form.fedAt}
                    onChange={e => setForm(f => ({...f, fedAt: e.target.value}))}
                    className={inputCls} />
                </div>
              </div>

              {nutrition?.calories && (
                <div className="bg-gray-50 rounded-xl p-3 flex items-center justify-between">
                  <p className="text-xs text-gray-500">預估這餐熱量</p>
                  <p className="text-sm font-bold text-green-600">{nutrition.calories} kcal</p>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">備注</label>
                <input value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))}
                  placeholder="選填" className={inputCls} />
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowAddModal(false)}
                  className="flex-1 border border-gray-200 rounded-lg py-2.5 text-sm text-gray-500 hover:bg-gray-50 font-medium transition-colors">取消</button>
                <button type="submit" disabled={addRecord.isPending}
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white rounded-lg py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 shadow-sm">
                  {addRecord.isPending ? '新增中...' : '新增'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}