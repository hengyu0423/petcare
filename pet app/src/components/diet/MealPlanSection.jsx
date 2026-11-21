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

const ICON = {
  breakfast: <><path d="M3 18h18" /><path d="M7 18a5 5 0 0 1 10 0" /><path d="M12 3v2M5 6l1.5 1.5M19 6l-1.5 1.5M2 12h2M20 12h2" /></>,
  lunch: <><circle cx="12" cy="12" r="4.5" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4" /></>,
  dinner: <path d="M20 15.5A8 8 0 0 1 9 4.5a8 8 0 1 0 11 11Z" />,
  late: <><path d="M19 15A7 7 0 0 1 10 5.2 7 7 0 1 0 19 15Z" /><path d="M17 3l.6 1.4L19 5l-1.4.6L17 7l-.6-1.4L15 5l1.4-.6L17 3Z" /></>,
  snack: <><circle cx="12" cy="12" r="8" /><circle cx="9.5" cy="10" r="1" fill="currentColor" stroke="none" /><circle cx="14.5" cy="9.5" r="1" fill="currentColor" stroke="none" /><circle cx="11.5" cy="14.5" r="1" fill="currentColor" stroke="none" /></>,
  plate: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="5" /></>,
  stethoscope: <><path d="M6 4v5a4 4 0 0 0 8 0V4" /><path d="M10 13v2.5a4.5 4.5 0 0 0 9 0V13" /><circle cx="19" cy="12" r="1.8" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M12 2.5l1 2 2.2-.5 1.1 2-1.4 1.8 1.4 1.8-1.1 2-2.2-.5-1 2h-2l-1-2-2.2.5-1.1-2 1.4-1.8-1.4-1.8 1.1-2 2.2.5 1-2h2Z" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  alert: <><path d="M12 4.5 21 19.5H3L12 4.5Z" /><path d="M12 10v4M12 17h.01" /></>,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  chevron: <path d="M6 9l6 6 6-6" />
}

function LineIcon({ name, size = 16, className = '' }) {
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
      className={`shrink-0 ${className}`}
    >
      {ICON[name] || ICON.plate}
    </svg>
  )
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

  // 健康相關的提醒不在這裡重複顯示，改成一顆按鈕，點了跳出「健康提醒」視窗
  const healthNotices = notices.filter(notice => notice.kind === 'health')
  const otherNotices = notices.filter(notice => notice.kind !== 'health')
  // 數字要和「健康提醒」視窗的內容一致（注意期內的健康事件 + 飲食警訊），
  // 不能直接用 notices 的數量，否則同一件事可能被算成兩則
  const healthCount = healthNoticeCount ?? healthNotices.length

  const warningNotices = otherNotices.filter(n => n.level === 'warning')
  const infoNotices = otherNotices.filter(n => n.level !== 'warning')

  return (
    <div className="rounded-3xl border border-[#f3e3cd] bg-plate p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-bold text-pine-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#fff3d6] text-[#c96f2e]">
              <LineIcon name="plate" size={17} />
            </span>
            今天要餵什麼？
          </h2>
          {plan?.today?.remainingKcal != null && !plan?.overBudget && (
            <p className="mt-1 text-[11px] font-medium text-ink-soft">
              今天還可以吃：約 {formatKcal(plan.today.remainingKcal)} kcal
            </p>
          )}
          {plan?.overBudget && (
            <p className="mt-1 text-[11px] font-bold text-[#a5681c]">
              今天已達建議上限，剩餘餐次建議跳過
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onEditPreferences}
            className="inline-flex items-center gap-1 text-xs font-semibold text-ink-soft transition-colors hover:text-pine-700"
          >
            <LineIcon name="gear" size={14} />
            計畫設定
          </button>
          <button
            type="button"
            onClick={onOpenManual}
            className="inline-flex items-center gap-1 text-xs font-semibold text-ink-soft transition-colors hover:text-pine-700"
          >
            <LineIcon name="plus" size={14} />
            手動新增
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-[#faf7ef]" />
          ))}
        </div>
      )}

      {isError && (
        <div className="py-6 text-center">
          <p className="text-sm text-ink-soft">暫時無法產生飲食計畫。</p>
          <div className="mt-3 flex justify-center gap-4">
            <button
              type="button"
              onClick={() => refetch?.()}
              className="text-sm font-bold text-pine-700 hover:underline"
            >
              重試
            </button>
            <button
              type="button"
              onClick={onOpenManual}
              className="text-sm text-ink-soft hover:underline"
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
              className="mb-3 flex w-full items-center gap-2.5 rounded-2xl border border-[#f0d9b5] bg-[#fff8e9] px-3 py-2.5 text-left transition-colors hover:bg-[#fdf0d9]"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-plate text-[#c96f2e]">
                <LineIcon name="stethoscope" size={17} />
              </span>
              <span className="flex-1 text-xs font-bold text-[#7a5200]">
                有 {healthCount} 則健康注意事項影響這份計畫
              </span>
              <span className="shrink-0 text-xs font-bold text-[#a5681c]">點擊查看 →</span>
            </button>
          )}

          {warningNotices.length > 0 && (
            <div className="mb-3 space-y-1.5">
              {warningNotices.map((notice, index) => (
                <p
                  key={index}
                  className="flex items-start gap-1.5 rounded-xl bg-[#fff8e9] px-3 py-2 text-xs leading-relaxed text-[#7a5200]"
                >
                  <LineIcon name="alert" size={13} className="mt-0.5" />
                  {notice.text}
                </p>
              ))}
            </div>
          )}

          <div className="space-y-2.5">
            {plan.meals.length === 0 && (
              <p className="py-6 text-center text-sm text-ink-soft">
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
                  className={`rounded-2xl border p-3.5 ${
                    meal.logged
                      ? 'border-pine-100 bg-pine-50/60'
                      : 'border-[#eae6d8] bg-[#faf7ef]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="flex items-center gap-2 text-sm font-bold text-pine-900">
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-plate text-pine-700">
                        <LineIcon name={meal.key} size={17} />
                      </span>
                      {meal.label}
                      <span className="text-xs font-medium text-ink-soft">{meal.time}</span>
                    </p>
                    {meal.logged && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-pine-100 px-2 py-0.5 text-[11px] font-bold text-pine-700">
                        <LineIcon name="check" size={12} />
                        已記錄
                      </span>
                    )}
                  </div>

                  {meal.skip ? (
                    <p className="mt-2 flex items-start gap-1.5 rounded-xl border border-[#f0d9b5] bg-[#fff8e9] px-3 py-2.5 text-xs leading-relaxed text-[#7a5200]">
                      <LineIcon name="alert" size={14} className="mt-0.5" />
                      今天已達建議熱量上限，這餐建議跳過；如需餵食，只給極少量清淡食物。
                    </p>
                  ) : !option ? (
                    <p className="mt-2 text-xs text-ink-soft">目前沒有適合的食物。</p>
                  ) : (
                    <div className="mt-2.5">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className="text-sm font-bold text-pine-900">{option.name}</span>
                        <span className="text-xs text-ink-soft">
                          {option.amountG
                            ? `${option.amountG} g · ${formatKcal(option.kcal)} kcal`
                            : '份量請依包裝建議'}
                        </span>
                        {option.fixed && (
                          <span className="rounded-full bg-pine-50 px-1.5 py-0.5 text-[10px] font-bold text-pine-700">固定</span>
                        )}
                      </div>

                      {meal.adjusted && (
                        <p className="mt-1 text-[11px] font-semibold text-pine-700">已依今天攝取調整份量</p>
                      )}

                      {option.warnings.length > 0 && (
                        <div className="mt-1.5 space-y-0.5">
                          {option.warnings.map(w => (
                            <p key={w.title} className="flex items-start gap-1 text-xs text-[#a5681c]">
                              <LineIcon name="alert" size={12} className="mt-0.5" />
                              {w.title}
                            </p>
                          ))}
                        </div>
                      )}

                      {!meal.logged && (
                        <div className="mt-3 flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            onClick={() => onFeedMeal(meal, option)}
                            disabled={!option.amountG || isFeeding}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-[#f5c04a] px-4 py-2 text-xs font-extrabold text-pine-900 shadow-[0_4px_0_#c96f2e] transition-all hover:bg-[#f0b23a] active:translate-y-[3px] active:shadow-none disabled:opacity-50"
                          >
                            <LineIcon name="check" size={14} />
                            {isFeeding ? '記錄中…' : option.amountG ? '餵食並記錄' : '請先設定份量'}
                          </button>
                          <button
                            type="button"
                            onClick={() => onAdjustMeal(meal, option)}
                            className="text-xs font-semibold text-ink-soft transition-colors hover:text-pine-700"
                          >
                            調整份量
                          </button>
                          {meal.options.length > 1 && (
                            <button
                              type="button"
                              onClick={() => cycle(meal)}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-ink-soft transition-colors hover:text-pine-700"
                            >
                              <LineIcon name="chevron" size={12} />
                              換一款（{index + 1}/{meal.options.length}）
                            </button>
                          )}
                        </div>
                      )}

                      {meal.logged && (
                        <p className="mt-2 text-[11px] text-pine-700/80">
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
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setShowWhy(v => !v)}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-ink-soft transition-colors hover:text-pine-700"
              >
                <LineIcon name="chevron" size={12} className={showWhy ? 'rotate-180' : ''} />
                {showWhy ? '收合說明' : '為什麼這樣建議？'}
              </button>
              {showWhy && (
                <div className="mt-2 space-y-1">
                  {infoNotices.map((notice, index) => (
                    <p key={index} className="text-[11px] leading-relaxed text-ink-soft">
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
                className="inline-flex items-center gap-1 text-[11px] font-bold text-ink-soft transition-colors hover:text-pine-700"
              >
                <LineIcon name="chevron" size={12} className={showExcluded ? 'rotate-180' : ''} />
                {showExcluded ? '收合' : `已排除 ${plan.excluded.length} 種食物`}
              </button>
              {showExcluded && (
                <ul className="mt-2 space-y-0.5">
                  {plan.excluded.map(item => (
                    <li key={item.name} className="text-[11px] text-ink-soft">
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
