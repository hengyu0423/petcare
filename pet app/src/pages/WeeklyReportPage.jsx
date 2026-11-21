import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { api } from '../lib/api'
import { PetDrawer, PetPickerBar } from '../components/layout/PetDrawer'
import PetIcon from '../components/brand/PetIcon'

const getDate = d => new Date(d).toISOString().slice(0, 10)
const formatDate = d => new Date(d).toLocaleDateString('zh-TW', { month: 'long', day: 'numeric' })
const getMonday = d => {
  const x = new Date(d), day = x.getDay()
  x.setDate(x.getDate() - (day === 0 ? 6 : day - 1))
  return getDate(x)
}
const addDays = (date, n) => {
  const d = new Date(date); d.setDate(d.getDate() + n); return getDate(d)
}
const cleanReport = text => {
  if (!text) return ''
  return text.replace(/\\([#*-])/g, '$1').trim()
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

const ICON = {
  left: <path d="M15 6l-6 6 6 6" />,
  right: <path d="M9 6l6 6-6 6" />,
  spark: <><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3Z" /><path d="M18.5 15l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9.9-2.1Z" /></>,
  book: <><path d="M5 4.5h6a2.5 2.5 0 0 1 2.5 2.5v12A2.5 2.5 0 0 0 11 16.5H5Z" /><path d="M19 4.5h-6A2.5 2.5 0 0 0 10.5 7v12A2.5 2.5 0 0 1 13 16.5h6Z" /></>,
  clock: <><circle cx="12" cy="12" r="8" /><path d="M12 7.5V12l3 2" /></>,
  alert: <><path d="M12 4.5 21 19.5H3L12 4.5Z" /><path d="M12 10v4M12 17h.01" /></>,
  inbox: <><path d="M4 13.5 6 5h12l2 8.5" /><path d="M4 13.5h4l1.5 2.5h5L16 13.5h4V19H4Z" /></>,
  clipboard: <><rect x="5" y="4.5" width="14" height="16" rx="2" /><path d="M9 4.5V3h6v1.5" /><path d="M9 10h6M9 14h6M9 17.5h3" /></>,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />
}

function LineIcon({ name, size = 16 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      {ICON[name] || ICON.clipboard}
    </svg>
  )
}

const cardCls = 'rounded-3xl border border-[#f3e3cd] bg-plate'

const MarkdownReport = ({ text }) => (
  <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    components={{
      h1: ({ children }) => <h1 className="mt-7 mb-3 text-xl font-extrabold text-pine-900">{children}</h1>,
      h2: ({ children }) => <h2 className="mt-7 mb-3 border-b border-[#f3ead9] pb-2 text-base font-bold text-pine-900 first:mt-0">{children}</h2>,
      h3: ({ children }) => <h3 className="mt-5 mb-2 text-sm font-bold text-pine-800">{children}</h3>,
      p: ({ children }) => <p className="mb-3 text-sm leading-7 text-ink">{children}</p>,
      ul: ({ children }) => <ul className="ml-6 mb-4 space-y-1.5 text-ink">{children}</ul>,
      ol: ({ children }) => <ol className="ml-6 mb-4 space-y-2 text-ink">{children}</ol>,
      li: ({ children }) => <li className="pl-1 text-sm leading-6">{children}</li>,
      strong: ({ children }) => <strong className="font-bold text-pine-900">{children}</strong>,
      blockquote: ({ children }) => <blockquote className="my-4 rounded-r-xl border-l-4 border-[#e8a33d] bg-[#fff8e9] px-4 py-3 text-sm text-[#7a5200]">{children}</blockquote>,
      hr: () => <hr className="my-6 border-[#f3ead9]" />
    }}
  >
    {cleanReport(text)}
  </ReactMarkdown>
)

export default function WeeklyReportPage() {
  const [selectedPet, setSelectedPet] = useState(null)
  const [petOpen, setPetOpen] = useState(true) // 一開始沒選寵物，所以先展開
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

  // 用推導代替在 effect 裡 setState：切換週次時自動帶出該週已保存的週報
  const savedReport = reports.find(r => r.week_start && getDate(r.week_start) === weekStart)
  const displayReport = report || savedReport?.report || ''

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
    <div className="flex h-full overflow-hidden bg-paper">
      <PetDrawer open={petOpen} onClose={() => setPetOpen(false)} widthClass="md:w-56">
        <div className="border-b border-[#f0e6d2] px-4 py-5">
          <h2 className="text-sm font-bold text-pine-900">選擇寵物</h2>
          <p className="mt-1 text-xs text-ink-soft">查看健康週報</p>
        </div>
        <div className="flex-1 space-y-2 overflow-y-auto p-3">
          {pets.map(pet => (
            <button
              key={pet.id}
              onClick={() => changePet(pet)}
              className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                selectedPet?.id === pet.id
                  ? 'border-pine-700/35 bg-pine-50'
                  : 'border-[#eae6d8] bg-[#faf7ef] hover:border-pine-700/30 hover:bg-[#fdf6ea]'
              }`}
            >
              <PetIcon species={pet.species} size={40} className="h-10 w-10 shrink-0" />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-pine-900">{pet.name}</p>
                <p className="truncate text-xs text-ink-soft">{pet.breed || pet.species}</p>
              </div>
            </button>
          ))}
        </div>
      </PetDrawer>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <PetPickerBar
          icon={selectedPet ? <PetIcon species={selectedPet.species} size={28} className="h-7 w-7 shrink-0" /> : null}
          name={selectedPet?.name}
          sub={selectedPet ? (selectedPet.breed || selectedPet.species) : ''}
          onOpen={() => setPetOpen(true)}
        />

        {!selectedPet ? (
          <main className="flex flex-1 flex-col items-center justify-center p-6 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#fdf6ea] text-pine-700">
              <LineIcon name="clipboard" size={26} />
            </span>
            <p className="mt-3 font-bold text-pine-900">健康週報</p>
            <p className="mt-1 text-sm text-ink-soft">請選擇寵物</p>
          </main>
        ) : (
          <main className="min-h-0 min-w-0 flex-1 overflow-hidden">
            <div className="mx-auto grid h-full grid-cols-1 content-start gap-4 overflow-y-auto p-3 sm:p-5 xl:grid-cols-[minmax(0,1fr)_360px] xl:content-normal xl:overflow-visible">
              <section className="min-w-0 xl:overflow-y-auto xl:pr-1">
                <div className="mb-4 rounded-3xl bg-pine-800 p-5 text-[#fdf8ec] shadow-[0_20px_40px_-24px_rgba(24,48,31,0.8)]">
                  <div className="flex items-center gap-3">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f5c04a] text-pine-900">
                      <PetIcon species={selectedPet.species} size={32} className="h-8 w-8" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-[#f5c04a]">AI 健康週報</p>
                      <h1 className="font-brand text-xl font-extrabold">{selectedPet.name}</h1>
                      <p className="text-xs text-[#fdf8ec]/80">{formatDate(weekStart)} ～ {formatDate(weekEnd)}</p>
                    </div>
                  </div>
                </div>

                <div className={`${cardCls} mb-4 p-4`}>
                  <div className="flex items-center justify-between gap-3">
                    <button
                      onClick={() => changeWeek(addDays(weekStart, -7))}
                      aria-label="上一週"
                      className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#faf7ef] text-pine-800 transition-colors hover:bg-[#f2ead8]"
                    >
                      <LineIcon name="left" size={18} />
                    </button>
                    <input
                      type="date"
                      value={weekStart}
                      onChange={e => changeWeek(getMonday(e.target.value))}
                      className="rounded-xl border border-[#eae6d8] bg-[#faf7ef] px-3 py-2 text-sm text-ink focus:border-pine-700/40 focus:outline-none"
                    />
                    <button
                      onClick={() => changeWeek(addDays(weekStart, 7))}
                      aria-label="下一週"
                      className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#faf7ef] text-pine-800 transition-colors hover:bg-[#f2ead8]"
                    >
                      <LineIcon name="right" size={18} />
                    </button>
                  </div>
                  <button
                    onClick={generateReport}
                    disabled={loading}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#f5c04a] py-3 text-sm font-extrabold text-pine-900 shadow-[0_5px_0_#c96f2e] transition-all hover:bg-[#f0b23a] active:translate-y-[3px] active:shadow-none disabled:opacity-50"
                  >
                    <LineIcon name="spark" size={17} />
                    {loading ? 'AI 分析中…' : '生成這一週的 AI 健康週報'}
                  </button>
                </div>

                {error && (
                  <div role="alert" className="mb-4 rounded-xl border border-[#f3c2b8] bg-[#fdf0ec] p-4 text-sm text-[#b4552f]">
                    {error}
                  </div>
                )}

                {displayReport ? (
                  <div className={`${cardCls} overflow-hidden`}>
                    <div className="flex items-center justify-between gap-3 bg-pine-700 px-5 py-4 text-[#fdf8ec]">
                      <div>
                        <p className="mb-1 text-[11px] font-semibold text-[#f5c04a]">AI 分析結果</p>
                        <p className="font-bold">{selectedPet.name} 的健康週報</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-white/15 px-2.5 py-1 text-xs">
                        {formatDate(weekStart)} ～ {formatDate(weekEnd)}
                      </span>
                    </div>
                    <div className="p-4 sm:p-6 md:p-7">
                      <MarkdownReport text={displayReport} />
                      <div className="mt-7 border-t border-[#f3ead9] pt-4 text-[11px] leading-5 text-ink-soft/80">
                        AI 週報依 PawCare 系統中的紀錄進行整理與分析；攝影機狀態屬於姿態與活動量推測，不等同醫療診斷。
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-3xl border border-dashed border-[#e8d9bd] bg-[#faf7ef] p-12 text-center">
                    <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-plate text-pine-700">
                      <LineIcon name="clipboard" size={22} />
                    </span>
                    <p className="mt-3 font-semibold text-pine-900">尚未顯示週報</p>
                    <p className="mt-1 text-xs text-ink-soft">若這週曾生成過，會自動載入；也可以點擊上方按鈕重新分析</p>
                  </div>
                )}
              </section>

              <aside className={`${cardCls} flex max-h-[32rem] min-w-0 flex-col overflow-hidden shadow-sm xl:max-h-none`}>
                <div className="shrink-0 border-b border-[#f0e6d2] px-5 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="flex items-center gap-1.5 font-bold text-pine-900">
                        <LineIcon name="book" size={16} />
                        歷史週報
                      </h2>
                      <p className="mt-1 text-xs text-ink-soft">點擊即可查看過往週報</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-pine-50 px-2.5 py-1 text-xs font-semibold text-pine-700">
                      {reportsLoading ? '讀取中' : reportsError ? '讀取失敗' : `${reports.length} 份`}
                    </span>
                  </div>
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto p-3">
                  {reportsLoading ? (
                    <div className="flex h-full flex-col items-center justify-center px-5 text-center">
                      <span className="text-pine-700"><LineIcon name="clock" size={26} /></span>
                      <p className="mt-3 text-sm text-ink-soft">正在讀取歷史週報...</p>
                    </div>
                  ) : reportsError ? (
                    <div className="flex h-full flex-col items-center justify-center px-5 text-center">
                      <span className="text-[#b4552f]"><LineIcon name="alert" size={26} /></span>
                      <p className="mt-3 text-sm font-semibold text-[#b4552f]">歷史週報讀取失敗</p>
                      <p className="mt-1 text-xs text-ink-soft">請確認後端有 GET /api/ai/weekly-report/:petId</p>
                    </div>
                  ) : reports.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center px-5 text-center">
                      <span className="text-pine-700"><LineIcon name="inbox" size={26} /></span>
                      <p className="mt-3 text-sm font-semibold text-ink">目前還沒有歷史週報</p>
                      <p className="mt-1 text-xs text-ink-soft">生成週報後會自動保存並顯示在這裡</p>
                    </div>
                  ) : reports.map(r => (
                    <button
                      key={r.id || `${r.week_start}-${r.created_at}`}
                      onClick={() => selectReport(r)}
                      className={`w-full overflow-hidden rounded-xl border text-left transition-colors hover:bg-[#fdf6ea] ${
                        r.week_start && getDate(r.week_start) === weekStart
                          ? 'border-pine-700/40 bg-pine-50'
                          : 'border-[#eae6d8] bg-[#faf7ef] hover:border-pine-700/30'
                      }`}
                    >
                      <div className="border-b border-[#f3ead9] px-4 py-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-bold text-pine-900">{formatDate(r.week_start)} ～ {formatDate(r.week_end)}</p>
                          {r.week_start && getDate(r.week_start) === weekStart && (
                            <span className="shrink-0 rounded-full bg-pine-800 px-2 py-0.5 text-[10px] font-bold text-[#fdf8ec]">目前</span>
                          )}
                        </div>
                        <p className="mt-1 text-[11px] text-ink-soft">生成於 {new Date(r.created_at).toLocaleDateString('zh-TW')}</p>
                      </div>
                      <div className="px-4 py-3">
                        <p className="line-clamp-3 text-xs leading-relaxed text-ink-soft">{previewReport(r.report)}</p>
                        <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-pine-700">
                          查看週報 <LineIcon name="arrow" size={13} />
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </aside>
            </div>
          </main>
        )}
      </div>
    </div>
  )
}
