import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
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

const MEAL_ICONS = {
  breakfast: Sunrise,
  lunch: Sun,
  dinner: Moon,
  late: Stars
}

const SPECIES_TEXT = { cat: '貓咪', dog: '狗狗' }
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
    <div className="ef-panel cut-br p-5 mb-6 border border-[var(--ef-rule)] bg-[var(--ef-panel)] relative">
      {/* 標題與模式切換 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--ef-rule)] pb-3.5 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-3.5 bg-[var(--ef-signal)] border border-[var(--ef-ink)]" />
          <span className="font-bold text-sm text-[var(--ef-ink)]">今日飲食指引</span>
          <span className="text-[10px] font-mono text-[var(--ef-ink-2)]">// DIET_PLANNER</span>
        </div>

        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setMode('plan')}
            className={`px-3 py-1 text-xs font-mono transition-colors flex items-center gap-1.5 ${
              mode === 'plan'
                ? 'bg-[var(--ef-signal)] text-[var(--ef-on-signal)] font-bold'
                : 'bg-[var(--ef-paper)] border border-[var(--ef-rule)] text-[var(--ef-ink-2)] hover:border-[var(--ef-ink)] hover:text-[var(--ef-ink)]'
            }`}
            style={{
              clipPath: mode === 'plan' ? 'polygon(0 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%)' : 'none'
            }}
          >
            <Calendar size={13} />
            <span>智能飲食計畫</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('manual')}
            className={`px-3 py-1 text-xs font-mono transition-colors flex items-center gap-1.5 ${
              mode === 'manual'
                ? 'bg-[var(--ef-signal)] text-[var(--ef-on-signal)] font-bold'
                : 'bg-[var(--ef-paper)] border border-[var(--ef-rule)] text-[var(--ef-ink-2)] hover:border-[var(--ef-ink)] hover:text-[var(--ef-ink)]'
            }`}
            style={{
              clipPath: mode === 'manual' ? 'polygon(0 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%)' : 'none'
            }}
          >
            <Search size={13} />
            <span>自選食物清單</span>
          </button>
        </div>
      </div>

      {/* 自選模式 */}
      {mode === 'manual' && (
        <div className="text-center py-8">
          <div className="w-10 h-10 mx-auto mb-2 bg-[var(--ef-paper)] border border-[var(--ef-rule)] flex items-center justify-center text-[var(--ef-ink-2)]">
            <Utensils size={20} />
          </div>
          <p className="text-xs font-bold text-[var(--ef-ink)]">
            自選食物資料庫餵食
          </p>
          <p className="text-[11px] font-mono text-[var(--ef-ink-2)] mt-1 max-w-sm mx-auto">
            挑選食物後，系統將自動比對健康歷史、近期飲食與安全禁忌，再進行確認
          </p>
          <button
            type="button"
            onClick={onOpenManual}
            className="ef-btn small go mt-4 px-4"
          >
            開啟食物資料庫
          </button>
        </div>
      )}

      {/* 依照計畫模式 */}
      {mode === 'plan' && (
        <div>
          {isLoading && (
            <div className="ef-progress is-unknown py-4" role="progressbar" aria-label="載入飲食計畫">
              <span className="ef-eyebrow">Generating / 飲食計畫計算中</span><i></i>
            </div>
          )}

          {isError && (
            <div className="text-center py-6">
              <p className="text-xs font-mono text-[var(--ef-danger)]">
                ※ 暫時無法產生飲食計畫。
              </p>
              <div className="flex justify-center gap-3 mt-3">
                <button
                  type="button"
                  onClick={() => refetch()}
                  className="ef-btn small"
                >
                  重新嘗試
                </button>
                <button
                  type="button"
                  onClick={() => setMode('manual')}
                  className="ef-btn small"
                >
                  改為自選食物
                </button>
              </div>
            </div>
          )}

          {plan && (
            <div className="space-y-4">
              {/* 寵物特徵摘要列 */}
              <div className="flex flex-wrap items-center justify-between gap-2 bg-[var(--ef-paper)] border border-[var(--ef-rule)] px-3 py-2">
                <span className="text-[11px] font-mono text-[var(--ef-ink)]">
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
                  className="text-xs font-mono text-[var(--ef-ink)] hover:underline flex items-center gap-1 font-bold"
                >
                  <Settings size={12} />
                  <span>飲食偏好設定</span>
                </button>
              </div>

              {/* 今日熱量進度 (Endfield 工業進度條) */}
              {plan.target.kcal && (
                <div className="bg-[var(--ef-paper)] border border-[var(--ef-rule)] p-3">
                  <div className="flex items-center justify-between text-xs font-mono mb-1.5">
                    <span className="text-[var(--ef-ink-2)]">
                      目標每日熱量: <strong className="text-[var(--ef-ink)]">{plan.target.kcal}</strong> kcal
                    </span>
                    <span className="text-[var(--ef-ink)] font-bold">
                      今日已攝取: {plan.today.loggedKcal} kcal
                    </span>
                  </div>

                  <div className="h-2 bg-[var(--ef-chip)] border border-[var(--ef-rule)] overflow-hidden">
                    <div
                      className="h-full bg-[var(--ef-signal)] transition-all duration-300"
                      style={{
                        width: `${Math.min(progress * 100, 100)}%`
                      }}
                    />
                  </div>
                </div>
              )}

              {/* 提醒事項 (Endfield .ef-notice) */}
              {plan.notices.length > 0 && (
                <div className="space-y-1.5">
                  {plan.notices.map((notice, index) => (
                    <p
                      key={index}
                      className="ef-notice text-xs"
                      data-flag={notice.level === 'warning' ? '注意' : '提醒'}
                    >
                      {notice.text}
                    </p>
                  ))}
                </div>
              )}

              {/* 今日餐次指引清單 */}
              <div className="space-y-3">
                {plan.meals.map(meal => {
                  const index = choice[meal.key] ?? 0
                  const option = meal.options[index]
                  const Icon = MEAL_ICONS[meal.key] || Utensils

                  return (
                    <div
                      key={meal.key}
                      className={`p-3.5 border transition-colors ${
                        meal.logged
                          ? 'border-[var(--ef-rule)] bg-[var(--ef-paper)]'
                          : 'border-[var(--ef-rule)] bg-[var(--ef-panel)] hover:border-[var(--ef-ink)]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 flex items-center justify-center shrink-0 bg-[var(--ef-ink)] text-[var(--ef-panel)]"
                            style={{ clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0 100%)' }}
                          >
                            <Icon size={14} className="text-[var(--ef-signal)]" />
                          </div>
                          <span className="font-bold text-xs text-[var(--ef-ink)]">{meal.label}</span>
                          <span className="text-[10px] font-mono text-[var(--ef-ink-2)]">
                            預定時間: {meal.time}
                          </span>
                        </div>

                        {meal.logged && (
                          <span className="ef-tag text-[9px] font-mono font-bold flex items-center gap-1">
                            <Check size={11} />
                            RECORDED ({meal.loggedKcal} kcal)
                          </span>
                        )}
                      </div>

                      {!option ? (
                        <p className="text-xs font-mono text-[var(--ef-ink-2)]">
                          // 目前食物庫暫無合適推薦品項
                        </p>
                      ) : (
                        <div>
                          <div className="flex items-baseline justify-between">
                            <span className="font-bold text-sm text-[var(--ef-ink)]">
                              {option.name}
                            </span>
                            <span className="font-mono text-xs text-[var(--ef-ink)]">
                              {option.amountG ? `${option.amountG} g · 約 ${option.kcal} kcal` : '依外包裝標示'}
                            </span>
                          </div>

                          {option.reasons.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {option.reasons.map(reason => (
                                <span
                                  key={reason}
                                  className="text-[10px] font-mono bg-[var(--ef-paper)] text-[var(--ef-ink-2)] border border-[var(--ef-rule)] px-1.5 py-0.2"
                                >
                                  {reason}
                                </span>
                              ))}
                            </div>
                          )}

                          {option.warnings.length > 0 && (
                            <div className="mt-1.5 space-y-0.5">
                              {option.warnings.map(w => (
                                <p key={w.title} className="text-xs text-[var(--ef-danger)] flex items-center gap-1 font-mono">
                                  <AlertTriangle size={12} />
                                  <span>{w.title}</span>
                                </p>
                              ))}
                            </div>
                          )}

                          <div className="flex gap-2 mt-3 pt-2.5 border-t border-[var(--ef-rule)]">
                            <button
                              type="button"
                              onClick={() => onUseMeal(meal, option)}
                              className="ef-btn small go flex-1 py-1.5 text-xs text-center"
                            >
                              依建議餵食確認
                            </button>

                            {meal.options.length > 1 && (
                              <button
                                type="button"
                                onClick={() => cycle(meal)}
                                className="ef-btn small px-3 py-1.5 text-xs font-mono"
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
                    className="text-xs font-mono text-[var(--ef-ink-2)] hover:text-[var(--ef-ink)] flex items-center gap-1"
                  >
                    {showExcluded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <span>已依過敏與偏好排除 {plan.excluded.length} 項食物</span>
                  </button>

                  {showExcluded && (
                    <ul className="mt-2 space-y-1 pl-4 text-xs font-mono text-[var(--ef-ink-2)]">
                      {plan.excluded.map(item => (
                        <li key={item.name}>
                          // {item.name}: {item.reason}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <p className="text-[10px] font-mono text-[var(--ef-ink-2)] leading-relaxed">
                // NOTICE: 飲食指引係依寵物生理數據與偏好產出之餵食規劃，點選餵食前仍將執行多重過敏與營養驗算。
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}