// 寵物健康紀錄用到的常數、日期計算與資料查詢。
// 放在 lib 而不是元件檔裡：元件檔只匯出元件，Vite 的熱更新（react-refresh）才不會出問題。

import { useQuery } from '@tanstack/react-query'
import { api } from './api'
import { todayString, daysBetween } from './petInsights'

// 手動新增時可選的類型（對應後端 health_records.type）
export const MANUAL_TYPES = [
    { value: 'vaccine', label: '疫苗', emoji: '💉', nextMonths: 12 },
    { value: 'deworm', label: '驅蟲', emoji: '🪱', nextMonths: 3 },
    { value: 'checkup', label: '健檢', emoji: '🩺', nextMonths: 12 },
    { value: 'visit', label: '看診', emoji: '🏥', nextMonths: null },
    { value: 'surgery', label: '手術', emoji: '🔪', nextMonths: null },
    { value: 'other', label: '其他', emoji: '📝', nextMonths: null }
]

// 健康諮詢（AI）自動建立的紀錄類型
export const AI_TYPE_LABELS = {
    vomiting: '嘔吐',
    diarrhea: '腹瀉',
    constipation: '便秘',
    appetite_loss: '食慾不振',
    allergy: '過敏',
    poisoning: '誤食／中毒'
}

export const TYPE_LABEL = {
    ...Object.fromEntries(MANUAL_TYPES.map(t => [t.value, t.label])),
    ...AI_TYPE_LABELS
}
export const TYPE_EMOJI = Object.fromEntries(MANUAL_TYPES.map(t => [t.value, t.emoji]))

export const day = v => (v ? String(v).slice(0, 10) : '')

// 'YYYY-MM-DD' 加幾個月（月底會自動收斂，例如 1/31 + 1 個月 = 2/28）
export function addMonths(ymd, months) {
    const m = String(ymd).match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (!m) return ''
    const y = +m[1], mo = +m[2] - 1, d = +m[3]
    const target = new Date(Date.UTC(y, mo + months, 1))
    const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
    target.setUTCDate(Math.min(d, lastDay))
    return target.toISOString().slice(0, 10)
}

// 給頁面上方的「下次提醒」小卡用
export function upcomingReminders(records, today = todayString()) {
    return (records || [])
        .filter(r => day(r.next_date) && day(r.next_date) >= today)
        .map(r => ({
            id: r.id,
            title: r.title,
            type: r.type,
            date: day(r.next_date),
            daysLeft: daysBetween(today, day(r.next_date))
        }))
        .sort((a, b) => a.date.localeCompare(b.date))
}

export function useHealthRecords(petId) {
    return useQuery({
        queryKey: ['pet-health', petId],
        queryFn: async () => (await api.get(`/health-records/pet/${petId}`)).data.data,
        enabled: petId !== undefined && petId !== null // 寵物資料還沒載入時不要送出 /pet/undefined
    })
}