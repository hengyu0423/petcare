import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  CornerBrackets,
  Button,
  Tag
} from '@endfield-ui/react'
import {
  Sunrise,
  Sun,
  Moon,
  Stars,
  Utensils,
  Calendar,
  Search,
  Settings,
  AlertTriangle,
  Lightbulb,
  Check,
  ChevronDown,
  ChevronRight,
  RefreshCw
} from 'lucide-react'
import { api } from '../../lib/api'

const MEAL_THEMES = {
  breakfast: {
    icon: Sunrise,
    borderL: 'border-l-4 border-l-amber-400',
    iconCls: 'text-amber-700 bg-amber-50 border border-amber-300'
  },
  lunch: {
    icon: Sun,
    borderL: 'border-l-4 border-l-orange-400',
    iconCls: 'text-orange-700 bg-orange-50 border border-orange-300'
  },
  dinner: {
    icon: Moon,
    borderL: 'border-l-4 border-l-indigo-400',
    iconCls: 'text-indigo-700 bg-indigo-50 border border-indigo-300'
  },
  late: {
    icon: Stars,
    borderL: 'border-l-4 border-l-purple-400',
    iconCls: 'text-purple-700 bg-purple-50 border border-purple-300'
  }
}

const MEAL_ICONS = Object.fromEntries(
  Object.entries(MEAL_THEMES).map(([k, v]) => [k, v.icon])
)

const SPECIES_TEXT = { cat: '貓', dog: '狗' }
const STAGE_TEXT = { young: '幼年', adult: '成年', senior: '高齡' }

export default function MealPlanSection({
  pet,
  onUseMeal,
  onOpenManual,
  onEditPreferences
}) {
  const [mode, setMode] = useState('plan')
  const [choice, setChoice] = useState({})
  const [showExcluded, setShowExcluded] = useState(false)

  const { data: plan, isLoading, isError, refetch } = useQuery({
    queryKey: ['meal-plan', pet.id],
    queryFn: () =>
      api.get(`/food/meal-plan/${pet.id}`).then(r => r.data.data),
    enabled: !!pet?.id,
    staleTime: 30_000
  })

  const cycle = meal => {
    setChoice(prev => ({
      ...prev,
      [meal.key]: ((prev[meal.key] ?? 0) + 1) % meal.options.length
    }))
  }

  const progress =
    plan?.today?.targetKcal
      ? plan.today.loggedKcal / plan.today.targetKcal
      : null

  return (
    <div className="relative bg-white border border-[#d9d9d9] p-5 mb-6 shadow-xs" data-theme="light">
      <CornerBrackets size="sm" />

      {/* 標題與模式切換 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#e5e5e5] pb-3.5 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-4 bg-[#fffa00]" />
          <span className="font-bold text-sm text-[#191919]">今日飲食指引</span>
          <span className="text-[10px] font-mono text-[#8a8a8a]">// DIET_PLANNER</span>
        </div>

        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setMode('plan')}
            className={`px-3 py-1 text-xs font-mono transition-colors flex items-center gap-1.5 ${
              mode === 'plan'
                ? 'bg-[#191919] text-[#fffa00] font-bold'
                : 'bg-[#fafafa] border border-[#d9d9d9] text-[#555] hover:border-[#191919]'
            }`}
          >
            <Calendar size={13} />
            <span>智能飲食計畫</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('manual')}
            className={`px-3 py-1 text-xs font-mono transition-colors flex items-center gap-1.5 ${
              mode === 'manual'
                ? 'bg-[#191919] text-[#fffa00] font-bold'
                : 'bg-[#fafafa] border border-[#d9d9d9] text-[#555] hover:border-[#191919]'
            }`}
          >
            <Search size={13} />
            <span>自選食物清單</span>
          </button>
        </div>
      </div>

      {/* 自選模式 */}
      {mode === 'manual' && (
        <div className="text-center py-8">
          <Utensils size={32} className="text-[#8a8a8a] mx-auto mb-2" />
          <p className="text-xs font-bold text-[#191919]">
            自選食物資料庫餵食
          </p>
          <p className="text-[11px] font-mono text-[#8a8a8a] mt-1 max-w-sm mx-auto">
            挑選食物後，系統將自動比對健康歷史、近期飲食與安全禁忌，再進行確認
          </p>
          <Button
            type="button"
            variant="action"
            onClick={onOpenManual}
            className="mt-4 text-xs py-2 px-4"
          >
            開啟食物資料庫
          </Button>
        </div>
      )}

      {/* 依照計畫模式 */}
      {mode === 'plan' && (
        <div>
          {isLoading && (
            <div className="space-y-3 py-4">
              {[0, 1, 2].map(i => (
                <div key={i} className="h-16 bg-[#fafafa] border border-[#e5e5e5] animate-pulse" />
              ))}
            </div>
          )}

          {isError && (
            <div className="text-center py-6">
              <p className="text-xs font-mono text-[#ef4444]">
                暫時無法產生飲食計畫。
              </p>
              <div className="flex justify-center gap-3 mt-3">
                <button
                  type="button"
                  onClick={() => refetch()}
                  className="text-xs font-mono text-[#191919] underline"
                >
                  重新嘗試
                </button>
                <button
                  type="button"
                  onClick={() => setMode('manual')}
                  className="text-xs font-mono text-[#8a8a8a] underline"
                >
                  改為自選食物
                </button>
              </div>
            </div>
          )}

          {plan && (
            <div className="space-y-4">
              {/* 寵物特徵摘要列 */}
              <div className="flex flex-wrap items-center justify-between gap-2 bg-[#fafafa] border border-[#e5e5e5] px-3 py-2">
                <span className="text-[11px] font-mono text-[#555]">
                  {[
                    plan.pet.name,
                    SPECIES_TEXT[plan.pet.species],
                    plan.pet.breed,
                    plan.pet.ageText ? `${plan.pet.ageText} (${STAGE_TEXT[plan.pet.stage]})` : null,
                    plan.pet.weightKg ? `${plan.pet.weightKg} kg` : null
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>

                <button
                  type="button"
                  onClick={onEditPreferences}
                  className="text-xs font-mono text-[#191919] hover:underline flex items-center gap-1 font-bold"
                >
                  <Settings size={12} />
                  <span>飲食偏好設定</span>
                </button>
              </div>

              {/* 今日熱量進度 */}
              {plan.target.kcal && (
                <div className="bg-[#fafafa] border border-[#e5e5e5] p-3">
                  <div className="flex items-center justify-between text-xs font-mono mb-1.5">
                    <span className="text-[#8a8a8a]">
                      目標每日熱量: <strong className="text-[#191919]">{plan.target.kcal}</strong> kcal
                    </span>
                    <span className="text-[#191919] font-bold">
                      今日已攝取: {plan.today.loggedKcal} kcal
                    </span>
                  </div>

                  <div className="h-2.5 bg-[#e5e5e5] rounded-full overflow-hidden border border-[#d9d9d9]">
                    <div
                      className={`h-full transition-all duration-300 ${
                        progress > 1
                          ? 'bg-gradient-to-r from-amber-500 to-rose-500'
                          : progress >= 0.7
                          ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-[#fffa00]'
                          : 'bg-gradient-to-r from-sky-400 to-emerald-500'
                      }`}
                      style={{
                        width: `${Math.min(progress * 100, 100)}%`
                      }}
                    />
                  </div>
                </div>
              )}

              {/* 提醒事項 */}
              {plan.notices.length > 0 && (
                <div className="space-y-1.5">
                  {plan.notices.map((notice, index) => (
                    <div
                      key={index}
                      className={`text-xs p-2.5 border flex items-start gap-2 ${
                        notice.level === 'warning'
                          ? 'bg-[#fffbeb] border-amber-300 text-amber-900 shadow-2xs font-medium'
                          : 'bg-sky-50/70 border-sky-200 text-sky-900 shadow-2xs'
                      }`}
                    >
                      {notice.level === 'warning' ? (
                        <AlertTriangle size={14} className="shrink-0 mt-0.5 text-amber-600" />
                      ) : (
                        <Lightbulb size={14} className="shrink-0 mt-0.5 text-sky-600" />
                      )}
                      <span className="leading-relaxed">{notice.text}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* 今日餐次指引清單 */}
              <div className="space-y-3">
                {plan.meals.map(meal => {
                  const index = choice[meal.key] ?? 0
                  const option = meal.options[index]
                  const theme = MEAL_THEMES[meal.key] || {
                    icon: Utensils,
                    borderL: 'border-l-4 border-l-[#191919]',
                    iconCls: 'text-[#191919] bg-[#fafafa] border border-[#e5e5e5]'
                  }
                  const Icon = theme.icon

                  return (
                    <div
                      key={meal.key}
                      className={`border ${theme.borderL} p-3.5 transition-colors shadow-2xs ${
                        meal.logged
                          ? 'border-[#191919] bg-[#fafafa]'
                          : 'border-[#d9d9d9] bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 flex items-center justify-center shrink-0 rounded-xs ${theme.iconCls}`}>
                            <Icon size={14} />
                          </div>
                          <span className="font-bold text-xs text-[#191919]">{meal.label}</span>
                          <span className="text-[10px] font-mono text-[#8a8a8a]">
                            預定時間: {meal.time}
                          </span>
                        </div>

                        {meal.logged && (
                          <Tag size="sm" variant="default" className="bg-[#191919] text-[#fffa00] border-[#191919] font-mono text-[9px] font-bold">
                            <Check size={11} className="mr-0.5" />
                            RECORDED ({meal.loggedKcal} kcal)
                          </Tag>
                        )}
                      </div>

                      {!option ? (
                        <p className="text-xs font-mono text-[#8a8a8a]">
                          目前食物庫暫無合適推薦品項
                        </p>
                      ) : (
                        <div>
                          <div className="flex items-baseline justify-between">
                            <span className="font-bold text-sm text-[#191919]">
                              {option.name}
                            </span>
                            <span className="font-mono text-xs text-[#191919]">
                              {option.amountG ? `${option.amountG} g · 約 ${option.kcal} kcal` : '依外包裝標示'}
                            </span>
                          </div>

                          {option.reasons.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {option.reasons.map(reason => (
                                <span
                                  key={reason}
                                  className="text-[10px] font-mono bg-[#f5f5f5] text-[#555] border border-[#e5e5e5] px-1.5 py-0.2"
                                >
                                  {reason}
                                </span>
                              ))}
                            </div>
                          )}

                          {option.warnings.length > 0 && (
                            <div className="mt-1.5 space-y-0.5">
                              {option.warnings.map(w => (
                                <p key={w.title} className="text-xs text-[#dc2626] flex items-center gap-1 font-mono">
                                  <AlertTriangle size={12} />
                                  <span>{w.title}</span>
                                </p>
                              ))}
                            </div>
                          )}

                          <div className="flex gap-2 mt-3 pt-2.5 border-t border-[#f0f0f0]">
                            <Button
                              type="button"
                              variant="action"
                              onClick={() => onUseMeal(meal, option)}
                              className="flex-1 py-1.5 text-xs"
                            >
                              依建議餵食確認
                            </Button>

                            {meal.options.length > 1 && (
                              <button
                                type="button"
                                onClick={() => cycle(meal)}
                                className="px-3 py-1.5 text-xs font-mono border border-[#d9d9d9] bg-white hover:border-[#191919] text-[#555] transition-colors"
                              >
                                切換選項 ({index + 1}/{meal.options.length})
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* 已排除食物展開 */}
              {plan.excluded.length > 0 && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setShowExcluded(v => !v)}
                    className="text-xs font-mono text-[#8a8a8a] hover:text-[#191919] flex items-center gap-1"
                  >
                    {showExcluded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <span>已依過敏與偏好排除 {plan.excluded.length} 項食物</span>
                  </button>

                  {showExcluded && (
                    <ul className="mt-2 space-y-1 pl-4 text-xs font-mono text-[#8a8a8a]">
                      {plan.excluded.map(item => (
                        <li key={item.name}>
                          // {item.name}: {item.reason}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <p className="text-[10px] font-mono text-[#8a8a8a] leading-relaxed">
                // NOTICE: 飲食指引係依寵物生理數據與偏好產出之餵食規劃，點選餵食前仍將執行多重過敏與營養驗算。
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}