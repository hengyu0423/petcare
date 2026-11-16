import { useState } from 'react'

// ======================================================
// 今日飲食計畫（精簡版）
//
// 一般飼主只需要看到「這一餐吃什麼、吃多少、按下去記錄」。
// 因此：
//   - 不再放 A/B 模式切換，手動新增改成右上角小連結
//   - 不再重複顯示今日熱量進度（總覽已經有）
//   - 推薦原因、已排除食物收在需要時再展開
//   - 每一餐只有一個主要動作：餵食並記錄
// ======================================================

const MEAL_ICON = {
  breakfast: '🌅',
  lunch: '☀️',
  dinner: '🌙',
  late: '🌃',
  snack: '🍪'
}

function formatKcal(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number.toLocaleString('zh-TW') : '—'
}

export default function MealPlanSection({
  plan,
  isLoading,
  isError,
  refetch,
  onFeedMeal,
  onAdjustMeal,
  onOpenManual,
  onEditPreferences,
  onOpenHealthDetails,
  healthNoticeCount,
  feedingKey
}) {
  const [choice, setChoice] = useState({})
  const [showWhy, setShowWhy] = useState(false)
  const [showExcluded, setShowExcluded] = useState(false)

  const cycle = meal => {
    setChoice(prev => ({
      ...prev,
      [meal.key]: ((prev[meal.key] ?? 0) + 1) % meal.options.length
    }))
  }

  const notices = plan?.notices || []

  // 健康相關的提醒不在這裡重複顯示，
  // 改成一顆按鈕，點了跳出「健康提醒」視窗
  const healthNotices = notices.filter(notice => notice.kind === 'health')
  const otherNotices = notices.filter(notice => notice.kind !== 'health')

  // 數字要和「健康提醒」視窗的內容一致（注意期內的健康事件 + 飲食警訊），
  // 不能直接用 notices 的數量，否則同一件事可能被算成兩則
  const healthCount = healthNoticeCount ?? healthNotices.length

  const warningNotices = otherNotices.filter(n => n.level === 'warning')
  const infoNotices = otherNotices.filter(n => n.level !== 'warning')

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">

      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">

        <div>
          <h2 className="text-sm font-bold text-gray-800">
            🍽️ 今天要餵什麼？
          </h2>

          {plan?.today?.remainingKcal != null && !plan?.overBudget && (
            <p className="text-[11px] text-gray-400 mt-0.5">
              今天還可以吃：約 {formatKcal(plan.today.remainingKcal)} kcal
            </p>
          )}

          {plan?.overBudget && (
            <p className="text-[11px] text-amber-700 font-medium mt-0.5">
              今天已達建議上限，剩餘餐次建議跳過
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onEditPreferences}
            className="text-xs text-gray-400 hover:text-green-600"
          >
            ⚙️ 計畫設定
          </button>

          <button
            type="button"
            onClick={onOpenManual}
            className="text-xs text-gray-400 hover:text-green-600"
          >
            ＋ 手動新增
          </button>
        </div>

      </div>

      {isLoading && (
        <div className="space-y-2">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="h-16 rounded-lg bg-gray-50 animate-pulse"
            />
          ))}
        </div>
      )}

      {isError && (
        <div className="text-center py-6">
          <p className="text-sm text-gray-500">
            暫時無法產生飲食計畫。
          </p>

          <div className="flex justify-center gap-4 mt-3">
            <button
              type="button"
              onClick={() => refetch?.()}
              className="text-sm text-green-600 font-semibold hover:underline"
            >
              重試
            </button>

            <button
              type="button"
              onClick={onOpenManual}
              className="text-sm text-gray-500 hover:underline"
            >
              手動新增
            </button>
          </div>
        </div>
      )}

      {plan && (
        <div>

          {/* 健康警示：點了跳出健康提醒視窗，不在這裡重複顯示全文 */}
          {healthCount > 0 && (
            <button
              type="button"
              onClick={() => onOpenHealthDetails?.()}
              className="w-full flex items-center gap-2 rounded-lg px-3 py-2.5 bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100 transition-colors mb-2 text-left"
            >
              <span className="shrink-0">🩺</span>
              <span className="flex-1 text-xs font-semibold">
                有 {healthCount} 則健康注意事項影響這份計畫
              </span>
              <span className="text-xs font-semibold shrink-0">
                點擊查看 →
              </span>
            </button>
          )}

          {warningNotices.length > 0 && (
            <div className="space-y-1.5 mb-3">
              {warningNotices.map((notice, index) => (
                <p
                  key={index}
                  className="text-xs leading-relaxed rounded-lg px-3 py-2 bg-amber-50 text-amber-700"
                >
                  ⚠️ {notice.text}
                </p>
              ))}
            </div>
          )}

          <div className="space-y-2.5">

            {plan.meals.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-6">
                目前沒有可推薦的餐次，請手動新增或調整計畫設定。
              </p>
            )}

            {plan.meals.map(meal => {
              const index = choice[meal.key] ?? 0
              const option = meal.options[index]
              const isFeeding = feedingKey === meal.key

              return (
                <div
                  key={meal.key}
                  className={`rounded-xl border p-3 ${
                    meal.logged
                      ? 'border-green-200 bg-green-50/40'
                      : 'border-gray-100 bg-white'
                  }`}
                >

                  <div className="flex items-center justify-between gap-2">

                    <p className="text-sm font-bold text-gray-800">
                      {MEAL_ICON[meal.key] || '🍽️'} {meal.label}
                      <span className="ml-2 text-xs font-normal text-gray-400">
                        {meal.time}
                      </span>
                    </p>

                    {meal.logged ? (
                      <span className="text-[11px] font-semibold text-green-600 bg-green-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                        ✓ 已記錄
                      </span>
                    ) : null}

                  </div>

                  {meal.skip ? (
                    <p className="text-xs leading-relaxed text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2.5 mt-2">
                      ⚠️ 今天已達建議熱量上限，這餐建議跳過；
                      如需餵食，只給極少量清淡食物。
                    </p>
                  ) : !option ? (
                    <p className="text-xs text-gray-400 mt-2">
                      目前沒有適合的食物。
                    </p>
                  ) : (
                    <div className="mt-2">

                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className="text-sm font-semibold text-gray-800">
                          {option.name}
                        </span>

                        <span className="text-xs text-gray-500">
                          {option.amountG
                            ? `${option.amountG} g · ${formatKcal(option.kcal)} kcal`
                            : '份量請依包裝建議'}
                        </span>

                        {option.fixed && (
                          <span className="text-[10px] text-green-600">
                            固定
                          </span>
                        )}
                      </div>

                      {meal.adjusted && (
                        <p className="text-[11px] text-green-600 mt-0.5">
                          已依今天攝取調整份量
                        </p>
                      )}

                      {option.warnings.length > 0 && (
                        <div className="mt-1.5 space-y-0.5">
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

                      {!meal.logged && (
                        <div className="flex flex-wrap items-center gap-3 mt-2.5">

                          <button
                            type="button"
                            onClick={() => onFeedMeal(meal, option)}
                            disabled={!option.amountG || isFeeding}
                            className="bg-green-500 hover:bg-green-600 text-white rounded-lg px-4 py-2 text-xs font-semibold transition-colors disabled:opacity-50"
                          >
                            {isFeeding
                              ? '記錄中…'
                              : option.amountG
                                ? '✓ 餵食並記錄'
                                : '請先設定份量'}
                          </button>

                          <button
                            type="button"
                            onClick={() => onAdjustMeal(meal, option)}
                            className="text-xs text-gray-400 hover:text-green-600"
                          >
                            調整份量
                          </button>

                          {meal.options.length > 1 && (
                            <button
                              type="button"
                              onClick={() => cycle(meal)}
                              className="text-xs text-gray-400 hover:text-green-600"
                            >
                              換一款（{index + 1}/{meal.options.length}）
                            </button>
                          )}

                        </div>
                      )}

                      {meal.logged && (
                        <p className="text-[11px] text-green-600/80 mt-1.5">
                          這一餐已建立紀錄，可在下方修改，不會重複新增。
                        </p>
                      )}

                    </div>
                  )}

                </div>
              )
            })}

          </div>

          {/* 為什麼這樣建議 */}
          {infoNotices.length > 0 && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setShowWhy(v => !v)}
                className="text-[11px] text-gray-400 hover:text-gray-600"
              >
                {showWhy ? '收合說明 ▲' : '為什麼這樣建議？▼'}
              </button>

              {showWhy && (
                <div className="mt-1.5 space-y-1">
                  {infoNotices.map((notice, index) => (
                    <p
                      key={index}
                      className="text-[11px] text-gray-500 leading-relaxed"
                    >
                      · {notice.text}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 已排除的食物 */}
          {plan.excluded.length > 0 && (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setShowExcluded(v => !v)}
                className="text-[11px] text-gray-400 hover:text-gray-600"
              >
                {showExcluded ? '收合 ▲' : `已排除 ${plan.excluded.length} 種食物 ▼`}
              </button>

              {showExcluded && (
                <ul className="mt-1.5 space-y-0.5">
                  {plan.excluded.map(item => (
                    <li
                      key={item.name}
                      className="text-[11px] text-gray-500"
                    >
                      · {item.name}：{item.reason}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

        </div>
      )}

    </div>
  )
}
