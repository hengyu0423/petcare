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
    className: 'bg-pine-50 text-pine-700 border-pine-100'
  },
  urgent: {
    label: '建議儘快就醫',
    className: 'bg-[#fff8e9] text-[#a5681c] border-[#f0d9b5]'
  },
  emergency: {
    label: '緊急',
    className: 'bg-[#fdf0ec] text-[#b4552f] border-[#f3c2b8]'
  }
}

const ICON = {
  stethoscope: <><path d="M6 4v5a4 4 0 0 0 8 0V4" /><path d="M10 13v2.5a4.5 4.5 0 0 0 9 0V13" /><circle cx="19" cy="12" r="1.8" /></>,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  plate: <><path d="M3.5 11.5h17" /><path d="M5 11.5c0 4.7 3.1 8 7 8s7-3.3 7-8" /><path d="M9 8c0-1.7 1.4-3 3-3s3 1.3 3 3" /></>,
  alert: <><path d="M12 4.5 21 19.5H3L12 4.5Z" /><path d="M12 10v4M12 17h.01" /></>,
  bulb: <><path d="M9 17.5h6M10 20h4" /><path d="M8 13a5 5 0 1 1 8 0c-.9 1-1.5 1.8-1.5 3h-5c0-1.2-.6-2-1.5-3Z" /></>,
  shield: <><path d="M12 3.5 5 6v5.5c0 4.2 3 7.5 7 9 4-1.5 7-4.8 7-9V6l-7-2.5Z" /><path d="M9 12l2 2 4-4" /></>,
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
      {ICON[name] || ICON.shield}
    </svg>
  )
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
      className="fixed inset-0 z-50 flex items-end justify-center bg-pine-900/35 backdrop-blur-sm sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="健康提醒"
    >
      <div
        className="max-h-[85vh] w-full overflow-y-auto rounded-t-3xl border border-[#f0e6d2] bg-plate shadow-[0_30px_60px_-30px_rgba(87,54,17,0.55)] sm:max-w-lg sm:rounded-3xl"
        onClick={event => event.stopPropagation()}
      >
        {/* 標題列 */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[#f0e6d2] bg-plate px-5 py-4">
          <p className="flex items-center gap-2 text-sm font-bold text-pine-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#fff3d6] text-[#c96f2e]">
              <LineIcon name="stethoscope" size={17} />
            </span>
            健康提醒
            <span className="rounded-full bg-[#fff3d6] px-2 py-0.5 text-xs font-bold text-[#a5681c]">
              {healthCount}
            </span>
          </p>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-[#fdf6ea] hover:text-pine-900"
            aria-label="關閉"
          >
            <LineIcon name="close" size={16} />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          {/* 注意期內的健康事件 */}
          {activeHealthEvents.map(event => {
            const info = event.diet_info || {}
            const severity = HEALTH_SEVERITY[event.severity]

            return (
              <div key={event.id} className="rounded-2xl border border-[#f0d9b5] bg-[#fff8e9] p-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-pine-900">{event.title}</span>
                  {severity && (
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${severity.className}`}>
                      {severity.label}
                    </span>
                  )}
                  <span className="text-xs text-ink-soft/80">{event.date_str}</span>
                  <span className="rounded-full bg-plate px-2 py-0.5 text-xs font-semibold text-[#a5681c]">
                    {event.is_active ? `注意至 ${event.diet_until_str}` : '已過注意期'}
                  </span>
                </div>

                {event.description && (
                  <p className="mt-2 text-xs leading-relaxed text-ink-soft">{event.description}</p>
                )}
                {info.dietNotes && (
                  <p className="mt-2 flex items-start gap-1.5 text-sm font-medium text-pine-800">
                    <LineIcon name="plate" size={15} className="mt-0.5" />
                    {info.dietNotes}
                  </p>
                )}
                {info.avoidFoods?.length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-semibold text-ink-soft">應避免：</span>
                    {info.avoidFoods.map(food => (
                      <span key={food} className="rounded-full border border-[#f3c2b8] bg-[#fdf0ec] px-2 py-0.5 text-xs font-semibold text-[#b4552f]">
                        {food}
                      </span>
                    ))}
                  </div>
                )}
                {info.dietAdvice?.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {info.dietAdvice.map(item => (
                      <li key={item} className="flex items-start gap-1.5 text-xs text-ink-soft">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-pine-700" />
                        {item}
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
                  className={`rounded-2xl border p-3.5 ${
                    alert.level === 'warning'
                      ? 'border-[#f0d9b5] bg-[#fff8e9]'
                      : 'border-[#eae6d8] bg-[#faf7ef]'
                  }`}
                >
                  <p className="flex items-center gap-1.5 text-sm font-bold text-pine-900">
                    <LineIcon name={alert.level === 'warning' ? 'alert' : 'bulb'} size={15} className={alert.level === 'warning' ? 'text-[#c96f2e]' : 'text-pine-700'} />
                    {alert.title}
                  </p>
                  <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">{alert.message}</p>
                  {alert.suggestion && (
                    <p className="mt-2 text-xs leading-relaxed text-[#a5681c]">建議：{alert.suggestion}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {activeHealthEvents.length === 0 && (
            <p className="rounded-xl bg-[#faf7ef] px-3 py-3 text-sm text-ink-soft">
              目前沒有注意期內的健康事件
            </p>
          )}

          {/* 已過注意期的事件 */}
          {pastHealthEvents.length > 0 && (
            <div>
              <button
                type="button"
                onClick={onTogglePastHealthEvents}
                className="inline-flex items-center gap-1 text-xs font-bold text-ink-soft transition-colors hover:text-pine-700"
              >
                <LineIcon name="chevron" size={12} className={showPastHealthEvents ? 'rotate-180' : ''} />
                {showPastHealthEvents
                  ? '收合已過注意期的紀錄'
                  : `已過注意期（${pastHealthEvents.length} 筆）`}
              </button>
              {showPastHealthEvents && (
                <div className="mt-2 space-y-2">
                  {pastHealthEvents.map(event => (
                    <div key={event.id} className="rounded-xl border border-[#eae6d8] bg-[#faf7ef] p-3 opacity-80">
                      <p className="text-sm font-semibold text-pine-800">
                        {event.title}
                        <span className="ml-2 text-xs font-medium text-ink-soft/80">
                          {event.date_str}｜已過注意期
                        </span>
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <p className="pt-1 text-xs text-ink-soft/80">AI 記錄僅供參考，不能取代獸醫診斷。</p>

          <div className="flex flex-wrap gap-4 pb-1">
            <Link to="/health-consult" onClick={onClose} className="text-xs font-bold text-pine-700 hover:text-[#c96f2e]">
              健康諮詢 →
            </Link>
            <Link to="/weekly-report" onClick={onClose} className="text-xs font-bold text-pine-700 hover:text-[#c96f2e]">
              健康週報 →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
