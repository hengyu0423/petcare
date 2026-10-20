import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  BracketTitle,
  CornerBrackets,
  Button,
  Tag
} from '@endfield-ui/react'
import {
  Dog,
  Cat,
  Bird,
  Rabbit,
  Fish,
  PawPrint,
  Calendar,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  History,
  AlertCircle,
  FileText,
  Clock
} from 'lucide-react'
import { api } from '../lib/api'
import { PetDrawer, PetPickerBar } from '../components/layout/PetDrawer'

const SPECIES_ICONS = {
  dog: Dog,
  cat: Cat,
  bird: Bird,
  rabbit: Rabbit,
  fish: Fish,
  other: PawPrint
}

const getDate = d => new Date(d).toISOString().slice(0, 10)
const formatDate = d => new Date(d).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })
const getMonday = d => {
  const x = new Date(d), day = x.getDay()
  x.setDate(x.getDate() - (day === 0 ? 6 : day - 1))
  return getDate(x)
}
const addDays = (date, n) => {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return getDate(d)
}
const cleanReport = text => {
  if (!text) return ''
  return text.replace(/\\([#*\-])/g, '$1').trim()
}
const previewReport = text => cleanReport(text)
  .replace(/^#{1,6}\s*/gm, '')
  .replace(/\*\*/g, '')
  .replace(/^[-*]\s+/gm, '')
  .replace(/\n+/g, ' ')
  .trim()

const normalizeReport = r => ({
  id: r.id ?? r.reportId,
  pet_id: r.pet_id ?? r.petId,
  week_start: r.week_start ?? r.weekStart,
  week_end: r.week_end ?? r.weekEnd,
  report: r.report ?? '',
  created_at: r.created_at ?? r.createdAt ?? r.updated_at ?? r.updatedAt ?? new Date().toISOString(),
  updated_at: r.updated_at ?? r.updatedAt ?? r.created_at ?? r.createdAt
})

const MarkdownReport = ({ text }) => (
  <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    components={{
      h1: ({ children }) => <h1 className="text-lg font-bold text-[#191919] mt-6 mb-3 border-b-2 border-sky-500 pb-1.5">{children}</h1>,
      h2: ({ children }) => <h2 className="text-sm font-bold text-[#191919] mt-5 mb-2 flex items-center gap-1.5 before:content-['//'] before:text-sky-500 before:font-mono">{children}</h2>,
      h3: ({ children }) => <h3 className="text-xs font-bold text-[#555] mt-4 mb-1.5 font-mono">{children}</h3>,
      p: ({ children }) => <p className="text-xs text-[#333] leading-relaxed mb-3">{children}</p>,
      ul: ({ children }) => <ul className="list-disc ml-5 space-y-1 mb-3 text-xs text-[#444]">{children}</ul>,
      ol: ({ children }) => <ol className="list-decimal ml-5 space-y-1.5 mb-3 text-xs text-[#444]">{children}</ol>,
      li: ({ children }) => <li className="leading-relaxed pl-1">{children}</li>,
      strong: ({ children }) => <strong className="font-bold text-[#191919] bg-amber-100/70 px-1 py-0.2 rounded-2xs border-b border-amber-300">{children}</strong>,
      blockquote: ({ children }) => <blockquote className="border-l-4 border-l-amber-500 bg-amber-50/60 p-3.5 my-3 text-xs text-amber-950 font-medium rounded-r-xs shadow-2xs">{children}</blockquote>,
      hr: () => <hr className="my-5 border-[#e5e5e5]" />
    }}
  >
    {cleanReport(text)}
  </ReactMarkdown>
)

export default function WeeklyReportPage() {
  const [selectedPet, setSelectedPet] = useState(null)
  const [petOpen, setPetOpen] = useState(true)
  const [weekStart, setWeekStart] = useState(getMonday(new Date()))
  const [report, setReport] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const queryClient = useQueryClient()
  const weekEnd = addDays(weekStart, 6)

  const { data: pets = [] } = useQuery({
    queryKey: ['pets'],
    queryFn: () => api.get('/pets').then(r => r.data.data || [])
  })

  // 如果一開始沒有選寵物且有列表，預設選第一隻
  useEffect(() => {
    if (!selectedPet && pets.length > 0) {
      setSelectedPet(pets[0])
      setPetOpen(false)
    }
  }, [pets, selectedPet])

  const {
    data: reports = [],
    isLoading: reportsLoading,
    isError: reportsError
  } = useQuery({
    queryKey: ['weekly-reports', selectedPet?.id],
    queryFn: async () => {
      const { data } = await api.get(`/ai/weekly-report/${selectedPet.id}`)
      const raw = Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data?.reports)
          ? data.reports
          : Array.isArray(data)
            ? data
            : []
      return raw.map(normalizeReport)
    },
    enabled: !!selectedPet?.id,
    retry: 1
  })

  useEffect(() => {
    if (!selectedPet || report || !reports.length) return
    const saved = reports.find(r => r.week_start && getDate(r.week_start) === weekStart)
    if (saved) setReport(saved.report)
  }, [reports, weekStart, selectedPet, report])

  const generateReport = async () => {
    if (!selectedPet) return
    setLoading(true)
    setError('')
    try {
      const { data } = await api.post('/ai/weekly-report', {
        petId: selectedPet.id,
        weekStart,
        weekEnd
      })
      const generated = data?.data?.report
      if (!generated) throw new Error('後端沒有回傳週報內容')
      setReport(generated)

      const saved = normalizeReport({
        id: data.data.reportId,
        petId: selectedPet.id,
        weekStart: data.data.weekStart || weekStart,
        weekEnd: data.data.weekEnd || weekEnd,
        report: generated,
        createdAt: new Date().toISOString()
      })

      queryClient.setQueryData(['weekly-reports', selectedPet.id], old => {
        const list = Array.isArray(old) ? old : []
        const filtered = list.filter(r => !(r.week_start && getDate(r.week_start) === getDate(saved.week_start)))
        return [saved, ...filtered]
      })
      await queryClient.invalidateQueries({ queryKey: ['weekly-reports', selectedPet.id] })
    } catch (err) {
      console.error('生成週報失敗：', err)
      setError(err?.response?.data?.error || '生成失敗，請稍後再試')
    } finally {
      setLoading(false)
    }
  }

  const selectReport = r => {
    setWeekStart(getDate(r.week_start))
    setReport(r.report)
    setError('')
  }

  const changePet = pet => {
    setSelectedPet(pet)
    setPetOpen(false)
    setWeekStart(getMonday(new Date()))
    setReport('')
    setError('')
  }

  const changeWeek = start => {
    setWeekStart(start)
    setReport('')
    setError('')
  }

  return (
    <div className="flex h-full overflow-hidden bg-[#fafafa]" data-theme="light">
      {/* 寵物清單側邊欄 */}
      <PetDrawer open={petOpen} onClose={() => setPetOpen(false)} widthClass="md:w-60">
        <div className="px-4 py-4 border-b border-[#e5e5e5] bg-[#fafafa]">
          <h2 className="text-xs font-bold text-[#191919] uppercase tracking-wider font-mono">
            選擇寵物 // SELECT_PET
          </h2>
          <p className="text-[11px] font-mono text-[#8a8a8a] mt-0.5">查看各別健康週報</p>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {pets.map(pet => {
            const Icon = SPECIES_ICONS[pet.species] || PawPrint
            const active = selectedPet?.id === pet.id
            return (
              <button
                key={pet.id}
                onClick={() => changePet(pet)}
                className={`w-full flex items-center gap-2.5 p-2.5 border text-left transition-colors ${
                  active
                    ? 'bg-[#191919] text-[#fffa00] border-[#191919] font-bold'
                    : 'bg-white border-[#e5e5e5] hover:border-[#191919] text-[#191919]'
                }`}
              >
                <div
                  className={`w-8 h-8 flex items-center justify-center border shrink-0 ${
                    active ? 'bg-[#fffa00] text-[#191919] border-[#fffa00]' : 'bg-[#fafafa] text-[#191919] border-[#e5e5e5]'
                  }`}
                >
                  <Icon size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold truncate">{pet.name}</p>
                  <p className={`text-[10px] font-mono truncate ${active ? 'text-[#fffa00]/80' : 'text-[#8a8a8a]'}`}>
                    {pet.breed || pet.species}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      </PetDrawer>

      {/* 主工作區 */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <PetPickerBar
          name={selectedPet?.name}
          sub={selectedPet ? (selectedPet.breed || selectedPet.species) : ''}
          onOpen={() => setPetOpen(true)}
        />

        {!selectedPet ? (
          <main className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <ClipboardList size={36} className="text-[#8a8a8a] mb-3" />
            <p className="font-bold text-sm text-[#191919]">請於左側選擇寵物</p>
            <p className="text-xs font-mono text-[#8a8a8a] mt-1">建立並檢視 AI 彙整之生活健康週報</p>
          </main>
        ) : (
          <main className="flex-1 min-h-0 min-w-0 overflow-hidden">
            <div className="h-full overflow-y-auto xl:overflow-visible grid grid-cols-1 content-start xl:content-normal xl:grid-cols-[minmax(0,1fr)_340px] gap-5 p-4 sm:p-6 max-w-[1400px] mx-auto">
              
              {/* 週報內容與操作 */}
              <section className="min-w-0 xl:overflow-y-auto xl:pr-1 space-y-4">
                {/* 寵物資訊標題卡 */}
                <div className="relative bg-white border border-[#191919] border-t-4 border-t-[#fffa00] p-5 shadow-xs overflow-hidden">
                  <CornerBrackets size="sm" />
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="bg-[#191919] text-[#fffa00] border border-[#191919] px-2 py-0.5 text-[10px] font-mono font-bold shadow-2xs">
                          WEEKLY.ANALYSIS
                        </span>
                        <span className="text-[11px] font-mono text-[#8a8a8a]">
                          {selectedPet.breed || selectedPet.species}
                        </span>
                      </div>
                      <h1 className="text-xl font-bold text-[#191919]">{selectedPet.name} 的健康週報</h1>
                      <p className="text-xs font-mono text-[#8a8a8a] mt-0.5">
                        區間：<span className="text-[#191919] font-bold">{formatDate(weekStart)} 至 {formatDate(weekEnd)}</span>
                      </p>
                    </div>

                    <div className="w-12 h-12 bg-amber-50 border border-amber-300 flex items-center justify-center text-amber-800 shadow-2xs">
                      {(() => {
                        const Icon = SPECIES_ICONS[selectedPet.species] || PawPrint
                        return <Icon size={24} />
                      })()}
                    </div>
                  </div>
                </div>

                {/* 週次挑選與生成按鈕 */}
                <div className="relative bg-white border border-[#d9d9d9] p-4 shadow-xs">
                  <CornerBrackets size="sm" />
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => changeWeek(addDays(weekStart, -7))}
                        className="w-8 h-8 border border-[#d9d9d9] hover:border-[#191919] flex items-center justify-center text-[#191919] transition-colors"
                        title="上一週"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <div className="flex items-center gap-2 border border-[#d9d9d9] bg-[#fafafa] px-3 py-1.5 text-xs font-mono text-[#191919]">
                        <Calendar size={13} className="text-[#8a8a8a]" />
                        <input
                          type="date"
                          value={weekStart}
                          onChange={e => changeWeek(getMonday(e.target.value))}
                          className="bg-transparent focus:outline-hidden font-mono"
                        />
                      </div>
                      <button
                        onClick={() => changeWeek(addDays(weekStart, 7))}
                        className="w-8 h-8 border border-[#d9d9d9] hover:border-[#191919] flex items-center justify-center text-[#191919] transition-colors"
                        title="下一週"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>

                    <Button
                      variant="action"
                      onClick={generateReport}
                      disabled={loading}
                      className="text-xs py-2 px-4 flex items-center justify-center gap-1.5"
                    >
                      <Sparkles size={14} />
                      <span>{loading ? 'AI 分析彙整中...' : '生成此週 AI 健康週報'}</span>
                    </Button>
                  </div>
                </div>

                {error && (
                  <div className="p-3 bg-red-50 border border-red-300 text-red-700 text-xs flex items-center gap-2 font-mono">
                    <AlertCircle size={15} className="shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* 週報內容檢視卡 */}
                {report ? (
                  <div className="relative bg-white border border-[#191919] border-t-4 border-t-sky-500 p-6 shadow-xs">
                    <CornerBrackets size="md" />

                    <div className="flex items-center justify-between border-b border-[#e5e5e5] pb-3 mb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-4 bg-sky-500 border border-sky-600" />
                        <span className="font-bold text-sm text-[#191919]">健康評估摘要報告</span>
                      </div>
                      <span className="text-[11px] font-mono text-sky-800 bg-sky-50 px-2 py-0.5 border border-sky-200 font-bold">
                        {formatDate(weekStart)} ～ {formatDate(weekEnd)}
                      </span>
                    </div>

                    <MarkdownReport text={report} />

                    <div className="mt-6 pt-3 border-t border-[#e5e5e5] text-[10px] font-mono text-[#8a8a8a] leading-relaxed">
                      // NOTICE: AI 週報依 PawCare 系統紀錄與生活數據整理，非屬醫療診斷，若毛孩有異常不適請盡速諮詢專業獸醫師。
                    </div>
                  </div>
                ) : (
                  <div className="relative bg-white border border-[#d9d9d9] p-12 text-center">
                    <CornerBrackets size="sm" />
                    <FileText size={32} className="text-[#d9d9d9] mx-auto mb-2" />
                    <p className="font-bold text-xs text-[#191919]">本週尚無已產生之週報</p>
                    <p className="text-[11px] font-mono text-[#8a8a8a] mt-1">
                      點擊上方「生成此週 AI 健康週報」開始統整飲食、活動與健康數據
                    </p>
                  </div>
                )}
              </section>

              {/* 歷史週報右側欄 */}
              <aside className="min-w-0 bg-white border border-[#d9d9d9] flex flex-col overflow-hidden max-h-[32rem] xl:max-h-none shadow-xs">
                <div className="px-4 py-3.5 border-b border-[#e5e5e5] bg-[#fafafa] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <History size={14} className="text-[#191919]" />
                    <span className="font-bold text-xs text-[#191919]">歷史週報紀錄</span>
                  </div>
                  <Tag size="sm" variant="default" className="text-[10px] font-mono">
                    {reportsLoading ? '讀取中' : reportsError ? '錯誤' : `${reports.length} 份`}
                  </Tag>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                  {reportsLoading ? (
                    <div className="text-center py-10 text-xs font-mono text-[#8a8a8a]">
                      讀取歷史紀錄中...
                    </div>
                  ) : reportsError ? (
                    <div className="text-center py-10 text-xs text-[#ef4444] font-mono">
                      讀取歷史週報失敗
                    </div>
                  ) : reports.length === 0 ? (
                    <div className="text-center py-10 text-xs font-mono text-[#8a8a8a]">
                      暫無歷史週報
                    </div>
                  ) : (
                    reports.map(r => {
                      const isCurrent = r.week_start && getDate(r.week_start) === weekStart
                      return (
                        <button
                          key={r.id || `${r.week_start}-${r.created_at}`}
                          onClick={() => selectReport(r)}
                          className={`w-full text-left p-3 border transition-colors ${
                            isCurrent
                              ? 'bg-[#191919] text-white border-[#191919]'
                              : 'bg-white border-[#e5e5e5] hover:border-[#191919] text-[#191919]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="font-bold text-xs">
                              {formatDate(r.week_start)} ～ {formatDate(r.week_end)}
                            </span>
                            {isCurrent && (
                              <span className="text-[9px] font-mono bg-[#fffa00] text-[#191919] px-1.5 py-0.2 font-bold">
                                ACTIVE
                              </span>
                            )}
                          </div>
                          <p className={`text-[10px] font-mono mt-0.5 ${isCurrent ? 'text-white/60' : 'text-[#8a8a8a]'}`}>
                            生成時間：{new Date(r.created_at).toLocaleDateString('zh-TW')}
                          </p>
                          <p className={`text-xs mt-2 line-clamp-2 leading-relaxed ${isCurrent ? 'text-white/80' : 'text-[#555]'}`}>
                            {previewReport(r.report)}
                          </p>
                        </button>
                      )
                    })
                  )}
                </div>
              </aside>

            </div>
          </main>
        )}
      </div>
    </div>
  )
}
