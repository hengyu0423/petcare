import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import {
  SectionTitle,
  BracketTitle,
  Stat,
  RollingNumber,
  Tag,
  TagPair,
  Button,
  RecIndicator,
  Texture,
  RegistrationStrip,
  Progress,
  CornerBrackets,
  ArrowRight
} from '@endfield-ui/react'
import {
  Dog,
  Cat,
  Bird,
  Fish,
  Rabbit,
  PawPrint,
  Zap,
  Moon,
  Eye,
  Smile,
  Compass,
  CreditCard,
  ClipboardCheck,
  Bell,
  Wallet,
  BarChart3
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { api } from '../lib/api'

const SPECIES_ICONS = {
  dog: Dog,
  cat: Cat,
  bird: Bird,
  rabbit: Rabbit,
  fish: Fish,
  other: PawPrint
}

function getSpeciesIcon(species, props = {}) {
  const Icon = SPECIES_ICONS[species?.toLowerCase()] || PawPrint
  return <Icon {...props} />
}

function getMoodIcon(mood, props = {}) {
  if (!mood) return <Cat {...props} />
  if (mood.includes('活躍') || mood.includes('興奮')) return <Zap {...props} />
  if (mood.includes('好奇') || mood.includes('探索')) return <Eye {...props} />
  if (mood.includes('休息') || mood.includes('放鬆')) return <Moon {...props} />
  if (mood.includes('平靜')) return <Smile {...props} />
  if (mood.includes('觀察') || mood.includes('警戒')) return <Compass {...props} />
  return <PawPrint {...props} />
}

export default function DashboardPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [hoveredPetId, setHoveredPetId] = useState(null)

  // 寵物清單
  const { data: pets = [], isLoading: petsLoading } = useQuery({
    queryKey: ['pets'],
    queryFn: () => api.get('/pets').then(r => r.data.data)
  })

  // 支出統計
  const { data: expSummary = [] } = useQuery({
    queryKey: ['expenses-summary'],
    queryFn: () => api.get('/expenses/summary').then(r => r.data.data)
  })

  // 攝影機目前對應的寵物：優先抓貓
  const cameraPet = pets.find(p => p.species === 'cat') || pets[0]

  // 最近 10 分鐘狀態摘要
  const {
    data: moodSummary,
    isLoading: moodLoading
  } = useQuery({
    queryKey: ['mood-summary', cameraPet?.id],
    queryFn: () =>
      api
        .get(`/mood-records/pet/${cameraPet.id}/summary?minutes=10`)
        .then(r => r.data),
    enabled: !!cameraPet?.id,
    refetchInterval: 60000
  })

  // 通知事項
  const { data: notifications = [] } = useQuery({
    queryKey: ['dashboard-notifications', cameraPet?.id],
    queryFn: () =>
      api
        .get(`/notifications?petId=${cameraPet.id}`)
        .then(r => r.data.notifications || []),
    enabled: !!cameraPet?.id,
    refetchInterval: 30000
  })

  const unreadCount = notifications.filter(
    item => !(item.isRead ?? item.is_read)
  ).length

  const totalExpense = expSummary.reduce(
    (sum, row) => sum + Number(row.total),
    0
  )

  const formatTime = value => {
    if (!value) return '--:--'
    return new Date(value).toLocaleTimeString('zh-TW', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
  }

  const hour = new Date().getHours()
  const greeting =
    hour < 5
      ? '夜深了'
      : hour < 12
        ? '早安'
        : hour < 18
          ? '午安'
          : '晚安'

  return (
    <div
      data-theme="light"
      className="relative min-h-full bg-[#fafafa] text-[#191919] p-4 md:p-8 font-sans selection:bg-[#fffa00] selection:text-[#191919] overflow-x-hidden"
    >
      {/* 輕量科技背景網格 */}
      <div className="absolute inset-0 pointer-events-none opacity-10">
        <Texture variant="grid" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto space-y-6">

        {/* 頂部系統狀態列 */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e5e5e5] pb-3 text-xs text-[#626262] font-mono">
          <div className="flex items-center gap-2.5">
            <RegistrationStrip size="sm" />
            <span className="font-bold text-[#191919] tracking-wider">
              PAWCARE // 智慧照護總覽
            </span>
            <span className="text-[#d9d9d9]">|</span>
            <span className="hidden sm:inline">即時守護中</span>
          </div>

          <div className="flex items-center gap-2">
            <Tag variant="accent" size="sm" numeric>
              連線正常
            </Tag>
            <span className="text-[#8a8a8a]">
              {new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '.')}
            </span>
          </div>
        </div>

        {/* 歡迎標題區 */}
        <div className="relative">
          <SectionTitle
            latin="OVERVIEW // PAWCARE"
            meta="// DAILY SUMMARY"
            level={1}
            tone="accent"
            className="text-2xl md:text-3xl font-extrabold tracking-tight text-[#191919]"
          >
            {greeting}，{user?.name || '主人'}
          </SectionTitle>
          <p className="text-sm text-[#626262] mt-1.5 max-w-2xl leading-relaxed">
            歡迎回到 PawCare，今天你的毛孩子們還好嗎？
          </p>
        </div>

        {/* 貓咪近期狀態與即時監控 */}
        <section className="relative">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 bg-[#fffa00] border border-[#d9d9d9]" />
              <BracketTitle level={3} className="text-sm md:text-base font-bold text-[#191919]">
                即時影像與近期狀態 // LIVE CAM
              </BracketTitle>
              {cameraPet && (
                <span className="text-xs text-[#626262] font-mono hidden sm:inline">
                  [{cameraPet.name} 的視角]
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <RecIndicator label="LIVE" blink />
              <Tag variant="outline" size="sm">
                HD 60FPS
              </Tag>
              <Tag variant="outline" size="sm">
                AI 辨識
              </Tag>
            </div>
          </div>

          <div className="relative bg-white border border-[#d9d9d9] p-5 md:p-6 shadow-sm transition-all duration-200 hover:border-[#191919] group">
            <CornerBrackets size="sm" />

            {!cameraPet ? (
              <div className="py-10 text-center font-mono space-y-3">
                <div className="w-12 h-12 mx-auto bg-white border border-[#d9d9d9] flex items-center justify-center text-[#8a8a8a]">
                  <PawPrint size={24} strokeWidth={1.5} />
                </div>
                <p className="text-[#8a8a8a] text-sm">
                  目前尚未新增寵物資料
                </p>
                <Button
                  variant="action"
                  size="sm"
                  render={<Link to="/pets" />}
                >
                  前往新增寵物
                </Button>
              </div>
            ) : moodLoading ? (
              <div className="py-10 text-center font-mono space-y-3">
                <div className="inline-block w-6 h-6 border-2 border-[#191919] border-t-transparent animate-spin rounded-full" />
                <p className="text-xs text-[#626262] tracking-wider">
                  正在讀取近期活動狀態...
                </p>
              </div>
            ) : moodSummary?.success ? (
              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
                  
                  {/* 左側：狀態卡片 */}
                  <div className="md:col-span-5 flex items-start gap-3.5 bg-[#f8f9fa] border border-[#e5e5e5] p-4">
                    <div className="w-12 h-12 bg-white border border-[#d9d9d9] flex items-center justify-center text-[#191919] shrink-0 shadow-xs">
                      {getMoodIcon(moodSummary.mainMood, { size: 24, strokeWidth: 2 })}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-[#8a8a8a] font-mono">// 分析結果</span>
                        <Tag variant="accent" size="sm">推測狀態</Tag>
                      </div>
                      <div className="text-lg font-bold text-[#191919] tracking-wide">
                        {moodSummary.mainMood}
                      </div>
                      <p className="text-xs text-[#626262] mt-1">
                        觀察目標：<span className="font-semibold text-[#191919]">{cameraPet.name}</span>
                      </p>
                    </div>
                  </div>

                  {/* 中間：取樣佔比與進度條 */}
                  <div className="md:col-span-4 bg-[#f8f9fa] border border-[#e5e5e5] p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-[#626262]">// 過去 {moodSummary.minutes} 分鐘狀態佔比</span>
                      <span className="text-[#191919] font-bold">{moodSummary.percentage}%</span>
                    </div>
                    <Progress
                      value={Number(moodSummary.percentage)}
                      segments={10}
                      aria-label="狀態佔比"
                    />
                    <p className="text-[11px] text-[#8a8a8a] leading-tight">
                      ※ 依攝影機偵測到的姿態與活動量推測
                    </p>
                  </div>

                  {/* 右側：調度與時間戳 */}
                  <div className="md:col-span-3 flex flex-col justify-between h-full space-y-3 bg-[#f8f9fa] border border-[#e5e5e5] p-4 text-xs font-mono">
                    <div className="flex items-center justify-between">
                      <span className="text-[#8a8a8a]">最後更新</span>
                      <span className="text-[#191919] font-bold">
                        {formatTime(moodSummary.updatedAt)}
                      </span>
                    </div>
                    <Button
                      variant="action"
                      size="sm"
                      block
                      iconEnd={<ArrowRight size={14} />}
                      render={<Link to="/pet-cam" />}
                    >
                      查看即時影像
                    </Button>
                  </div>

                </div>

                {/* 底部輔助狀態 */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[#f0f0f0] text-xs font-mono text-[#626262]">
                  <div className="flex items-center gap-2">
                    <TagPair name="偵測取樣" value={`${moodSummary.minutes} 分鐘`} size="sm" />
                    <TagPair name="鏡頭狀態" value="正常連線" size="sm" />
                  </div>
                  <Link
                    to="/health-consult?view=emotion"
                    className="text-[#191919] font-semibold hover:underline flex items-center gap-1 transition-colors"
                  >
                    查看歷史情緒紀錄 →
                  </Link>
                </div>
              </div>
            ) : (
              <div className="py-6 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white border border-[#d9d9d9] flex items-center justify-center text-[#626262] shrink-0">
                    <Cat size={20} strokeWidth={2} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#191919]">
                      {cameraPet.name} · 近期無辨識紀錄
                    </p>
                    <p className="text-xs text-[#8a8a8a] mt-0.5">
                      最近 10 分鐘內尚未累積足夠的影像活動數據
                    </p>
                  </div>
                </div>
                <Button
                  variant="control"
                  size="sm"
                  iconEnd={<ArrowRight size={14} />}
                  render={<Link to="/pet-cam" />}
                >
                  開啟即時監控
                </Button>
              </div>
            )}
          </div>
        </section>

        {/* 核心數據指標 (Endfield Stat & RollingNumber) */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-[#8a8a8a] uppercase tracking-wider">
              // OVERVIEW STATS // 關鍵照顧數據
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* 卡片 1: 寵物總數 */}
            <div
              onClick={() => navigate('/pets')}
              className="relative group cursor-pointer bg-white border border-[#e5e5e5] p-4 transition-all duration-200 hover:border-[#191919] shadow-sm hover:shadow"
            >
              <CornerBrackets size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-center justify-between mb-3 text-xs font-mono text-[#8a8a8a]">
                <span>// PETS</span>
                <div className="w-6 h-6 flex items-center justify-center text-[#191919]">
                  <PawPrint size={16} strokeWidth={2} />
                </div>
              </div>
              <Stat
                label="寵物總數"
                value={<RollingNumber value={pets.length} />}
                unit="隻"
                delta={pets.length > 0 ? "已登錄" : "未登錄"}
                size="md"
              />
              <div className="mt-3 pt-2 border-t border-[#f0f0f0] flex items-center justify-between text-xs font-mono text-[#8a8a8a] group-hover:text-[#191919]">
                <span>查看寵物資料</span>
                <span>→</span>
              </div>
            </div>

            {/* 卡片 2: 本月支出 */}
            <div
              onClick={() => navigate('/expenses')}
              className="relative group cursor-pointer bg-white border border-[#e5e5e5] p-4 transition-all duration-200 hover:border-[#191919] shadow-sm hover:shadow"
            >
              <CornerBrackets size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-center justify-between mb-3 text-xs font-mono text-[#8a8a8a]">
                <span>// EXPENSES</span>
                <div className="w-6 h-6 flex items-center justify-center text-[#191919]">
                  <CreditCard size={16} strokeWidth={2} />
                </div>
              </div>
              <Stat
                label="本月總支出"
                value={<RollingNumber value={Math.round(totalExpense)} />}
                unit="TWD"
                delta="開銷統計"
                size="md"
              />
              <div className="mt-3 pt-2 border-t border-[#f0f0f0] flex items-center justify-between text-xs font-mono text-[#8a8a8a] group-hover:text-[#191919]">
                <span>查看支出明細</span>
                <span>→</span>
              </div>
            </div>

            {/* 卡片 3: 健康週報 */}
            <div
              onClick={() => navigate('/weekly-report')}
              className="relative group cursor-pointer bg-white border border-[#e5e5e5] p-4 transition-all duration-200 hover:border-[#191919] shadow-sm hover:shadow"
            >
              <CornerBrackets size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-center justify-between mb-3 text-xs font-mono text-[#8a8a8a]">
                <span>// REPORT</span>
                <div className="w-6 h-6 flex items-center justify-center text-[#191919]">
                  <ClipboardCheck size={16} strokeWidth={2} />
                </div>
              </div>
              <Stat
                label="健康週報"
                value="已就緒"
                unit=""
                delta="本週"
                size="md"
              />
              <div className="mt-3 pt-2 border-t border-[#f0f0f0] flex items-center justify-between text-xs font-mono text-[#8a8a8a] group-hover:text-[#191919]">
                <span>閱讀健康分析</span>
                <span>→</span>
              </div>
            </div>

            {/* 卡片 4: 提醒事項 */}
            <div className="relative group bg-white border border-[#e5e5e5] p-4 transition-all duration-200 hover:border-[#191919] shadow-sm hover:shadow">
              <CornerBrackets size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-center justify-between mb-3 text-xs font-mono text-[#8a8a8a]">
                <span>// ALERTS</span>
                <div className="w-6 h-6 flex items-center justify-center">
                  <Bell size={16} strokeWidth={2} className={unreadCount > 0 ? "text-[#de0909]" : "text-[#8a8a8a]"} />
                </div>
              </div>
              <Stat
                label="待處理提醒"
                value={<RollingNumber value={unreadCount} />}
                unit="項"
                delta={unreadCount > 0 ? "需處理" : "無待辦"}
                trend={unreadCount > 0 ? "down" : undefined}
                size="md"
              />
              <div className="mt-3 pt-2 border-t border-[#f0f0f0] flex items-center justify-between text-xs font-mono text-[#8a8a8a]">
                <span>{unreadCount > 0 ? '有新的通知' : '目前一切安好'}</span>
                {unreadCount > 0 && <span className="text-[#de0909]">●</span>}
              </div>
            </div>

          </div>
        </section>

        {/* 我的寵物名冊 (My Pets) */}
        <section className="bg-white border border-[#d9d9d9] p-5 md:p-6 shadow-sm relative overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5 border-b border-[#f0f0f0] pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-[#fffa00] border border-[#d9d9d9]" />
                <BracketTitle level={3} className="text-base md:text-lg font-bold text-[#191919]">
                  我的寵物 // MY PETS
                </BracketTitle>
              </div>
              <p className="text-xs text-[#8a8a8a] font-mono mt-0.5">
                // 家中已登記的毛小孩成員
              </p>
            </div>

            <Button
              variant="light"
              size="sm"
              iconEnd={<ArrowRight size={14} />}
              render={<Link to="/pets" />}
            >
              查看全部寵物
            </Button>
          </div>

          {petsLoading ? (
            <div className="py-10 text-center text-xs text-[#8a8a8a] font-mono">
              載入寵物資料中...
            </div>
          ) : pets.length === 0 ? (
            <div className="py-10 text-center border border-dashed border-[#e5e5e5] p-6 space-y-3">
              <div className="w-12 h-12 mx-auto bg-white border border-[#d9d9d9] flex items-center justify-center text-[#8a8a8a]">
                <PawPrint size={24} strokeWidth={1.5} />
              </div>
              <p className="text-xs text-[#8a8a8a] font-mono">
                還沒有新增任何寵物
              </p>
              <Button
                variant="action"
                size="sm"
                render={<Link to="/pets" />}
              >
                新增第一隻寵物
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {pets.map((pet, idx) => {
                const isHovered = hoveredPetId === pet.id
                return (
                  <Link
                    key={pet.id}
                    to={`/pets/${pet.id}`}
                    onMouseEnter={() => setHoveredPetId(pet.id)}
                    onMouseLeave={() => setHoveredPetId(null)}
                    className="relative block bg-[#f8f9fa] border border-[#e5e5e5] p-4 transition-all duration-200 hover:border-[#191919] hover:bg-white group shadow-sm hover:shadow"
                  >
                    <CornerBrackets visible={isHovered} size="sm" />

                    <div className="flex items-center justify-between text-[11px] font-mono text-[#8a8a8a] mb-2.5">
                      <TagPair name="ID" value={`0${idx + 1}`} size="sm" emphasis={isHovered} />
                      <Tag variant="outline" size="sm">
                        {(pet.species || 'PET').toUpperCase()}
                      </Tag>
                    </div>

                    <div className="flex items-center gap-3 my-2">
                      <div className="w-12 h-12 bg-white border border-[#d9d9d9] flex items-center justify-center text-[#191919] group-hover:bg-[#fffa00] group-hover:border-[#191919] transition-colors shrink-0">
                        {getSpeciesIcon(pet.species, { size: 22, strokeWidth: 2 })}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-sm text-[#191919] truncate group-hover:text-black transition-colors">
                          {pet.name}
                        </div>
                        <div className="text-xs text-[#8a8a8a] truncate">
                          {pet.breed || pet.species || '未知品種'}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-[#e5e5e5] flex items-center justify-between text-[11px] font-mono text-[#8a8a8a] group-hover:text-[#191919]">
                      <span>基本資料正常</span>
                      <span>查看資料 →</span>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </section>

        {/* 常用功能調度 (Quick Actions) */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-[#8a8a8a] uppercase tracking-wider">
              // QUICK ACTIONS // 常用功能
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* 模組 1: 財務管理 */}
            <div className="bg-white border border-[#d9d9d9] p-5 shadow-sm hover:border-[#191919] transition-all group">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 flex items-center justify-center text-[#191919]">
                      <Wallet size={18} strokeWidth={2} />
                    </div>
                    <h3 className="font-bold text-sm text-[#191919]">
                      財務管理 // EXPENSES
                    </h3>
                  </div>
                  <p className="text-xs text-[#626262] leading-relaxed">
                    記錄毛孩的飲食飼糧、日常用品與醫療健康開銷。
                  </p>
                </div>
                <Button
                  variant="control"
                  size="sm"
                  iconEnd={<ArrowRight size={14} />}
                  render={<Link to="/expenses" />}
                >
                  進入管理
                </Button>
              </div>
            </div>

            {/* 模組 2: 支出報表 */}
            <div className="bg-white border border-[#d9d9d9] p-5 shadow-sm hover:border-[#191919] transition-all group">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 flex items-center justify-center text-[#191919]">
                      <BarChart3 size={18} strokeWidth={2} />
                    </div>
                    <h3 className="font-bold text-sm text-[#191919]">
                      支出報表 // REPORTS
                    </h3>
                  </div>
                  <p className="text-xs text-[#626262] leading-relaxed">
                    以統計圖表分析毛孩每月花費走勢與各類別佔比。
                  </p>
                </div>
                <Button
                  variant="control"
                  size="sm"
                  iconEnd={<ArrowRight size={14} />}
                  render={<Link to="/expense-report" />}
                >
                  查看報表
                </Button>
              </div>
            </div>

          </div>
        </section>

        {/* 頁尾 */}
        <div className="border-t border-[#e5e5e5] pt-4 flex flex-wrap items-center justify-between text-[11px] font-mono text-[#8a8a8a]">
          <span>// PAWCARE SMART PET CARE SYSTEM</span>
          <span>ENDFIELD DESIGN SPEC</span>
        </div>

      </div>
    </div>
  )
}