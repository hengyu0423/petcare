import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'

// ======================================================
// 今日飲食
//
//   A. 依照飲食計畫：系統依品種、貓／狗、年齡、體重、目前健康狀況、
//      過往健康紀錄、飼主偏好，產生今天的建議餵食。
//   B. 自己選擇：從食物資料庫自己挑。
//
// 不管選 A 或 B，按下餵食後都會進入同一個「餵食前檢查」流程。
// ======================================================

const MEAL_ICON = {
  breakfast: '🌅',
  lunch: '☀️',
  dinner: '🌙',
  late: '🌃'
}

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

  const tabCls = active =>
    `px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
      active
        ? 'bg-green-500 text-white shadow-sm'
        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
    }`

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
    <div className="bg-white border border-green-200 rounded-xl p-4 mb-6">

      {/* 標題與 A / B 切換 */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">

        <h2 className="text-sm font-bold text-gray-800">
          🍽️ 今天要餵什麼？
        </h2>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode('plan')}
            className={tabCls(mode === 'plan')}
          >
            🗓️ 依照飲食計畫
          </button>

          <button
            type="button"
            onClick={() => setMode('manual')}
            className={tabCls(mode === 'manual')}
          >
            🔍 自己選擇
          </button>
        </div>

      </div>

      {/* B. 自己選擇 */}
      {mode === 'manual' && (
        <div className="text-center py-6">

          <p className="text-sm text-gray-700 font-medium">
            自己從食物資料庫挑選食物
          </p>

          <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
            選好之後，系統一樣會依序檢查
            <br />
            健康歷史 → 近期飲食 → 營養與安全，再讓你確認餵食。
          </p>

          <button
            type="button"
            onClick={onOpenManual}
            className="mt-4 bg-green-500 hover:bg-green-600 text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors"
          >
            開啟食物資料庫
          </button>

        </div>
      )}

      {/* A. 依照飲食計畫 */}
      {mode === 'plan' && (
        <div>

          {isLoading && (
            <div className="space-y-3">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="h-20 rounded-xl bg-gray-50 animate-pulse"
                />
              ))}
            </div>
          )}

          {isError && (
            <div className="text-center py-6">
              <p className="text-sm text-gray-500">
                暫時無法產生飲食計畫。
              </p>

              <div className="flex justify-center gap-3 mt-3">
                <button
                  type="button"
                  onClick={() => refetch()}
                  className="text-sm text-green-600 font-semibold hover:underline"
                >
                  重試
                </button>

                <button
                  type="button"
                  onClick={() => setMode('manual')}
                  className="text-sm text-gray-500 hover:underline"
                >
                  改用自己選擇
                </button>
              </div>
            </div>
          )}

          {plan && (
            <div>

              {/* 寵物摘要 */}
              <div className="flex flex-wrap items-center justify-between gap-2">

                <p className="text-xs text-gray-500">
                  {[
                    plan.pet.name,
                    SPECIES_TEXT[plan.pet.species],
                    plan.pet.breed,
                    plan.pet.size,
                    plan.pet.ageText
                      ? `${plan.pet.ageText}（${STAGE_TEXT[plan.pet.stage]}）`
                      : null,
                    plan.pet.weightKg ? `${plan.pet.weightKg} kg` : null
                  ]
                    .filter(Boolean)
                    .join('｜')}
                </p>

                <button
                  type="button"
                  onClick={onEditPreferences}
                  className="text-xs text-green-600 font-semibold hover:underline"
                >
                  ⚙️ 飲食偏好
                </button>

              </div>

              {/* 今日熱量 */}
              {plan.target.kcal && (
                <div className="mt-3">

                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                    <span>
                      建議每日約 {plan.target.kcal} kcal
                    </span>
                    <span>
                      今天已記錄 {plan.today.loggedKcal} kcal
                    </span>
                  </div>

                  <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        progress > 1 ? 'bg-amber-400' : 'bg-green-400'
                      }`}
                      style={{
                        width: `${Math.min(progress * 100, 100)}%`
                      }}
                    />
                  </div>

                </div>
              )}

              {/* 說明與提醒 */}
              {plan.notices.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {plan.notices.map((notice, index) => (
                    <p
                      key={index}
                      className={`text-xs leading-relaxed rounded-lg px-3 py-2 ${
                        notice.level === 'warning'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-gray-50 text-gray-500'
                      }`}
                    >
                      {notice.level === 'warning' ? '⚠️' : '💡'}{' '}
                      {notice.text}
                    </p>
                  ))}
                </div>
              )}

              {/* 今日建議 */}
              <div className="mt-4 space-y-3">

                {plan.meals.map(meal => {
                  const index = choice[meal.key] ?? 0
                  const option = meal.options[index]

                  return (
                    <div
                      key={meal.key}
                      className={`rounded-xl border p-3 ${
                        meal.logged
                          ? 'border-green-200 bg-green-50/40'
                          : 'border-gray-100 bg-white'
                      }`}
                    >

                      <div className="flex items-center justify-between">

                        <p className="text-sm font-bold text-gray-800">
                          {MEAL_ICON[meal.key]} {meal.label}
                          <span className="ml-2 text-xs font-normal text-gray-400">
                            約 {meal.time}
                          </span>
                        </p>

                        {meal.logged && (
                          <span className="text-xs font-semibold text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                            ✓ 已記錄
                            {meal.loggedKcal > 0 &&
                              ` ${meal.loggedKcal} kcal`}
                          </span>
                        )}

                      </div>

                      {!option && (
                        <p className="text-xs text-gray-400 mt-2">
                          目前沒有適合的食物可以推薦。
                        </p>
                      )}

                      {option && (
                        <div className="mt-2">

                          <p className="text-sm font-semibold text-gray-800">
                            {option.name}
                          </p>

                          <p className="text-xs text-gray-500 mt-0.5">
                            {option.amountG
                              ? `${option.amountG} g · 約 ${option.kcal} kcal${
                                  option.capped ? '（已達單餐上限）' : ''
                                }`
                              : '份量請依包裝建議'}
                          </p>

                          {option.reasons.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {option.reasons.map(reason => (
                                <span
                                  key={reason}
                                  className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full"
                                >
                                  {reason}
                                </span>
                              ))}
                            </div>
                          )}

                          {option.warnings.length > 0 && (
                            <div className="mt-2 space-y-0.5">
                              {option.warnings.map(w => (
                                <p
                                  key={w.title}
                                  className="text-xs text-amber-700"
                                >
                                  ⚠️ {w.title}
                                </p>
                              ))}
                            </div>
                          )}

                          <div className="flex gap-2 mt-3">

                            <button
                              type="button"
                              onClick={() => onUseMeal(meal, option)}
                              className="flex-1 bg-green-500 hover:bg-green-600 text-white rounded-lg py-2 text-xs font-semibold transition-colors"
                            >
                              依建議餵食
                            </button>

                            {meal.options.length > 1 && (
                              <button
                                type="button"
                                onClick={() => cycle(meal)}
                                className="px-3 py-2 rounded-lg text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
                              >
                                換一個 ({index + 1}/{meal.options.length})
                              </button>
                            )}

                          </div>

                        </div>
                      )}

                    </div>
                  )
                })}

              </div>

              {/* 已排除的食物 */}
              {plan.excluded.length > 0 && (
                <div className="mt-3">

                  <button
                    type="button"
                    onClick={() => setShowExcluded(v => !v)}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    {showExcluded ? '▾' : '▸'} 已依你的條件排除{' '}
                    {plan.excluded.length} 種食物
                  </button>

                  {showExcluded && (
                    <ul className="mt-1.5 space-y-0.5">
                      {plan.excluded.map(item => (
                        <li
                          key={item.name}
                          className="text-xs text-gray-500"
                        >
                          • {item.name}：{item.reason}
                        </li>
                      ))}
                    </ul>
                  )}

                </div>
              )}

              <p className="text-xs text-gray-400 mt-4">
                這是依你的設定與紀錄產生的建議，不是醫療處方。
                按「依建議餵食」後仍會先做餵食前檢查，由你確認；
                如有疑慮請諮詢獸醫。
              </p>

            </div>
          )}

        </div>
      )}

    </div>
  )
}