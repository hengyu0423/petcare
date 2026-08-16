import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'

const EMOJI = { dog:'🐶', cat:'🐱', bird:'🐦', rabbit:'🐰', fish:'🐟', other:'🐾' }

const SPECIES_COLOR = {
  dog: 'from-amber-400 to-orange-500',
  cat: 'from-purple-400 to-pink-500',
  bird: 'from-sky-400 to-blue-500',
  rabbit: 'from-pink-400 to-rose-500',
  fish: 'from-cyan-400 to-teal-500',
  other: 'from-green-400 to-emerald-500',
}

export default function WeeklyReportPage() {
  const [selectedPet, setSelectedPet] = useState(null)
  const [report, setReport] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [generated, setGenerated] = useState(false)

  const { data: pets = [] } = useQuery({
    queryKey: ['pets'],
    queryFn: () => api.get('/pets').then(r => r.data.data)
  })

  const { data: feedingStats = [] } = useQuery({
    queryKey: ['feeding-stats', selectedPet?.id],
    queryFn: () => api.get(`/feeding/pet/${selectedPet.id}/daily-stats`).then(r => r.data.data),
    enabled: !!selectedPet
  })

  const { data: consultations = [] } = useQuery({
    queryKey: ['consultations', selectedPet?.id],
    queryFn: () => api.get(`/consultations/pet/${selectedPet.id}`).then(r => r.data.data),
    enabled: !!selectedPet
  })

  const { data: allExpenses = [] } = useQuery({
    queryKey: ['expenses-pet', selectedPet?.id],
    queryFn: () => api.get(`/expenses/pet/${selectedPet.id}`).then(r => r.data.data),
    enabled: !!selectedPet
  })

  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const weekFeeding = feedingStats.filter(s => {
    const d = typeof s.date === 'string' ? s.date.slice(0,10) : new Date(s.date).toISOString().slice(0,10)
    return new Date(d) >= oneWeekAgo
  })

  const weekConsults = consultations.filter(c => new Date(c.created_at) >= oneWeekAgo)
  const weekExpenses = allExpenses.filter(e => new Date(e.date) >= oneWeekAgo)
  const weekTotalCalories = weekFeeding.reduce((s, f) => s + Number(f.total_calories || 0), 0)
  const weekTotalExpense = weekExpenses.reduce((s, e) => s + Number(e.amount || 0), 0)

  const generateReport = async () => {
    if (!selectedPet) return
    setLoading(true); setError(''); setReport(''); setGenerated(false)
    try {
      const { data } = await api.post('/ai/weekly-report', {
        pet: selectedPet,
        feedingStats: weekFeeding,
        healthConsults: weekConsults,
        expenses: weekExpenses
      })
      setReport(data.data.report)
      setGenerated(true)
    } catch (err) {
      setError('生成失敗，請稍後再試')
    } finally { setLoading(false) }
  }

  const formatReport = (text) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-gray-800 block mt-4 mb-1 text-base">$1</strong>')
      .replace(/\n/g, '<br/>')
  }

  const today = new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })
  const weekStartStr = oneWeekAgo.toLocaleDateString('zh-TW', { month: 'long', day: 'numeric' })

  const statCards = selectedPet ? [
    { label: '餵食天數', value: weekFeeding.length, unit: '天', icon: '🍽️', bg: 'bg-green-50', text: 'text-green-600' },
    { label: '總熱量', value: weekTotalCalories.toFixed(0), unit: 'kcal', icon: '🔥', bg: 'bg-orange-50', text: 'text-orange-500' },
    { label: '健康諮詢', value: weekConsults.length, unit: '筆', icon: '🏥', bg: 'bg-blue-50', text: 'text-blue-500' },
    { label: '本週支出', value: `RM ${weekTotalExpense.toFixed(0)}`, unit: '', icon: '💰', bg: 'bg-amber-50', text: 'text-amber-500' },
  ] : []

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* 左側：選擇寵物 */}
      <div className="w-56 bg-white border-r border-gray-200 flex flex-col shrink-0">
        <div className="px-4 py-5 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-800">選擇寵物</h2>
          <p className="text-xs text-gray-400 mt-0.5">生成每週健康報告</p>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {pets.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-8">還沒有寵物</p>
          ) : pets.map(pet => (
            <button key={pet.id}
              onClick={() => { setSelectedPet(pet); setReport(''); setGenerated(false); setError('') }}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                selectedPet?.id === pet.id
                  ? 'bg-green-50 border-green-300 shadow-sm'
                  : 'bg-gray-50 border-gray-100 hover:border-green-200 hover:bg-green-50'
              }`}>
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${SPECIES_COLOR[pet.species] || SPECIES_COLOR.other} flex items-center justify-center text-xl shrink-0 shadow-sm`}>
                {EMOJI[pet.species] || '🐾'}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{pet.name}</p>
                <p className="text-xs text-gray-400">{pet.breed || pet.species}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 右側 */}
      <div className="flex-1 overflow-y-auto">
        {!selectedPet ? (
          <div className="flex items-center justify-center h-full flex-col gap-4">
            <div className="w-24 h-24 rounded-3xl bg-green-50 flex items-center justify-center text-5xl shadow-sm">
              📋
            </div>
            <p className="text-lg font-bold text-gray-600">健康週報</p>
            <p className="text-sm text-gray-400">從左側選擇一隻寵物，生成本週健康分析報告</p>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto p-6">

            {/* Header */}
            <div className={`bg-gradient-to-br ${SPECIES_COLOR[selectedPet.species] || SPECIES_COLOR.other} rounded-2xl p-6 mb-5 text-white shadow-sm`}>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center text-3xl">
                  {EMOJI[selectedPet.species] || '🐾'}
                </div>
                <div>
                  <p className="text-xs text-white/70 font-medium uppercase tracking-wide">健康週報</p>
                  <h1 className="text-xl font-bold">{selectedPet.name}</h1>
                  <p className="text-sm text-white/80 mt-0.5">{weekStartStr} ～ {today}</p>
                </div>
              </div>
            </div>

            {/* 統計卡片 */}
            <div className="grid grid-cols-4 gap-3 mb-5">
              {statCards.map(card => (
                <div key={card.label} className={`${card.bg} rounded-xl p-4 text-center`}>
                  <p className="text-2xl mb-1">{card.icon}</p>
                  <p className={`text-lg font-bold ${card.text}`}>
                    {card.value}
                    {card.unit && <span className="text-xs font-normal text-gray-400 ml-0.5">{card.unit}</span>}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{card.label}</p>
                </div>
              ))}
            </div>

            {/* 未生成狀態 */}
            {!generated && !loading && !error && (
              <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-10 text-center">
                <div className="text-5xl mb-4">✨</div>
                <p className="text-gray-600 font-semibold mb-2">準備生成本週健康週報</p>
                <p className="text-sm text-gray-400 mb-6">
                  AI 將整合 {selectedPet.name} 本週的飲食記錄、<br/>健康諮詢和支出資料，生成完整分析報告
                </p>
                <div className="flex items-center justify-center gap-4 text-xs text-gray-400 mb-6">
                  <span className="flex items-center gap-1">🍽️ {weekFeeding.length} 天餵食紀錄</span>
                  <span className="flex items-center gap-1">🏥 {weekConsults.length} 筆諮詢</span>
                  <span className="flex items-center gap-1">💰 {weekExpenses.length} 筆支出</span>
                </div>
                <button onClick={generateReport}
                  className={`bg-gradient-to-r ${SPECIES_COLOR[selectedPet.species] || SPECIES_COLOR.other} text-white px-8 py-3 rounded-xl text-sm font-semibold transition-all hover:opacity-90 shadow-sm`}>
                  ✨ 立即生成週報
                </button>
              </div>
            )}

            {/* 載入中 */}
            {loading && (
              <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center shadow-sm">
                <div className="flex gap-2 justify-center mb-5">
                  {[0,1,2,3,4].map(i => (
                    <div key={i} className="w-2.5 h-2.5 rounded-full animate-bounce"
                      style={{
                        animationDelay: `${i * 0.1}s`,
                        backgroundColor: ['#1D9E75','#22c55e','#4ade80','#22c55e','#1D9E75'][i]
                      }} />
                  ))}
                </div>
                <p className="text-gray-600 font-semibold mb-1">AI 正在分析本週數據...</p>
                <p className="text-sm text-gray-400">整合飲食、健康和支出資料中，請稍候</p>
              </div>
            )}

            {/* 錯誤 */}
            {error && (
              <div className="bg-red-50 border border-red-100 rounded-2xl p-6 text-center">
                <p className="text-3xl mb-2">😔</p>
                <p className="text-red-500 font-semibold mb-3">{error}</p>
                <button onClick={generateReport}
                  className="bg-red-500 hover:bg-red-600 text-white px-5 py-2 rounded-xl text-sm font-semibold transition-colors">
                  重試
                </button>
              </div>
            )}

            {/* 週報內容 */}
            {report && (
              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                {/* 週報 Header */}
                <div className={`bg-gradient-to-r ${SPECIES_COLOR[selectedPet.species] || SPECIES_COLOR.other} px-6 py-5`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-2xl">
                        {EMOJI[selectedPet.species] || '🐾'}
                      </div>
                      <div>
                        <p className="text-white font-bold">{selectedPet.name} 的健康週報</p>
                        <p className="text-white/70 text-xs">{weekStartStr} ～ {today}</p>
                      </div>
                    </div>
                    <span className="text-xs bg-white/20 text-white px-2.5 py-1 rounded-full border border-white/20">
                      Powered by Groq
                    </span>
                  </div>
                </div>

                {/* 週報內文 */}
                <div className="p-6">
                  <div className="text-sm text-gray-600 leading-loose"
                    dangerouslySetInnerHTML={{ __html: formatReport(report) }} />
                </div>

                {/* 底部重新生成 */}
                <div className="px-6 py-5 bg-gray-50 border-t border-gray-100">
                  <p className="text-xs text-gray-400 mb-3 text-center">
                    ⚠️ 此週報由 AI 生成，僅供參考，不能替代專業獸醫診斷
                  </p>
                  <button onClick={generateReport} disabled={loading}
                    className={`w-full flex items-center justify-center gap-2 bg-gradient-to-r ${SPECIES_COLOR[selectedPet.species] || SPECIES_COLOR.other} text-white py-3 rounded-xl text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50 shadow-sm`}>
                    {loading ? (
                      <>
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                        </svg>
                        重新生成中...
                      </>
                    ) : '🔄 重新生成週報'}
                  </button>
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  )
}