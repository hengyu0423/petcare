import { useState } from 'react'
import NutritionOverview from './NutritionOverview'
import MealPlanSection from './MealPlanSection'
import HealthReminderModal from './HealthReminderModal'

// ======================================================
// 今日飲食（精簡版）
//
// 只保留三件事：
//   1. 今天吃了多少（總覽）
//   2. 今天要餵什麼（計畫＋一鍵記錄；健康注意事項點擊跳出完整內容）
//   3. 今天的餵食紀錄
// ======================================================

const MEAL_LABEL = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  late: '宵夜',
  snack: '點心'
}

const MEAL_ICON = {
  breakfast: '🌅',
  lunch: '☀️',
  dinner: '🌙',
  late: '🌃',
  snack: '🍪'
}

export default function DietTodayTab({
  dateLabel,
  selectedDate,
  today,
  plan,
  planLoading,
  planError,
  refetchPlan,
  target,
  actualKcal,
  hasData,
  status,
  records,
  activeHealthEvents,
  pastHealthEvents,
  showPastHealthEvents,
  onTogglePastHealthEvents,
  dietAlerts,
  onFeedMeal,
  onAdjustMeal,
  onOpenManual,
  onEditPreferences,
  feedingKey,
  onOpenAdd,
  onEditRecord,
  onDeleteRecord
}) {
  const [healthModalOpen, setHealthModalOpen] = useState(false)

  const openHealthModal = () => setHealthModalOpen(true)

  return (
    <div>

      {/* 健康提醒改由飲食計畫裡的按鈕開啟，避免重複顯示 */}

      {/* 今日總覽 */}
      <NutritionOverview
        dateLabel={dateLabel}
        target={target}
        actualKcal={actualKcal}
        hasData={hasData}
        status={status}
      />

      {/* 今日餵食計畫（只針對今天） */}
      {selectedDate === today ? (
        <MealPlanSection
          plan={plan}
          isLoading={planLoading}
          isError={planError}
          refetch={refetchPlan}
          onFeedMeal={onFeedMeal}
          onAdjustMeal={onAdjustMeal}
          onOpenManual={onOpenManual}
          onEditPreferences={onEditPreferences}
          onOpenHealthDetails={openHealthModal}
          feedingKey={feedingKey}
        />
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4">
          <p className="text-sm text-gray-600 font-medium">
            正在查看 {dateLabel} 的飲食紀錄
          </p>
          <p className="text-xs text-gray-400 mt-1">
            每日餵食計畫只會顯示今天；切回今天即可編輯或依計畫餵食。
          </p>
        </div>
      )}

      {/* 當日餵食紀錄 */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">

        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-gray-800">
              {dateLabel}餵食紀錄
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              點 ✏️ 可以修改任何一筆紀錄
            </p>
          </div>

          {hasData && (
            <button
              type="button"
              onClick={onOpenAdd}
              className="text-xs bg-green-50 hover:bg-green-100 text-green-600 border border-green-200 px-3 py-1.5 rounded-lg font-semibold transition-colors whitespace-nowrap"
            >
              ＋ 新增
            </button>
          )}
        </div>

        {records.length === 0 ? (
          <div className="py-14 text-center">
            <p className="text-4xl mb-3">🍽️</p>

            <p className="text-gray-400 text-sm mb-4">
              這天還沒有餵食紀錄
            </p>

            {selectedDate === today && (
              <button
                onClick={onOpenAdd}
                className="bg-green-500 hover:bg-green-600 text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors"
              >
                新增第一筆
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-50">

            {records.map(record => (
              <div
                key={record.id}
                className="flex items-center gap-3 px-4 sm:px-5 py-4 hover:bg-gray-50 transition-colors"
              >

                <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center text-xl shrink-0">
                  {record.food_name?.includes('乾')
                    ? '🥣'
                    : record.food_name?.includes('罐') ||
                        record.food_name?.includes('濕')
                      ? '🥫'
                      : '🍖'}
                </div>

                <div className="flex-1 min-w-0">

                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-sm font-semibold text-gray-800 truncate">
                      {record.food_name}
                    </p>

                    {record.meal_type && (
                      <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                        {MEAL_ICON[record.meal_type] || '🍽️'}{' '}
                        {MEAL_LABEL[record.meal_type] || '自訂餐次'}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-gray-400 mt-0.5">
                    {record.amount_g}g
                    {' · '}
                    {new Date(record.fed_at).toLocaleTimeString('zh-TW', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>

                  {record.notes && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      注：{record.notes}
                    </p>
                  )}

                </div>

                {record.calories && (
                  <p className="text-sm font-bold text-gray-700 shrink-0">
                    {Number(record.calories).toFixed(0)} kcal
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => onEditRecord(record)}
                  className="text-gray-300 hover:text-green-500 transition-colors shrink-0"
                  title="編輯"
                >
                  ✏️
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (confirm('確定刪除這筆餵食紀錄？')) {
                      onDeleteRecord(record.id)
                    }
                  }}
                  className="text-gray-300 hover:text-red-400 transition-colors shrink-0"
                  title="刪除"
                >
                  🗑️
                </button>

              </div>
            ))}

          </div>
        )}

      </div>

      {/* 健康提醒完整內容 */}
      {healthModalOpen && (
        <HealthReminderModal
          activeHealthEvents={activeHealthEvents}
          pastHealthEvents={pastHealthEvents}
          showPastHealthEvents={showPastHealthEvents}
          onTogglePastHealthEvents={onTogglePastHealthEvents}
          dietAlerts={dietAlerts}
          onClose={() => setHealthModalOpen(false)}
        />
      )}

    </div>
  )
}
