import { useState, useEffect, useRef, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  useQuery,
  useMutation,
  useQueryClient
} from '@tanstack/react-query'

import { api } from '../lib/api'
import { petAgeText } from '../lib/petAge'
import { PetDrawer, PetPickerBar } from '../components/layout/PetDrawer'
import PetIcon from '../components/brand/PetIcon'
import PixelAssistant from '../components/brand/PixelAssistant'
import LoadingState from '../components/ui/LoadingState'
import PetEmotionPage from './PetEmotion'
import KnowledgeSources from '../components/consult/KnowledgeSources'
import QuickPrompts from '../components/consult/QuickPrompts'
import FollowupSuggestions from '../components/consult/FollowupSuggestions'
import {
  makePending,
  mergeMessages,
  prunePending
} from '../components/consult/pendingMessages'


// =====================================================
// 嚴重程度
// =====================================================

const SEVERITY_CONFIG = {
  normal: {
    label: '一般健康建議',
    className: 'bg-pine-50 text-pine-700 border-pine-100'
  },
  urgent: {
    label: '建議儘快就醫',
    className: 'bg-honey-50 text-honey-text border-honey-200'
  },
  emergency: {
    label: '緊急救護',
    className: 'bg-clay-50 text-clay border-clay-200'
  },
  unknown: {
    label: '尚未分級',
    className: 'bg-cream text-ink-soft border-sand'
  }
}


// =====================================================
// AI 回覆文字格式
// =====================================================

function formatAI(text) {
  if (!text) return ''

  return text
    .replace(/#{1,6}\s*/g, '')
    .replace(
      /\*\*(.*?)\*\*/g,
      '<strong>$1</strong>'
    )
    .replace(
      /^(\d+)\.\s(.+)$/gm,
      '<span class="block">$1. $2</span>'
    )
    .replace(
      /^-\s(.+)$/gm,
      '<span class="block">• $1</span>'
    )
    .replace(/\n/g, '<br/>')
}


// =====================================================
// UI icons
// =====================================================

const ICON = {
  paw: <><ellipse cx="7" cy="8" rx="2" ry="2.4" /><ellipse cx="12" cy="5.8" rx="2" ry="2.4" /><ellipse cx="17" cy="8" rx="2" ry="2.4" /><path d="M12 11c-3 0-5.5 2.2-5.5 4.8 0 1.7 1.4 2.9 3 2.9 1 0 1.6-.5 2.5-.5s1.5.5 2.5.5c1.6 0 3-1.2 3-2.9C17.5 13.2 15 11 12 11Z" /></>,
  camera: <><path d="M4 8.5h3l1.5-2h7L17 8.5h3v10H4Z" /><circle cx="12" cy="13" r="3.5" /></>,
  stethoscope: <><path d="M6 4v5a4 4 0 0 0 8 0V4" /><path d="M10 13v2.5a4.5 4.5 0 0 0 9 0V13" /><circle cx="19" cy="12" r="1.8" /></>,
  trash: <><path d="M4.5 7h15" /><path d="M9 7V5h6v2" /><path d="M6.5 7l.8 12h9.4l.8-12" /><path d="M10 10.5v5M14 10.5v5" /></>,
  edit: <><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3Z" /><path d="M15 5l4 4" /></>,
  send: <path d="M4 12h15M13 6l6 6-6 6" />,
  alert: <><path d="M12 4.5 21 19.5H3L12 4.5Z" /><path d="M12 10v4M12 17h.01" /></>,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  question: <><circle cx="12" cy="12" r="8.5" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 1-1 1.7M12 16.5h.01" /></>,
  shield: <><path d="M12 3.5 5 6v5.5c0 4.2 3 7.5 7 9 4-1.5 7-4.8 7-9V6l-7-2.5Z" /><path d="M9 12l2 2 4-4" /></>,
  close: <path d="M6 6l12 12M18 6L6 18" />
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
      {ICON[name] || ICON.paw}
    </svg>
  )
}

const severityIconName = label => ({
  '一般健康建議': 'check',
  '建議儘快就醫': 'alert',
  '緊急救護': 'alert',
  '尚未分級': 'question'
}[label] || 'shield')

// =====================================================
// HealthConsultPage
// =====================================================

export default function HealthConsultPage() {
  const queryClient = useQueryClient()

  const [selectedPet, setSelectedPet] =
    useState(null)
  const [petOpen, setPetOpen] = useState(false) // 手機寵物抽屜

  // 右邊目前顯示哪個畫面：'consult' = 選到的寵物的健康諮詢、'emotion' = AI 心情辨識。
  // 記在網址的 ?view=emotion：重新整理、上一頁、從別處（例如小助理的連結）直接進來都會停在對的畫面。
  const [searchParams, setSearchParams] = useSearchParams()
  const view = searchParams.get('view') === 'emotion' ? 'emotion' : 'consult'
  const showConsult = () => setSearchParams({}) // 回到諮詢（拿掉 ?view=）
  const showEmotion = () => setSearchParams({ view: 'emotion' })

  const [input, setInput] =
    useState('')

  const [loading, setLoading] =
    useState(false)

  // 「…」動畫只在「已經顯示我的問題、還沒顯示回覆」的期間出現
  const [showTyping, setShowTyping] =
    useState(false)

  // 還沒被資料庫紀錄追上的訊息（樂觀顯示）
  const [pending, setPending] =
    useState([])

  const chatEndRef =
    useRef(null)

  // AI 回覆後的「接下來可以問」；綁定寵物 id，切換寵物後就不會顯示別隻的建議
  const [followups, setFollowups] = useState({ petId: null, items: [] })

  // AI 自動記錄健康事件後的提示
  const [savedNotice, setSavedNotice] =
    useState(null)


  // ===================================================
  // 取得寵物
  // ===================================================

  const {
    data: pets = []
  } = useQuery({
    queryKey: ['pets'],

    queryFn: async () => {
      const response =
        await api.get('/pets')

      return response.data.data
    }
  })


  // ===================================================
  // 取得聊天紀錄
  // ===================================================

  const {
    data: messages = [],
    isLoading: loadingHistory
  } = useQuery({
    queryKey: [
      'consultations',
      selectedPet?.id
    ],

    queryFn: async () => {
      const response =
        await api.get(
          `/consultations/pet/${selectedPet.id}`
        )

      return response.data.data
    },

    enabled: !!selectedPet
  })


  // ===================================================
  // 要顯示的訊息 = 資料庫的紀錄 + 還沒存好的訊息
  // ===================================================

  // 資料庫已經追上的、或太舊的暫時訊息直接忽略；
  // 用推導取代 effect 內 setState，避免多餘的連鎖渲染。
  const activePending = useMemo(
    () => prunePending(pending, messages, selectedPet?.id),
    [pending, messages, selectedPet?.id]
  )

  const displayMessages = useMemo(
    () => mergeMessages(messages, activePending, selectedPet?.id),
    [messages, activePending, selectedPet?.id]
  )


  // ===================================================
  // 儲存訊息
  // ===================================================

  const addMessage = useMutation({
    mutationFn: payload =>
      api.post(
        '/consultations',
        payload
      ),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [
          'consultations',
          selectedPet?.id
        ]
      })
    }
  })


  // ===================================================
  // 清除對話
  // ===================================================

  const clearHistory = useMutation({
    mutationFn: petId =>
      api.delete(
        `/consultations/pet/${petId}`
      ),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [
          'consultations',
          selectedPet?.id
        ]
      })
    }
  })


  // ===================================================
  // 刪除／重新編寫「我問過的問題」
  //
  // 兩個動作都會連同 AI 回覆、以及依這則提問記錄的健康事件
  // （飲食管理、週報、通知）一起清掉，由後端在同一個交易裡完成。
  // ===================================================

  // 正在編寫的提問：{ id, text }
  const [editing, setEditing] =
    useState(null)

  // 正在重新產生回覆的提問 id
  const [regeneratingId, setRegeneratingId] =
    useState(null)

  // 健康紀錄有變動，所有讀取它的畫面都要重新取得
  const refreshAfterQuestionChange = petId => {
    [
      ['consultations', petId],
      ['diet-health-events', petId],
      ['meal-plan', petId],
      ['pet-health', petId],
      ['feeding-alerts', petId],
      ['assistant-briefing'],
      ['notifications']
    ].forEach(queryKey =>
      queryClient.invalidateQueries({ queryKey })
    )
  }

  const deleteQuestion = useMutation({
    mutationFn: id =>
      api.delete(`/consultations/${id}`),

    onSuccess: () => {
      setFollowups({ petId: null, items: [] })
      refreshAfterQuestionChange(selectedPet?.id)
    },

    onError: err => {
      window.alert(
        err.response?.data?.error ||
        '刪除失敗，請稍後再試'
      )
    }
  })

  const handleDeleteQuestion = msg => {
    if (
      loading ||
      regeneratingId !== null ||
      deleteQuestion.isPending
    ) {
      return
    }

    const ok = window.confirm(
      '要刪除這則提問嗎？\n\n' +
      'AI 的回覆，以及依這則提問記錄的健康事件' +
      '（飲食管理、週報、通知）也會一併移除。'
    )

    if (ok) {
      deleteQuestion.mutate(msg.id)
    }
  }

  const submitEdit = async () => {
    if (!editing || !selectedPet || loading) {
      return
    }

    const content = editing.text.trim()
    const questionId = editing.id

    if (!content) {
      return
    }

    const original =
      messages.find(m => m.id === questionId)

    // 沒有改動就不重問
    if (original && original.content === content) {
      setEditing(null)
      return
    }

    const pet = selectedPet

    // 這則提問「之前」的對話當作 AI 的上下文（不含它原本的回覆）
    const index =
      messages.findIndex(m => m.id === questionId)

    const context =
      messages
        .slice(Math.max(0, index - 6), Math.max(0, index))
        .map(m => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.content
        }))

    setLoading(true)
    setFollowups({ petId: null, items: [] })

    // 1. 刪掉舊的 AI 回覆與舊的健康事件，換成新的問題文字
    try {
      await api.put(
        `/consultations/${questionId}`,
        { content }
      )
    } catch (err) {
      // 什麼都還沒改動，留在編輯畫面讓使用者重試
      window.alert(
        err.response?.data?.error ||
        '無法更新提問，請稍後再試'
      )

      setLoading(false)
      return
    }

    setEditing(null)
    setRegeneratingId(questionId)

    queryClient.invalidateQueries({
      queryKey: ['consultations', pet.id]
    })

    // 2. 依新的問題產生新的回覆，接在這則提問的正下方
    try {
      const response =
        await api.post(
          '/consultations/ai',
          {
            systemPrompt: buildSystemPrompt(pet),
            petId: pet.id,
            consultationId: questionId,
            messages: [
              ...context,
              { role: 'user', content }
            ]
          }
        )

      const data = response.data?.data
      const aiText = data?.content

      if (!aiText) {
        throw new Error('沒有收到 AI 回覆內容')
      }

      await api.post(
        '/consultations',
        {
          petId: pet.id,
          role: 'assistant',
          content: aiText,
          severity: data?.severity ?? null,
          sources:
            (data?.sources || [])
              .map(source => source.slug)
              .filter(Boolean),
          afterId: questionId
        }
      )

      if (data?.healthEvent) {
        setSavedNotice({
          ...data.healthEvent,
          petId: pet.id
        })
      }

    } catch (err) {
      console.error('重新產生 AI 回覆失敗：', err)

      const errorMessage =
        err.response?.data?.error ||
        err.message ||
        'AI 回覆失敗'

      try {
        await api.post(
          '/consultations',
          {
            petId: pet.id,
            role: 'assistant',
            content: `❌ ${errorMessage}`,
            severity: null,
            afterId: questionId
          }
        )
      } catch (saveError) {
        console.error('儲存錯誤訊息失敗：', saveError)
      }

    } finally {
      setRegeneratingId(null)
      setLoading(false)
      refreshAfterQuestionChange(pet.id)
    }
  }


  // ===================================================
  // 自動滑到底
  // ===================================================

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({
      behavior: 'smooth'
    })
  }, [
    displayMessages,
    showTyping
  ])


  // ===================================================
  // 計算年齡
  // ===================================================

  const getAge = birthDate => petAgeText(birthDate) || '年齡不明'


  // 健康諮詢的系統提示（送出新問題、重新編寫提問都用同一份）
  const buildSystemPrompt = pet => `
你是一位專業且親切的寵物健康諮詢助手。

目前諮詢的寵物資料：

名字：${pet.name}
種類：${pet.species}
品種：${pet.breed || '不明'}
性別：${pet.gender || '不明'}
年齡：${getAge(pet.birth_date)}
體重：${pet.weight
            ? `${pet.weight} kg`
            : '不明'
          }

請根據目前寵物的年齡、種類、症狀與先前對話提供健康建議。

規則：

1. 使用繁體中文。
2. 只回答寵物健康相關問題。
3. 不輸出思考過程。
4. 不輸出 reasoning。
5. 不輸出 thinking process。
6. 不重複寵物基本資料。
7. 不直接斷定疾病。
8. 回答簡短清楚。
9. 幼犬、幼貓需特別注意脫水及快速惡化風險。
10. 有危險症狀時必須明確提醒就醫。
`


  // ===================================================
  // 發送訊息
  // ===================================================

  const sendMessage =
    async text => {

      const content =
        text || input.trim()

      if (
        !content ||
        !selectedPet ||
        loading
      ) {
        return
      }

      setInput('')
      setLoading(true)
      setFollowups({ petId: null, items: [] })

      // ⭐ 先把我的問題顯示出來，再顯示「…」（不用等資料庫存好）
      const userPending = makePending({
        kind: 'user',
        petId: selectedPet.id,
        role: 'user',
        content,
        visibleMessages: displayMessages
      })

      setPending(list => [...list, userPending])
      setShowTyping(true)

      try {

        // =============================================
        // 1. 儲存使用者訊息
        // =============================================

        const savedQuestion = await addMessage.mutateAsync({
          petId:
            selectedPet.id,

          role:
            'user',

          content,

          severity:
            null
        })

        // 後端用這個 id 把產生的健康事件綁到這則提問，之後刪除／編寫才能一併清掉
        const questionId =
          savedQuestion?.data?.data?.id


        const pet =
          selectedPet


        // =============================================
        // 2. System Prompt
        // =============================================

        const systemPrompt = buildSystemPrompt(pet)


        // =============================================
        // 3. 最近對話
        // =============================================

        const recentMessages =
          displayMessages
            .slice(-6)
            .map(message => ({
              role:
                message.role === 'user'
                  ? 'user'
                  : 'assistant',

              content:
                message.content
            }))


        // 加入這次問題
        recentMessages.push({
          role: 'user',
          content
        })


        // =============================================
        // 4. 呼叫 AI
        // =============================================

        const response =
          await api.post(
            '/consultations/ai',
            {
              systemPrompt,

              // ⭐ 讓後端知道要把健康事件綁定到哪隻寵物
              petId:
                selectedPet.id,

              consultationId:
                questionId,

              messages:
                recentMessages
            }
          )


        // =============================================
        // 5. 取得 AI 回覆
        // =============================================

        const aiText =
          response.data
            ?.data
            ?.content


        // ⭐ 不再預設 normal
        const aiSeverity =
          response.data
            ?.data
            ?.severity ??
          null


        console.log(
          '=============================='
        )

        console.log(
          '🤖 AI 回覆：',
          aiText
        )

        console.log(
          '🚨 AI severity：',
          aiSeverity
        )

        console.log(
          '📦 完整 API response：',
          response.data
        )

        console.log(
          '=============================='
        )


        if (!aiText) {
          throw new Error(
            '沒有收到 AI 回覆內容'
          )
        }


        // =============================================
        // ⭐ 後端若已記錄重要健康事件，
        //    通知飲食管理重新取得資料，並提示使用者
        // =============================================

        const healthEvent =
          response.data
            ?.data
            ?.healthEvent

        if (healthEvent) {
          queryClient.invalidateQueries({
            queryKey: [
              'diet-health-events',
              selectedPet.id
            ]
          })

          // 飲食計畫也要依新的健康事件重新產生
          queryClient.invalidateQueries({
            queryKey: [
              'meal-plan',
              selectedPet.id
            ]
          })

          // 綁定寵物 id，切換寵物後就不會顯示別隻的提示
          setSavedNotice({
            ...healthEvent,
            petId: selectedPet.id
          })
        }


        // =============================================
        // ⭐ 回覆一到就顯示，「…」同時消失（不用等存檔）
        // =============================================

        setPending(list => [
          ...list,
          makePending({
            kind: 'assistant',
            petId: selectedPet.id,
            role: 'assistant',
            content: aiText,
            severity: aiSeverity,
            sources: response.data?.data?.sources || [],
            visibleMessages: displayMessages
          })
        ])

        setShowTyping(false)


        // =============================================
        // 6. 儲存 AI 回覆
        // ⭐ severity 一起寫入資料庫
        // =============================================

        await addMessage.mutateAsync({
          petId:
            selectedPet.id,

          role:
            'assistant',

          content:
            aiText,

          severity:
            aiSeverity,

          // 這次回答參考的知識庫來源（只傳 slug，由後端查出名稱與網址）
          sources:
            (response.data?.data?.sources || [])
              .map(source => source.slug)
              .filter(Boolean)
        })


        // 回覆存好之後，才顯示「接下來可以問」
        setFollowups({
          petId: selectedPet.id,
          items: response.data?.data?.followups || []
        })


      } catch (err) {

        console.error(
          'AI 健康諮詢失敗：',
          err
        )


        const errorMessage =
          err.response
            ?.data
            ?.error ||
          err.message ||
          'AI 回覆失敗'


        setPending(list => [
          ...list,
          makePending({
            kind: 'error',
            petId: selectedPet.id,
            role: 'assistant',
            content: `❌ ${errorMessage}`,
            visibleMessages: displayMessages
          })
        ])

        setShowTyping(false)

        try {

          await addMessage.mutateAsync({
            petId:
              selectedPet.id,

            role:
              'assistant',

            content:
              `❌ ${errorMessage}`,

            severity:
              null
          })

        } catch (saveError) {

          console.error(
            '儲存錯誤訊息失敗：',
            saveError
          )

        }

      } finally {

        setShowTyping(false)
        setLoading(false)

      }
    }


  // ===================================================
  // UI
  // ===================================================

  return (
    <div className="flex h-full overflow-hidden">
      {/* ===============================================
          左側：寵物
      =============================================== */}
      <PetDrawer open={petOpen} onClose={() => setPetOpen(false)} widthClass="md:w-56">
        <div className="border-b border-hair px-4 py-5">
          <h2 className="text-sm font-bold text-pine-900">選擇寵物</h2>
          <p className="mt-1 text-xs text-ink-soft">選擇要諮詢的寵物</p>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto p-3">
          {pets.length === 0 ? (
            <p className="py-8 text-center text-xs text-ink-soft">還沒有寵物</p>
          ) : (
            pets.map(pet => (
              <button
                key={pet.id}
                onClick={() => {
                  setSelectedPet(pet)
                  showConsult()
                  setPetOpen(false)
                }}
                className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                  view === 'consult' && selectedPet?.id === pet.id
                    ? 'border-pine-700/35 bg-pine-50'
                    : 'border-sand bg-cream hover:border-pine-700/30 hover:bg-warm'
                }`}
              >
                <PetIcon species={pet.species} breed={pet.breed} size={40} className="h-10 w-10 shrink-0" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-pine-900">{pet.name}</p>
                  <p className="truncate text-xs text-ink-soft">{pet.breed || pet.species}</p>
                </div>
              </button>
            ))
          )}

          <div className="mt-4 border-t border-hair pt-4">
            <p className="px-1 pb-2 text-[11px] font-bold text-ink-soft">其他功能</p>
            <button
              type="button"
              onClick={() => {
                showEmotion()
                setPetOpen(false)
              }}
              aria-current={view === 'emotion' ? 'page' : undefined}
              className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                view === 'emotion'
                  ? 'border-pine-700/35 bg-pine-50'
                  : 'border-sand bg-cream hover:border-pine-700/30 hover:bg-warm'
              }`}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-plate text-pine-700">
                <LineIcon name="camera" size={19} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-pine-900">AI 心情辨識</p>
                <p className="truncate text-xs text-ink-soft">拍照分析毛孩情緒</p>
              </div>
            </button>
          </div>
        </div>
      </PetDrawer>

      {/* ===============================================
          右側
      =============================================== */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <PetPickerBar
          icon={
            view === 'emotion'
              ? <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-pine-50 text-pine-700"><LineIcon name="camera" size={16} /></span>
              : selectedPet
                ? <PetIcon species={selectedPet.species} breed={selectedPet.breed} size={28} className="h-7 w-7 shrink-0" />
                : null
          }
          name={view === 'emotion' ? 'AI 心情辨識' : selectedPet?.name}
          sub={view === 'emotion' ? '拍照分析毛孩情緒' : selectedPet ? (selectedPet.breed || selectedPet.species) : ''}
          onOpen={() => setPetOpen(true)}
        />

        {view === 'emotion' ? (
          // AI 心情辨識：直接顯示在右邊主畫面（跟選寵物一樣），不再另外彈出視窗
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex shrink-0 items-center gap-3 border-b border-sand bg-plate px-4 py-3 sm:px-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-pine-50 text-pine-700">
                <LineIcon name="camera" size={20} />
              </span>
              <div>
                <p className="text-sm font-bold text-pine-900">AI 心情辨識</p>
                <p className="text-xs text-ink-soft">拍攝或上傳寵物照片，讓 AI 分析牠可能的心情</p>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto bg-cream">
              <PetEmotionPage embedded />
            </div>
          </div>
        ) : !selectedPet ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
            <span className="bubble-ai px-3 py-1.5 font-brand text-xs font-extrabold text-pine-900">先選一隻毛孩吧！</span>
            <PixelAssistant size={64} />
            <p className="font-bold text-pine-900">請先選擇要諮詢的寵物</p>
            <p className="text-sm text-ink-soft">
              <span className="md:hidden">點上方選擇一隻寵物開始健康諮詢</span>
              <span className="hidden md:inline">從左側選擇一隻寵物開始健康諮詢</span>
            </p>
          </div>
        ) : (
          <>
            {/* 寵物 Header */}
            <div className="flex shrink-0 items-center gap-3 border-b border-sand bg-plate px-4 py-3 sm:px-6">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-pine-800 text-honey">
                <PetIcon species={selectedPet.species} breed={selectedPet.breed} size={30} className="h-[30px] w-[30px]" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-pine-900">{selectedPet.name}</p>
                <p className="truncate text-xs text-ink-soft">
                  {selectedPet.breed || selectedPet.species}
                  {selectedPet.weight ? ` · ${selectedPet.weight} kg` : ''}
                  {selectedPet.birth_date ? ` · ${getAge(selectedPet.birth_date)}` : ''}
                </p>
              </div>
              <div className="ml-auto flex items-center gap-3">
                <span className="hidden rounded-full bg-pine-50 px-2.5 py-1 text-xs font-bold text-pine-700 sm:inline">
                  Powered by Groq
                </span>
                {displayMessages.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('確定清除所有對話紀錄？')) {
                        clearHistory.mutate(selectedPet.id)
                      }
                    }}
                    className="inline-flex items-center gap-1 rounded-xl border border-sand bg-plate px-2.5 py-1.5 text-xs font-semibold text-ink-soft transition-colors hover:bg-warm hover:text-clay"
                  >
                    <LineIcon name="trash" size={13} />
                    清除紀錄
                  </button>
                )}
              </div>
            </div>

            {/* 聊天訊息 */}
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
              {loadingHistory && displayMessages.length === 0 ? (
                <LoadingState compact label="載入對話紀錄中…" />
              ) : displayMessages.length === 0 ? (
                <div className="py-10 text-center">
                  <span className="bubble-ai mx-auto inline-block px-3 py-1.5 font-brand text-xs font-extrabold text-pine-900">
                    有什麼想問的嗎？
                  </span>
                  <span className="mt-2 flex justify-center">
                    <PixelAssistant size={64} />
                  </span>
                  <p className="mt-4 font-bold text-pine-900">開始諮詢 {selectedPet.name} 的健康狀況</p>
                  <p className="mt-1 text-sm text-ink-soft">描述症狀或選擇常見問題快速開始</p>
                  <div className="mt-6">
                    <QuickPrompts
                      species={selectedPet?.species}
                      onSelect={text => sendMessage(text)}
                      disabled={loading}
                    />
                  </div>
                </div>
              ) : (
                <>
                  {displayMessages.map((msg, index) => {
                    const isUser = msg.role === 'user'
                    const severity =
                      msg.severity && SEVERITY_CONFIG[msg.severity]
                        ? SEVERITY_CONFIG[msg.severity]
                        : SEVERITY_CONFIG.unknown

                    // 這則提問正在重新編寫中（暫時訊息沒有 id，不能當成編輯中的提問）
                    const isEditing =
                      isUser && !!editing && !!msg.id && editing.id === msg.id

                    return (
                      <div
                        key={msg.key || msg.id || `${msg.created_at}-${index}`}
                        className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
                      >
                        {/* 頭像 */}
                        {isUser ? (
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-pine-800 text-xs font-bold text-warm">
                            我
                          </div>
                        ) : (
                          <PixelAssistant tile size={34} />
                        )}

                        <div className={`flex max-w-lg flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                          {isEditing && (
                            <div className="w-full sm:min-w-[22rem]">
                              <textarea
                                autoFocus
                                rows={3}
                                maxLength={2000}
                                value={editing.text}
                                onChange={e => setEditing({ ...editing, text: e.target.value })}
                                onKeyDown={e => {
                                  if (e.key === 'Escape') setEditing(null)
                                }}
                                className="w-full resize-none rounded-xl border border-[#d5e4ea] bg-cream px-3 py-2 text-sm text-ink focus:border-pine-700/40 focus:outline-none"
                              />
                              <p className="mt-1 text-xs text-ink-soft">
                                送出後，原本的 AI 回覆與相關健康紀錄會被刪除，並依新的問題重新回覆。
                              </p>
                              <div className="mt-2 flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setEditing(null)}
                                  disabled={loading}
                                  className="rounded-lg border border-sand px-3 py-1.5 text-xs text-ink-soft transition-colors hover:bg-cream disabled:opacity-50"
                                >
                                  取消
                                </button>
                                <button
                                  type="button"
                                  onClick={submitEdit}
                                  disabled={loading || !editing.text.trim()}
                                  className="rounded-lg bg-pine-800 px-3 py-1.5 text-xs font-bold text-warm transition-colors hover:bg-pine-900 disabled:opacity-50"
                                >
                                  重新送出
                                </button>
                              </div>
                            </div>
                          )}

                          {!isEditing && (
                            <div
                              className={`px-4 py-3 text-sm leading-relaxed ${
                                isUser ? 'bubble-user' : 'bubble-ai text-ink'
                              }`}
                            >
                              {isUser ? (
                                msg.content
                              ) : (
                                <>
                                  {!msg.content?.startsWith('❌') && (
                                    <div className={`mb-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${severity.className}`}>
                                      <LineIcon name={severityIconName(severity.label)} size={13} />
                                      {severity.label}
                                    </div>
                                  )}
                                  <div dangerouslySetInnerHTML={{ __html: formatAI(msg.content) }} />
                                  {!msg.content?.startsWith('❌') && <KnowledgeSources sources={msg.sources} />}
                                </>
                              )}
                            </div>
                          )}

                          {/* 我的提問：重新編寫 / 刪除；AI 回覆：顯示時間 */}
                          {isUser && msg.id && !isEditing && (
                            regeneratingId === msg.id ? (
                              <p className="mt-1 animate-pulse px-1 text-xs text-pine-700">
                                AI 正在根據新的問題重新回覆…
                              </p>
                            ) : (
                              <div className="mt-1 flex items-center gap-1 px-1">
                                <button
                                  type="button"
                                  title="重新編寫"
                                  aria-label="重新編寫這則提問"
                                  disabled={loading || regeneratingId !== null || deleteQuestion.isPending}
                                  onClick={() => setEditing({ id: msg.id, text: msg.content })}
                                  className="rounded-md p-1 text-ink-soft transition-colors hover:bg-pine-50 hover:text-pine-700 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  <LineIcon name="edit" size={15} />
                                </button>
                                <button
                                  type="button"
                                  title="刪除"
                                  aria-label="刪除這則提問"
                                  disabled={loading || regeneratingId !== null || deleteQuestion.isPending}
                                  onClick={() => handleDeleteQuestion(msg)}
                                  className="rounded-md p-1 text-ink-soft transition-colors hover:bg-clay-50 hover:text-clay disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  <LineIcon name="trash" size={15} />
                                </button>
                              </div>
                            )
                          )}

                          {!isUser && msg.created_at && (
                            <p className="mt-1 px-1 text-xs text-ink-soft/80">
                              {new Date(msg.created_at).toLocaleString('zh-TW', {
                                month: 'numeric',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}

                  {showTyping && (
                    <div className="flex gap-3">
                      <PixelAssistant tile size={34} mood="typing" />
                      <div className="bubble-ai px-4 py-3">
                        <div className="flex h-5 items-center gap-1.5">
                          {[0, 1, 2].map(i => (
                            <div key={i} className="h-2 w-2 animate-bounce rounded-[2px] bg-pine-700" style={{ animationDelay: `${i * 0.15}s` }} />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </>
              )}
            </div>

            {/* 輸入區 */}
            <div className="shrink-0 border-t border-sand bg-plate p-4">
              {savedNotice && savedNotice.petId === selectedPet?.id && (
                <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-pine-100 bg-pine-50 px-3 py-2 text-xs text-pine-800">
                  <span className="flex items-start gap-1.5">
                    <LineIcon name="stethoscope" size={14} className="mt-0.5" />
                    已將「{savedNotice.title}」{savedNotice.isUpdate ? '更新到' : '記錄到'}
                    {selectedPet?.name}的健康紀錄
                    {savedNotice.dietRelevant && '，飲食管理會參考這項資訊'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSavedNotice(null)}
                    className="shrink-0 rounded-lg p-1 text-pine-700 transition-colors hover:bg-pine-100"
                    aria-label="關閉"
                  >
                    <LineIcon name="close" size={13} />
                  </button>
                </div>
              )}

              {displayMessages.length > 0 && !loading && followups.petId === selectedPet?.id && (
                <FollowupSuggestions
                  items={followups.items}
                  onSelect={text => sendMessage(text)}
                  disabled={loading}
                />
              )}

              {displayMessages.length > 0 && (
                <QuickPrompts
                  compact
                  species={selectedPet?.species}
                  onSelect={text => sendMessage(text)}
                  disabled={loading}
                />
              )}

              <div className="mt-3 flex items-end gap-3">
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      sendMessage()
                    }
                  }}
                  placeholder={`描述 ${selectedPet.name} 的症狀或問題...`}
                  rows={2}
                  disabled={loading}
                  className="min-w-0 flex-1 resize-none rounded-xl border border-sand bg-cream px-4 py-3 text-sm text-ink placeholder:text-ink-soft/60 transition-all focus:border-pine-700/40 focus:bg-plate focus:outline-none disabled:opacity-60"
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={loading || !input.trim()}
                  aria-label="送出"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-honey text-pine-900 shadow-press transition-all hover:bg-honey-hover active:translate-y-[3px] active:shadow-none disabled:opacity-40"
                >
                  <LineIcon name="send" size={18} />
                </button>
              </div>

              <p className="mt-2 flex items-center justify-center gap-1 text-xs text-ink-soft/80">
                <LineIcon name="alert" size={12} />
                此諮詢僅供參考，不能替代專業獸醫診斷
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
