import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

const EMOJI={dog:'🐶',cat:'🐱',bird:'🐦',rabbit:'🐰',fish:'🐟',other:'🐾'}
const COLOR={dog:'from-amber-400 to-orange-500',cat:'from-purple-400 to-pink-500',bird:'from-sky-400 to-blue-500',rabbit:'from-pink-400 to-rose-500',fish:'from-cyan-400 to-teal-500',other:'from-green-400 to-emerald-500'}

const getDate=d=>new Date(d).toISOString().slice(0,10)
const formatDate=d=>new Date(d).toLocaleDateString('zh-TW',{month:'long',day:'numeric'})
const getMonday=d=>{
  const x=new Date(d), day=x.getDay()
  x.setDate(x.getDate()-(day===0?6:day-1))
  return getDate(x)
}
const addDays=(date,n)=>{
  const d=new Date(date); d.setDate(d.getDate()+n); return getDate(d)
}

export default function WeeklyReportPage(){
  const [selectedPet,setSelectedPet]=useState(null)
  const [weekStart,setWeekStart]=useState(getMonday(new Date()))
  const [report,setReport]=useState('')
  const [loading,setLoading]=useState(false)
  const [error,setError]=useState('')
  const queryClient=useQueryClient()

  const weekEnd=addDays(weekStart,6)

  const {data:pets=[]}=useQuery({
    queryKey:['pets'],
    queryFn:()=>api.get('/pets').then(r=>r.data.data)
  })

  const {data:reports=[]}=useQuery({
    queryKey:['weekly-reports',selectedPet?.id],
    queryFn:()=>api.get(`/ai/weekly-reports/${selectedPet.id}`).then(r=>r.data.data),
    enabled:!!selectedPet
  })

  const {data:feedingStats=[]}=useQuery({
    queryKey:['feeding-stats',selectedPet?.id],
    queryFn:()=>api.get(`/feeding/pet/${selectedPet.id}/daily-stats`).then(r=>r.data.data),
    enabled:!!selectedPet
  })

  const {data:consultations=[]}=useQuery({
    queryKey:['consultations',selectedPet?.id],
    queryFn:()=>api.get(`/consultations/pet/${selectedPet.id}`).then(r=>r.data.data),
    enabled:!!selectedPet
  })

  const {data:expenses=[]}=useQuery({
    queryKey:['expenses-pet',selectedPet?.id],
    queryFn:()=>api.get(`/expenses/pet/${selectedPet.id}`).then(r=>r.data.data),
    enabled:!!selectedPet
  })

  const currentData=useMemo(()=>{
    if(!selectedPet)return null
    const feeding=feedingStats.filter(x=>getDate(x.date)>=weekStart&&getDate(x.date)<=weekEnd)
    const consults=consultations.filter(x=>getDate(x.created_at)>=weekStart&&getDate(x.created_at)<=weekEnd)
    const money=expenses.filter(x=>getDate(x.date)>=weekStart&&getDate(x.date)<=weekEnd)
    return {
      feeding,consults,money,
      calories:feeding.reduce((s,x)=>s+Number(x.total_calories||0),0),
      expense:money.reduce((s,x)=>s+Number(x.amount||0),0)
    }
  },[selectedPet,feedingStats,consultations,expenses,weekStart,weekEnd])

  const generateReport=async()=>{
    if(!selectedPet||!currentData)return
    setLoading(true);setError('')
    try{
      const {data}=await api.post('/ai/weekly-report',{
        pet:selectedPet,
        feedingStats:currentData.feeding,
        healthConsults:currentData.consults,
        expenses:currentData.money,
        weekStart,
        weekEnd
      })
      setReport(data.data.report)
      queryClient.invalidateQueries({queryKey:['weekly-reports',selectedPet.id]})
    }catch(err){setError('生成失敗，請稍後再試')}
    finally{setLoading(false)}
  }

  const formatReport=text=>text.replace(/\*\*(.*?)\*\*/g,'<strong class="block mt-3 mb-1 text-gray-800">$1</strong>').replace(/\n/g,'<br/>')

  const selectReport=r=>{
    setWeekStart(getDate(r.week_start))
    setReport(r.report)
    setError('')
  }

  const changePet=pet=>{
    setSelectedPet(pet);setReport('');setError('')
  }

  return(
  <div className="flex h-screen overflow-hidden bg-gray-50">
    <aside className="w-56 bg-white border-r border-gray-200 shrink-0 flex flex-col">
      <div className="px-4 py-5 border-b border-gray-100">
        <h2 className="text-sm font-bold text-gray-800">選擇寵物</h2>
        <p className="text-xs text-gray-400 mt-1">查看健康週報</p>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {pets.map(pet=>(
          <button key={pet.id} onClick={()=>changePet(pet)}
            className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition ${selectedPet?.id===pet.id?'bg-green-50 border-green-300 shadow-sm':'bg-gray-50 border-gray-100 hover:bg-green-50'}`}>
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${COLOR[pet.species]||COLOR.other} flex items-center justify-center text-xl`}>{EMOJI[pet.species]||'🐾'}</div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{pet.name}</p>
              <p className="text-xs text-gray-400">{pet.breed||pet.species}</p>
            </div>
          </button>
        ))}
      </div>
    </aside>

    {!selectedPet?(
      <main className="flex-1 flex flex-col items-center justify-center">
        <div className="text-5xl mb-4">📋</div>
        <p className="font-bold text-gray-600">健康週報</p>
        <p className="text-sm text-gray-400 mt-1">請從左側選擇寵物</p>
      </main>
    ):(
      <main className="flex-1 min-w-0 overflow-hidden">
        <div className="h-full grid grid-cols-[minmax(0,1fr)_360px] gap-5 p-5 max-w-[1400px] mx-auto">
          
          <section className="min-w-0 overflow-y-auto pr-1">
            <div className={`bg-gradient-to-br ${COLOR[selectedPet.species]||COLOR.other} rounded-2xl p-5 mb-4 text-white shadow-sm`}>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center text-3xl">{EMOJI[selectedPet.species]||'🐾'}</div>
                <div>
                  <p className="text-xs text-white/70">健康週報</p>
                  <h1 className="text-xl font-bold">{selectedPet.name}</h1>
                  <p className="text-sm text-white/80">{formatDate(weekStart)} ～ {formatDate(weekEnd)}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <button onClick={()=>{setWeekStart(addDays(weekStart,-7));setReport('')}} className="w-10 h-10 rounded-lg bg-gray-100 hover:bg-gray-200 text-lg">←</button>
                <input type="date" value={weekStart} onChange={e=>{setWeekStart(getMonday(e.target.value));setReport('')}} className="border rounded-lg px-3 py-2 text-sm"/>
                <button onClick={()=>{setWeekStart(addDays(weekStart,7));setReport('')}} className="w-10 h-10 rounded-lg bg-gray-100 hover:bg-gray-200 text-lg">→</button>
              </div>
              <button onClick={generateReport} disabled={loading}
                className={`w-full mt-3 py-3 rounded-xl text-white font-semibold bg-gradient-to-r ${COLOR[selectedPet.species]||COLOR.other} disabled:opacity-50 hover:shadow-md transition`}>
                {loading?'✨ AI 生成中...':'✨ 生成這一週的週報'}
              </button>
            </div>

            {error&&<div className="bg-red-50 border border-red-100 text-red-500 rounded-xl p-4 mb-4 text-sm">{error}</div>}

            {report?(
              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                <div className={`bg-gradient-to-r ${COLOR[selectedPet.species]||COLOR.other} px-5 py-4 text-white`}>
                  <div className="flex items-center justify-between">
                    <p className="font-bold">{selectedPet.name} 的健康週報</p>
                    <span className="text-xs bg-white/20 px-2 py-1 rounded-full">本週</span>
                  </div>
                  <p className="text-xs text-white/70 mt-1">{formatDate(weekStart)} ～ {formatDate(weekEnd)}</p>
                </div>
                <div className="p-5 text-sm text-gray-600 leading-loose" dangerouslySetInnerHTML={{__html:formatReport(report)}}/>
              </div>
            ):(
              <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-12 text-center">
                <div className="text-4xl mb-3">📋</div>
                <p className="font-semibold text-gray-600">尚未生成週報</p>
                <p className="text-xs text-gray-400 mt-1">選擇日期後，點擊上方按鈕生成 AI 健康週報</p>
              </div>
            )}
          </section>

          <aside className="min-w-0 bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-gray-800">📚 歷史週報</h2>
                  <p className="text-xs text-gray-400 mt-1">點擊即可查看過往週報</p>
                </div>
                <span className="text-xs font-medium text-green-600 bg-green-50 px-2.5 py-1 rounded-full">{reports.length} 份</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {reports.length===0?(
                <div className="h-full flex flex-col items-center justify-center text-center px-5">
                  <div className="text-4xl mb-3">📭</div>
                  <p className="text-sm font-medium text-gray-500">目前還沒有歷史週報</p>
                  <p className="text-xs text-gray-400 mt-1">生成週報後會自動保存</p>
                </div>
              ):reports.map(r=>(
                <button key={r.id} onClick={()=>selectReport(r)}
                  className={`w-full text-left rounded-xl border overflow-hidden transition hover:shadow-sm ${getDate(r.week_start)===weekStart?'border-green-400 bg-green-50/40':'border-gray-200 bg-white hover:border-green-300'}`}>
                  <div className="px-4 py-3 border-b border-gray-100">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-sm text-gray-700">{formatDate(r.week_start)} ～ {formatDate(r.week_end)}</p>
                      {getDate(r.week_start)===weekStart&&<span className="text-[10px] text-green-600 bg-green-100 px-2 py-0.5 rounded-full shrink-0">目前</span>}
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">生成於 {new Date(r.created_at).toLocaleDateString('zh-TW')}</p>
                  </div>
                  <div className="px-4 py-3">
                    <div className="text-xs text-gray-500 leading-relaxed line-clamp-3" dangerouslySetInnerHTML={{__html:formatReport(r.report)}}/>
                    <p className="text-xs text-green-600 font-medium mt-2">查看週報 →</p>
                  </div>
                </button>
              ))}
            </div>
          </aside>
        </div>
      </main>
    )}
  </div>
)
}