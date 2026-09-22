import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { api } from '../lib/api'

const EMOJI = {
  dog: '🐶',
  cat: '🐱',
  bird: '🐦',
  rabbit: '🐰',
  fish: '🐟',
  other: '🐾'
}

function StatCard({
  label,
  value,
  unit,
  sub,
  subColor = 'text-green-600',
  icon,
  iconBg
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          {label}
        </span>
        <div className={`w-8 h-8 ${iconBg} rounded-lg flex items-center justify-center text-base`}>
          {icon}
        </div>
      </div>

      <div className="text-2xl font-bold text-gray-800 mb-1">
        {value}
        {unit && (
          <span className="text-sm font-normal text-gray-400">
            {' '}{unit}
          </span>
        )}
      </div>

      <div className={`text-xs font-medium ${subColor} flex items-center gap-1`}>
        {sub}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { user } = useAuthStore()

  // 寵物
  const { data: pets = [], isLoading } = useQuery({
    queryKey: ['pets'],
    queryFn: () => api.get('/pets').then(r => r.data.data)
  })

  // 支出
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

  // 通知
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

  const moodEmoji = mood => {
    if (!mood) return '🐱'
    if (mood.includes('活躍') || mood.includes('興奮')) return '⚡'
    if (mood.includes('好奇') || mood.includes('探索')) return '👀'
    if (mood.includes('休息') || mood.includes('放鬆')) return '💤'
    if (mood.includes('平靜')) return '😌'
    if (mood.includes('觀察') || mood.includes('警戒')) return '🐱'
    return '🐾'
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
    <div className="p-6 max-w-5xl">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-800">
          {greeting}，{user?.name} 👋
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">
          歡迎回到 PawCare，今天你的毛孩子們還好嗎？
        </p>
      </div>

      {/* 貓咪近期狀態：點擊前往即時監控 */}
      {!cameraPet ? (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6">
          <p className="text-sm text-gray-500">🐾 尚未新增寵物</p>
        </div>
      ) : (
        <Link to="/pet-cam" className="block mb-6">
          {moodLoading ? (
            <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm hover:border-green-200 transition-all cursor-pointer">
              <p className="text-sm text-gray-400">🐱 正在讀取近期狀態...</p>
              <p className="text-xs text-green-600 font-medium mt-2">查看即時監控 →</p>
            </div>
          ) : moodSummary?.success ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-5 hover:shadow-sm hover:border-green-300 transition-all cursor-pointer">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{moodEmoji(moodSummary.mainMood)}</span>
                    <h2 className="text-sm font-bold text-gray-800">
                      {cameraPet?.name || '貓咪'}近期狀態
                    </h2>
                  </div>

                  <p className="text-sm text-gray-600 mt-3">
                    過去 <span className="font-semibold">{moodSummary.minutes}</span> 分鐘主要推測狀態：
                    <span className="font-bold text-green-600 ml-1">{moodSummary.mainMood}</span>
                  </p>

                  <p className="text-xs text-gray-500 mt-1">
                    約佔 {moodSummary.percentage}% 的辨識紀錄
                  </p>

                  <p className="text-[10px] text-gray-400 mt-2">
                    ※ 依攝影機偵測到的姿態與活動量推測
                  </p>

                  <p className="text-xs text-green-600 font-medium mt-3">
                    查看即時監控 →
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-xs text-gray-400">最後更新</p>
                  <p className="text-xs font-medium text-gray-500 mt-1">
                    {formatTime(moodSummary.updatedAt)}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 hover:shadow-sm hover:border-green-200 transition-all cursor-pointer">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span>🐱</span>
                  <div>
                    <p className="text-sm font-semibold text-gray-600">
                      {cameraPet?.name || '貓咪'}近期狀態
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      最近 10 分鐘沒有攝影機辨識紀錄
                    </p>
                    <p className="text-xs text-green-600 font-medium mt-2">
                      查看即時監控 →
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Link>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-3 mb-6">

        <StatCard
          label="寵物總數"
          value={pets.length}
          unit="隻"
          sub={pets.length > 0 ? '✓ 查看寵物資料' : '尚未新增寵物'}
          icon="🐾"
          iconBg="bg-green-50"
        />

        <Link to="/expenses" className="block">
          <StatCard
            label="本月支出"
            value={`TWD ${totalExpense.toFixed(0)}`}
            unit=""
            sub="💰 點擊查看明細"
            icon="💳"
            iconBg="bg-blue-50"
            subColor="text-blue-500"
          />
        </Link>

        <Link to="/weekly-report" className="block">
          <StatCard
            label="健康週報"
            value="查看"
            unit=""
            sub="📊 查看健康分析"
            icon="📋"
            iconBg="bg-amber-50"
            subColor="text-amber-500"
          />
        </Link>

        <StatCard
          label="提醒事項"
          value={unreadCount}
          unit="項"
          sub={
            unreadCount > 0
              ? '🔔 有新的提醒'
              : '目前沒有新提醒'
          }
          icon="🔔"
          iconBg={
            unreadCount > 0
              ? 'bg-purple-50'
              : 'bg-gray-50'
          }
          subColor={
            unreadCount > 0
              ? 'text-purple-500'
              : 'text-gray-400'
          }
        />

      </div>

      {/* 我的寵物 */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-base">🐶</span>
            <h2 className="text-sm font-semibold text-gray-800">
              我的寵物
            </h2>
          </div>

          <Link
            to="/pets"
            className="text-xs text-green-500 font-semibold hover:underline"
          >
            查看全部 →
          </Link>
        </div>

        {isLoading ? (
          <p className="text-sm text-gray-300 py-4">
            載入中...
          </p>
        ) : pets.length === 0 ? (
          <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-xl">
            <p className="text-3xl mb-2">🐾</p>
            <p className="text-sm text-gray-400 mb-3">
              還沒有寵物
            </p>

            <Link
              to="/pets"
              className="inline-block bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-xs font-semibold transition-colors"
            >
              新增第一隻寵物
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-3">
            {pets.map(pet => (
              <Link
                key={pet.id}
                to={`/pets/${pet.id}`}
                className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100 hover:border-green-200 hover:bg-green-50 transition-all group"
              >
                <span className="text-2xl group-hover:scale-110 transition-transform">
                  {EMOJI[pet.species] || '🐾'}
                </span>

                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">
                    {pet.name}
                  </p>
                  <p className="text-xs text-gray-400 truncate">
                    {pet.breed || pet.species}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}

      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 gap-3">

        <Link
          to="/expenses"
          className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3 hover:border-green-200 hover:shadow-sm transition-all group"
        >
          <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center text-xl group-hover:bg-green-100 transition-colors">
            💰
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-800">
              財務管理
            </p>
            <p className="text-xs text-gray-400">
              記錄寵物花費
            </p>
          </div>
        </Link>

        <Link
          to="/expense-report"
          className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3 hover:border-green-200 hover:shadow-sm transition-all group"
        >
          <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-xl group-hover:bg-blue-100 transition-colors">
            📊
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-800">
              支出報表
            </p>
            <p className="text-xs text-gray-400">
              查看統計圖表
            </p>
          </div>
        </Link>

      </div>

    </div>
  )
}