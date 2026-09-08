import { useState, useEffect, useRef } from 'react'
import {
  useQuery,
  useMutation,
  useQueryClient
} from '@tanstack/react-query'
import { api } from '../lib/api'

const EMOJI = {
  dog: '🐶',
  cat: '🐱',
  bird: '🐦',
  rabbit: '🐰',
  fish: '🐟',
  other: '🐾'
}

const QUICK_PROMPTS = [
  {
    label: '食慾不振',
    text: '最近食慾不振，不太想吃東西，可能的原因是什麼？'
  },
  {
    label: '嘔吐',
    text: '今天嘔吐了幾次，需要就醫嗎？'
  },
  {
    label: '腹瀉',
    text: '排便異常，糞便很稀，該怎麼辦？'
  },
  {
    label: '精神不佳',
    text: '精神很差，一直在睡覺，比平常安靜很多。'
  },
  {
    label: '皮膚問題',
    text: '皮膚出現紅疹或一直在抓癢，是過敏嗎？'
  },
  {
    label: '咳嗽',
    text: '一直在咳嗽或打噴嚏，是感冒嗎？'
  }
]

export default function HealthConsultPage() {
  const queryClient = useQueryClient()

  const [selectedPet, setSelectedPet] = useState(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const chatEndRef = useRef(null)

  // =====================================================
  // 取得寵物
  // =====================================================
  const { data: pets = [] } = useQuery({
    queryKey: ['pets'],
    queryFn: async () => {
      const response = await api.get('/pets')
      return response.data.data
    }
  })

  // =====================================================
  // 取得聊天紀錄
  // =====================================================
  const {
    data: messages = [],
    isLoading: loadingHistory
  } = useQuery({
    queryKey: ['consultations', selectedPet?.id],

    queryFn: async () => {
      const response = await api.get(
        `/consultations/pet/${selectedPet.id}`
      )

      return response.data.data
    },

    enabled: !!selectedPet
  })

  // =====================================================
  // 儲存聊天訊息
  // =====================================================
  const addMessage = useMutation({
    mutationFn: payload =>
      api.post('/consultations', payload),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [
          'consultations',
          selectedPet?.id
        ]
      })
    }
  })

  // =====================================================
  // 清除聊天紀錄
  // =====================================================
  const clearHistory = useMutation({
    mutationFn: petId =>
      api.delete(`/consultations/pet/${petId}`),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [
          'consultations',
          selectedPet?.id
        ]
      })
    }
  })

  // =====================================================
  // 自動捲到最下面
  // =====================================================
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({
      behavior: 'smooth'
    })
  }, [messages, loading])

  // =====================================================
  // 計算寵物年齡
  // =====================================================
  const getAge = birthDate => {
    if (!birthDate) {
      return '年齡不明'
    }

    const months = Math.floor(
      (Date.now() - new Date(birthDate)) /
        (1000 * 60 * 60 * 24 * 30.4)
    )

    if (months < 12) {
      return `${months} 個月`
    }

    return `${Math.floor(months / 12)} 歲`
  }

  // =====================================================
  // 發送訊息
  // =====================================================
  const sendMessage = async text => {
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

    try {
      // ===============================================
      // 1. 先儲存使用者訊息
      // ===============================================
      await addMessage.mutateAsync({
        petId: selectedPet.id,
        role: 'user',
        content
      })

      const pet = selectedPet

      // ===============================================
      // 2. AI 系統 Prompt
      // ===============================================
      const systemPrompt = `
你是一位專業且親切的寵物健康諮詢助手。

目前諮詢的寵物資料：

名字：${pet.name}
種類：${pet.species}
品種：${pet.breed || '不明'}
性別：${pet.gender || '不明'}
年齡：${getAge(pet.birth_date)}
體重：${
        pet.weight
          ? `${pet.weight} kg`
          : '不明'
      }

請遵守以下規則：

1. 只回答與寵物健康有關的問題。
2. 所有建議必須以目前這隻寵物的狀況為基礎。
3. 使用繁體中文。
4. 語氣專業、親切、容易理解。
5. 不要輸出任何思考過程或推理步驟。
6. 不要出現英文 reasoning 或 thinking process。
7. 不要重複列出寵物基本資料。
8. 不要使用 #、##、###。
9. 回答盡量控制在 80～150 字。
10. 不要直接斷定疾病，只能說明可能狀況。
11. 若有明顯危險症狀，提醒飼主儘快就醫。

回答格式：

**初步評估**
簡短說明目前可能的狀況。

**建議**
提供 1～2 個目前可以採取的做法。

**就醫提醒**
說明什麼情況應該帶寵物就醫。

最後簡短提醒：
此分析僅供參考，不能替代專業獸醫診斷。
`

      // ===============================================
      // 3. 帶入最近的聊天紀錄
      // ===============================================
      const recentMessages = messages
        .slice(-6)
        .map(message => ({
          role:
            message.role === 'user'
              ? 'user'
              : 'assistant',

          content: message.content
        }))

      // 把這次的新問題加入
      recentMessages.push({
        role: 'user',
        content
      })

      // ===============================================
      // 4. 呼叫 AI API
      // ===============================================
      const response =
        await api.post(
          '/consultations/ai',
          {
            systemPrompt,
            messages: recentMessages
          }
        )

      const aiText =
        response.data?.data?.content

      console.log(
        '前端收到 AI 回覆：',
        aiText
      )

      if (!aiText) {
        throw new Error(
          '沒有收到 AI 回覆內容'
        )
      }

      // ===============================================
      // 5. 儲存 AI 回覆
      //
      // 重要：
      // 必須是 assistant
      // 不能寫 ai
      // ===============================================
      await addMessage.mutateAsync({
        petId: selectedPet.id,
        role: 'assistant',
        content: aiText
      })

    } catch (err) {
      console.error(
        'AI 健康諮詢失敗：',
        err
      )

      const errorMessage =
        err.response?.data?.error ||
        err.message ||
        'AI 回覆失敗'

      // 錯誤訊息也使用 assistant
      try {
        await addMessage.mutateAsync({
          petId: selectedPet.id,
          role: 'assistant',
          content:
            `❌ ${errorMessage}`
        })
      } catch (saveError) {
        console.error(
          '儲存錯誤訊息失敗：',
          saveError
        )
      }

    } finally {
      setLoading(false)
    }
  }

  // =====================================================
  // AI 訊息格式
  // =====================================================
  const formatAI = text => {
    if (!text) {
      return ''
    }

    let badge = ''

    if (
      /立即就醫|緊急就醫|馬上送醫|危及生命|非常危險|急診/i.test(
        text
      )
    ) {
      badge =
        '<span class="inline-flex items-center gap-1 text-xs font-semibold bg-red-50 text-red-500 px-2 py-0.5 rounded-full mb-2">🔴 建議緊急就醫</span><br/>'
    } else if (
      /超過24小時|持續惡化|建議盡快就醫|需要就醫|應該就醫|儘快就醫/i.test(
        text
      )
    ) {
      badge =
        '<span class="inline-flex items-center gap-1 text-xs font-semibold bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full mb-2">🟡 建議近期就醫</span><br/>'
    } else {
      badge =
        '<span class="inline-flex items-center gap-1 text-xs font-semibold bg-green-50 text-green-600 px-2 py-0.5 rounded-full mb-2">🟢 一般健康建議</span><br/>'
    }

    const formatted = text
      .replace(/#{1,6}\s*/g, '')
      .replace(
        /\*\*(.*?)\*\*/g,
        '<strong>$1</strong>'
      )
      .replace(
        /^- (.+)$/gm,
        '<span class="block pl-2">• $1</span>'
      )
      .replace(/\n/g, '<br/>')

    return badge + formatted
  }

  // =====================================================
  // 畫面
  // =====================================================
  return (
    <div
      className="flex h-full"
      style={{
        height: 'calc(100vh - 0px)'
      }}
    >
      {/* ================= 左側寵物列表 ================= */}

      <div className="w-56 bg-white border-r border-gray-200 flex flex-col shrink-0">

        <div className="px-4 py-4 border-b border-gray-100">

          <h2 className="text-sm font-bold text-gray-800">
            選擇寵物
          </h2>

          <p className="text-xs text-gray-400 mt-0.5">
            選擇要諮詢的寵物
          </p>

        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">

          {pets.length === 0 ? (

            <p className="text-xs text-gray-400 text-center py-8">
              還沒有寵物
            </p>

          ) : (

            pets.map(pet => (

              <button
                key={pet.id}
                onClick={() =>
                  setSelectedPet(pet)
                }
                className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                  selectedPet?.id === pet.id
                    ? 'bg-green-50 border-green-300'
                    : 'bg-gray-50 border-gray-100 hover:border-green-200 hover:bg-green-50'
                }`}
              >

                <span className="text-2xl">
                  {EMOJI[pet.species] || '🐾'}
                </span>

                <div className="min-w-0">

                  <p className="text-sm font-semibold text-gray-800 truncate">
                    {pet.name}
                  </p>

                  <p className="text-xs text-gray-400 truncate">
                    {pet.breed || pet.species}
                  </p>

                </div>

              </button>

            ))

          )}

        </div>

      </div>

      {/* ================= 右側聊天區 ================= */}

      <div className="flex-1 flex flex-col overflow-hidden">

        {!selectedPet ? (

          <div className="flex-1 flex items-center justify-center flex-col gap-3 text-gray-400">

            <span className="text-6xl">
              🏥
            </span>

            <p className="text-base font-semibold text-gray-500">
              請先選擇要諮詢的寵物
            </p>

            <p className="text-sm">
              從左側選擇一隻寵物開始健康諮詢
            </p>

          </div>

        ) : (

          <>

            {/* ================= 寵物資訊 ================= */}

            <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3 shrink-0">

              <span className="text-3xl">
                {EMOJI[selectedPet.species] || '🐾'}
              </span>

              <div>

                <p className="text-sm font-bold text-gray-800">
                  {selectedPet.name}
                </p>

                <p className="text-xs text-gray-400">

                  {selectedPet.breed ||
                    selectedPet.species}

                  {selectedPet.weight
                    ? ` · ${selectedPet.weight} kg`
                    : ''}

                  {selectedPet.birth_date
                    ? ` · ${getAge(
                        selectedPet.birth_date
                      )}`
                    : ''}

                </p>

              </div>

              <div className="ml-auto flex items-center gap-3">

                <span className="text-xs bg-green-50 text-green-600 font-semibold px-2 py-1 rounded-full">
                  Powered by Groq
                </span>

                {messages.length > 0 && (

                  <button
                    onClick={() => {
                      if (
                        confirm(
                          '確定清除所有對話紀錄？'
                        )
                      ) {
                        clearHistory.mutate(
                          selectedPet.id
                        )
                      }
                    }}
                    className="text-xs text-gray-400 hover:text-red-400 transition-colors border border-gray-200 px-2 py-1 rounded-lg"
                  >
                    🗑️ 清除紀錄
                  </button>

                )}

              </div>

            </div>

            {/* ================= 聊天訊息 ================= */}

            <div className="flex-1 overflow-y-auto p-6 space-y-4">

              {loadingHistory ? (

                <div className="text-center py-12 text-gray-400 text-sm">
                  載入對話紀錄中...
                </div>

              ) : messages.length === 0 ? (

                <div className="text-center py-12">

                  <p className="text-4xl mb-3">
                    🐾
                  </p>

                  <p className="text-gray-500 font-semibold mb-1">
                    開始諮詢 {selectedPet.name} 的健康狀況
                  </p>

                  <p className="text-sm text-gray-400 mb-6">
                    描述症狀或選擇常見問題快速開始
                  </p>

                  <div className="flex flex-wrap gap-2 justify-center">

                    {QUICK_PROMPTS.map(q => (

                      <button
                        key={q.label}
                        onClick={() =>
                          sendMessage(q.text)
                        }
                        className="bg-white border border-gray-200 rounded-full px-4 py-2 text-sm text-gray-600 hover:border-green-300 hover:bg-green-50 hover:text-green-700 transition-all"
                      >
                        {q.label}
                      </button>

                    ))}

                  </div>

                </div>

              ) : (

                <>

                  {messages.map((msg, index) => {

                    const isUser =
                      msg.role === 'user'

                    return (

                      <div
                        key={
                          msg.id ||
                          `${msg.created_at}-${index}`
                        }
                        className={`flex gap-3 ${
                          isUser
                            ? 'flex-row-reverse'
                            : ''
                        }`}
                      >

                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 ${
                            isUser
                              ? 'bg-green-500 text-white font-bold'
                              : 'bg-green-50 text-lg'
                          }`}
                        >

                          {isUser
                            ? '我'
                            : '🐾'}

                        </div>

                        <div
                          className={`max-w-lg flex flex-col ${
                            isUser
                              ? 'items-end'
                              : 'items-start'
                          }`}
                        >

                          <div
                            className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                              isUser
                                ? 'bg-green-500 text-white rounded-br-sm'
                                : 'bg-white border border-gray-200 text-gray-700 rounded-bl-sm'
                            }`}
                          >

                            {isUser ? (

                              msg.content

                            ) : (

                              <div
                                dangerouslySetInnerHTML={{
                                  __html:
                                    formatAI(
                                      msg.content
                                    )
                                }}
                              />

                            )}

                          </div>

                          {msg.created_at && (

                            <p className="text-xs text-gray-400 mt-1 px-1">
                              {new Date(
                                msg.created_at
                              ).toLocaleString(
                                'zh-TW',
                                {
                                  month: 'numeric',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                }
                              )}

                            </p>

                          )}

                        </div>

                      </div>

                    )

                  })}

                  {/* AI Loading */}

                  {loading && (

                    <div className="flex gap-3">

                      <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center text-lg shrink-0">
                        🐾
                      </div>

                      <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3">

                        <div className="flex gap-1.5 items-center h-5">

                          {[0, 1, 2].map(i => (

                            <div
                              key={i}
                              className="w-2 h-2 bg-gray-300 rounded-full animate-bounce"
                              style={{
                                animationDelay:
                                  `${i * 0.15}s`
                              }}
                            />

                          ))}

                        </div>

                      </div>

                    </div>

                  )}

                  <div ref={chatEndRef} />

                </>

              )}

            </div>

            {/* ================= 輸入區 ================= */}

            <div className="bg-white border-t border-gray-200 p-4 shrink-0">

              {messages.length > 0 && (

                <div className="flex gap-2 mb-3 flex-wrap">

                  {QUICK_PROMPTS
                    .slice(0, 4)
                    .map(q => (

                      <button
                        key={q.label}
                        onClick={() =>
                          sendMessage(q.text)
                        }
                        disabled={loading}
                        className="text-xs bg-gray-50 border border-gray-200 rounded-full px-3 py-1 text-gray-500 hover:border-green-300 hover:text-green-600 transition-all disabled:opacity-50"
                      >
                        {q.label}
                      </button>

                    ))}

                </div>

              )}

              <div className="flex gap-3 items-end">

                <textarea
                  value={input}
                  onChange={e =>
                    setInput(e.target.value)
                  }
                  onKeyDown={e => {
                    if (
                      e.key === 'Enter' &&
                      !e.shiftKey
                    ) {
                      e.preventDefault()
                      sendMessage()
                    }
                  }}
                  placeholder={`描述 ${selectedPet.name} 的症狀或問題...`}
                  rows={2}
                  disabled={loading}
                  className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-400 focus:bg-white transition-all resize-none disabled:opacity-60"
                />

                <button
                  onClick={() =>
                    sendMessage()
                  }
                  disabled={
                    loading ||
                    !input.trim()
                  }
                  className="w-11 h-11 bg-green-500 hover:bg-green-600 text-white rounded-xl flex items-center justify-center transition-colors disabled:opacity-40 shrink-0 text-lg"
                >
                  ➤
                </button>

              </div>

              <p className="text-xs text-gray-400 mt-2 text-center">
                ⚠️ 此諮詢僅供參考，不能替代專業獸醫診斷
              </p>

            </div>

          </>

        )}

      </div>

    </div>
  )
}