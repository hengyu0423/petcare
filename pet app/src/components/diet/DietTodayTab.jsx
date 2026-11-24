import PixelIcon from '../brand/PixelIcon'
import EmptyState from '../ui/EmptyState'
import { foodKind, KIND_TILE } from './foodKind'
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

const ICON = {
  breakfast: <><path d="M3 18h18" /><path d="M7 18a5 5 0 0 1 10 0" /><path d="M12 3v2M5 6l1.5 1.5M19 6l-1.5 1.5M2 12h2M20 12h2" /></>,
  lunch: <><circle cx="12" cy="12" r="4.5" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4" /></>,
  dinner: <path d="M20 15.5A8 8 0 0 1 9 4.5a8 8 0 1 0 11 11Z" />,
  late: <><path d="M19 15A7 7 0 0 1 10 5.2 7 7 0 1 0 19 15Z" /><path d="M17 3l.6 1.4L19 5l-1.4.6L17 7l-.6-1.4L15 5l1.4-.6L17 3Z" /></>,
  snack: <><circle cx="12" cy="12" r="8" /><circle cx="9.5" cy="10" r="1" fill="currentColor" stroke="none" /><circle cx="14.5" cy="9.5" r="1" fill="currentColor" stroke="none" /><circle cx="11.5" cy="14.5" r="1" fill="currentColor" stroke="none" /></>,
  bowl: <><path d="M3.5 11.5h17" /><path d="M5 11.5c0 4.7 3.1 8 7 8s7-3.3 7-8" /><path d="M9 8c0-1.7 1.4-3 3-3s3 1.3 3 3" /></>,
  can: <><rect x="6" y="5" width="12" height="14" rx="2" /><path d="M6 9h12M6 15h12" /><path d="M10 5V3.5h4V5" /></>,
  meat: <><path d="M6.5 6.5c2-2 5-2.2 7.2-.8 1.6 1 2.3 2.7 2 4.3 2.8.4 4.3 3.2 3.2 5.8-1.1 2.7-4.2 4-7 3-2.8-1-4.3-3.8-3.2-6.4-1.9-1.7-2.2-4.4-.2-5.9Z" /><circle cx="14.5" cy="14.5" r="1.2" fill="currentColor" stroke="none" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  pencil: <><path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3Z" /><path d="M14.5 6.5l3 3" /></>,
  trash: <><path d="M4.5 7h15" /><path d="M9 7V5h6v2" /><path d="M6.5 7l.8 12h9.4l.8-12" /><path d="M10 10.5v5M14 10.5v5" /></>,
  plate: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="5" /></>
}

function LineIcon({ name, size = 18, className = '' }) {
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
    <div className="space-y-4">

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
          healthNoticeCount={
            activeHealthEvents.length + (dietAlerts?.alerts?.length || 0)
          }
          feedingKey={feedingKey}
        />
      ) : (
        <div className="rounded-2xl border border-honey-200 bg-honey-50 p-4">
          <p className="text-sm font-bold text-honey-ink">
            正在查看 {dateLabel} 的飲食紀錄
          </p>
          <p className="mt-1 text-xs text-honey-text">
            每日餵食計畫只會顯示今天；切回今天即可編輯或依計畫餵食。
          </p>
        </div>
      )}

      {/* 當日餵食紀錄 */}
      <div className="overflow-hidden rounded-3xl border border-hair shadow-card bg-plate">
        <div className="flex items-center justify-between gap-2 border-b border-hair px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-pine-900">
              {dateLabel}餵食紀錄
            </h2>
            <p className="mt-0.5 text-xs text-ink-soft">
              點鉛筆圖示可以修改任何一筆紀錄
            </p>
          </div>

          {hasData && (
            <button
              type="button"
              onClick={onOpenAdd}
              className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-hair-strong bg-plate px-3 py-1.5 text-xs font-bold text-pine-800 transition-colors hover:bg-warm"
            >
              <LineIcon name="plus" size={13} />
              新增
            </button>
          )}
        </div>

        {records.length === 0 ? (
          <div className="p-4 sm:p-5">
            <EmptyState
              compact
              icon="dry"
              title="這天還沒有餵食紀錄"
              action={selectedDate === today ? { label: '新增第一筆', onClick: onOpenAdd } : undefined}
            />
          </div>
        ) : (
          <div className="divide-y divide-hair">
            {records.map(record => (
              <div
                key={record.id}
                className="flex items-center gap-3 px-4 py-4 transition-colors hover:bg-cream sm:px-5"
              >
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${KIND_TILE[foodKind(record.food_name)]}`}>
                  <PixelIcon name={foodKind(record.food_name)} size={30} />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="truncate text-sm font-bold text-pine-900">
                      {record.food_name}
                    </p>
                    {record.meal_type && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-cream px-2 py-0.5 text-[10px] font-semibold text-ink-soft">
                        <LineIcon name={record.meal_type} size={12} />
                        {MEAL_LABEL[record.meal_type] || '自訂餐次'}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-ink-soft">
                    {record.amount_g}g · {new Date(record.fed_at).toLocaleTimeString('zh-TW', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                  {record.notes && (
                    <p className="mt-0.5 text-xs text-ink-soft/80">注：{record.notes}</p>
                  )}
                </div>

                {record.calories && (
                  <p className="shrink-0 whitespace-nowrap text-right">
                    <span className="font-brand text-base font-extrabold tabular-nums text-pine-900">
                      {Number(record.calories).toFixed(0)}
                    </span>
                    <span className="ml-1 font-mono text-[10px] text-ink-mute">kcal</span>
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => onEditRecord(record)}
                  title="編輯"
                  aria-label="編輯"
                  className="shrink-0 rounded-lg p-1.5 text-ink-soft/50 transition-colors hover:bg-pine-50 hover:text-pine-700"
                >
                  <LineIcon name="pencil" size={16} />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (confirm('確定刪除這筆餵食紀錄？')) {
                      onDeleteRecord(record.id)
                    }
                  }}
                  title="刪除"
                  aria-label="刪除"
                  className="shrink-0 rounded-lg p-1.5 text-ink-soft/50 transition-colors hover:bg-clay-50 hover:text-clay"
                >
                  <LineIcon name="trash" size={16} />
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
