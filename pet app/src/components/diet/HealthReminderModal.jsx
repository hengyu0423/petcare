import { Link } from 'react-router-dom'

// ======================================================
// 健康提醒（完整內容 Modal）
//
// 「今日飲食」的健康提醒卡只顯示一行摘要，
// 完整的健康事件明細、飲食注意與避免食物都在這裡，
// 點「查看」或飲食計畫的健康警示都會跳出這個視窗。
// ======================================================

const HEALTH_SEVERITY = {
  normal: {
    label: '一般',
    className: 'bg-green-50 text-green-600 border-green-200'
  },
  urgent: {
    label: '建議儘快就醫',
    className: 'bg-amber-50 text-amber-600 border-amber-200'
  },
  emergency: {
    label: '緊急',
    className: 'bg-red-50 text-red-600 border-red-200'
  }
}

export default function HealthReminderModal({
  activeHealthEvents,
  pastHealthEvents,
  showPastHealthEvents,
  onTogglePastHealthEvents,
  dietAlerts,
  onClose
}) {
  const healthCount =
    activeHealthEvents.length + (dietAlerts?.alerts?.length || 0)

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="健康提醒"
    >

      <div
        className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-xl max-h-[85vh] overflow-y-auto"
        onClick={event => event.stopPropagation()}
      >

        {/* 標題列 */}
        <div className="sticky top-0 bg-white flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-100 z-10">
          <p className="text-sm font-bold text-gray-800 flex items-center gap-2">
            🩺 健康提醒
            <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">
              {healthCount}
            </span>
          </p>

          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 text-sm"
            aria-label="關閉"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">

          {/* 注意期內的健康事件 */}
          {activeHealthEvents.map(event => {
            const info = event.diet_info || {}
            const severity = HEALTH_SEVERITY[event.severity]

            return (
              <div
                key={event.id}
                className="rounded-xl border border-amber-200 bg-amber-50/50 p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-gray-800">
                    {event.title}
                  </span>

                  {severity && (
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${severity.className}`}
                    >
                      {severity.label}
                    </span>
                  )}

                  <span className="text-xs text-gray-400">
                    {event.date_str}
                  </span>

                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                    {event.is_active
                      ? `注意至 ${event.diet_until_str}`
                      : '已過注意期'}
                  </span>
                </div>

                {event.description && (
                  <p className="text-xs text-gray-500 mt-1.5">
                    {event.description}
                  </p>
                )}

                {info.dietNotes && (
                  <p className="text-sm text-gray-700 mt-1.5">
                    🍽️ {info.dietNotes}
                  </p>
                )}

                {info.avoidFoods?.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <span className="text-xs text-gray-400">
                      應避免：
                    </span>

                    {info.avoidFoods.map(food => (
                      <span
                        key={food}
                        className="text-xs bg-red-50 text-red-500 border border-red-100 px-2 py-0.5 rounded-full"
                      >
                        {food}
                      </span>
                    ))}
                  </div>
                )}

                {info.dietAdvice?.length > 0 && (
                  <ul className="mt-2 space-y-0.5">
                    {info.dietAdvice.map(item => (
                      <li
                        key={item}
                        className="text-xs text-gray-500"
                      >
                        • {item}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}

          {/* 例行飲食警訊（食物集中、熱量集中等） */}
          {dietAlerts?.alerts?.length > 0 && (
            <div className="space-y-2">
              {dietAlerts.alerts.map(alert => (
                <div
                  key={alert.id}
                  className={`rounded-xl border p-3 ${
                    alert.level === 'warning'
                      ? 'border-amber-200 bg-amber-50/50'
                      : 'border-gray-100 bg-gray-50'
                  }`}
                >
                  <p className="text-sm font-semibold text-gray-800">
                    {alert.level === 'warning' ? '⚠️' : '💡'} {alert.title}
                  </p>

                  <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                    {alert.message}
                  </p>

                  {alert.suggestion && (
                    <p className="text-xs text-amber-700 mt-1.5 leading-relaxed">
                      建議：{alert.suggestion}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {activeHealthEvents.length === 0 && (
            <p className="text-sm text-gray-400">
              目前沒有注意期內的健康事件 👍
            </p>
          )}

          {/* 已過注意期的事件 */}
          {pastHealthEvents.length > 0 && (
            <div>
              <button
                type="button"
                onClick={onTogglePastHealthEvents}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                {showPastHealthEvents
                  ? '收合已過注意期的紀錄 ▲'
                  : `已過注意期（${pastHealthEvents.length} 筆）▼`}
              </button>

              {showPastHealthEvents && (
                <div className="mt-2 space-y-2">
                  {pastHealthEvents.map(event => (
                    <div
                      key={event.id}
                      className="rounded-lg border border-gray-100 bg-gray-50 opacity-70 p-3"
                    >
                      <p className="text-sm font-semibold text-gray-700">
                        {event.title}
                        <span className="ml-2 text-xs font-normal text-gray-400">
                          {event.date_str}｜已過注意期
                        </span>
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <p className="text-xs text-gray-400 pt-1">
            AI 記錄僅供參考，不能取代獸醫診斷。
          </p>

          <div className="flex flex-wrap gap-3 pb-1">
            <Link
              to="/health-consult"
              onClick={onClose}
              className="text-xs text-green-600 font-semibold hover:underline"
            >
              健康諮詢 →
            </Link>

            <Link
              to="/weekly-report"
              onClick={onClose}
              className="text-xs text-green-600 font-semibold hover:underline"
            >
              健康週報 →
            </Link>
          </div>

        </div>

      </div>

    </div>
  )
}
